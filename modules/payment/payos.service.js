const crypto = require('crypto');
const Payment = require('./payment.model');
const DigitalProduct = require('../digital-product/digital-product.model');
const User = require('../user/user.model');
const { PayOS } = require('@payos/node');

const payOS = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

const createPaymentLink = async (userId, productId) => {
  const [product, user] = await Promise.all([
    DigitalProduct.findById(productId),
    User.findById(userId),
  ]);

  if (!product) throw new Error('Sản phẩm không tồn tại');
  if (!user) throw new Error('Người dùng không tồn tại');

  const orderCode = Number(String(Date.now()).slice(-9));
  const description = `CNCODE ${orderCode}`.slice(0, 25);
  const baseUrl = process.env.FRONTEND_URL;

  const paymentData = {
    orderCode,
    amount: product.price,
    description,
    items: [{ name: product.name.slice(0, 50), quantity: 1, price: product.price }],
    returnUrl: `${baseUrl}/payment/success?orderCode=${orderCode}`,
    cancelUrl: `${baseUrl}/payment/cancel`,
  };

  const paymentLink = await payOS.paymentRequests.create(paymentData);

  const payment = new Payment({
    user: userId,
    product: productId,
    paymentMethod: 'banking',
    amount: product.price,
    status: 'pending',
    transactionId: `PAYOS_${orderCode}`,
    payosOrderId: orderCode.toString(),
    checkoutUrl: paymentLink.checkoutUrl,
    qrCode: paymentLink.qrCode,
  });

  await payment.save();

  return {
    checkoutUrl: paymentLink.checkoutUrl,
    qrCode: paymentLink.qrCode,
    orderCode,
  };
};

const verifyWebhookSignature = (body) => {
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  const data = body.data;

  
  const sortedKeys = Object.keys(data).sort();
  const signatureString = sortedKeys
    .map((key) => `${key}=${data[key]}`)
    .join('&');

  console.log('Signature string:', signatureString);

  const expectedSignature = crypto
    .createHmac('sha256', checksumKey)
    .update(signatureString)
    .digest('hex');

  console.log('Expected:', expectedSignature);
  console.log('Received:', body.signature);

  return expectedSignature === body.signature;
};

module.exports = { createPaymentLink, verifyWebhookSignature };