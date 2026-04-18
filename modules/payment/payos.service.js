const { PayOS } = require('@payos/node');
const Payment = require('./payment.model');
const DigitalProduct = require('../digital-product/digital-product.model');
const User = require('../user/user.model');

const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

const createPaymentLink = async (userId, productId) => {
  const product = await DigitalProduct.findById(productId);
  if (!product) {
    throw new Error('Sản phẩm không tồn tại');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Người dùng không tồn tại');
  }

  const orderCode = Date.now();
  const description = `CNCODE_${orderCode}`.slice(0, 25);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  const paymentData = {
    orderCode: orderCode,
    amount: product.price,
    description: description,
    items: [
      {
        name: product.name,
        quantity: 1,
        price: product.price,
      },
    ],
    cancelUrl: `${baseUrl}/api/payments/cancel`,
    returnUrl: `${baseUrl}/api/payments/success`,
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
  });

  await payment.save();

  return {
    checkoutUrl: paymentLink.checkoutUrl,
    paymentId: payment._id,
    orderCode: orderCode
  };
};

module.exports = {
  createPaymentLink
};