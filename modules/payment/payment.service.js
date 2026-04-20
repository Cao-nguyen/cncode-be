const Payment = require('./payment.model');
const User = require('../user/user.model');
const DigitalProduct = require('../digital-product/digital-product.model');

const purchaseWithXu = async (userId, productId) => {
  // Lấy user và product
  const user = await User.findById(userId);
  const product = await DigitalProduct.findById(productId);

  if (!product) {
    throw new Error('Sản phẩm không tồn tại');
  }

  if (!product.enableXuPayment) {
    throw new Error('Sản phẩm này không hỗ trợ thanh toán bằng Xu');
  }

  // Kiểm tra số xu
  if (user.coins < product.priceInXu) {
    throw new Error(`Không đủ xu. Bạn có ${user.coins} xu, cần ${product.priceInXu} xu`);
  }

  // TRỪ XU - Quan trọng
  user.coins = user.coins - product.priceInXu;
  await user.save();

  console.log(`User ${userId} used ${product.priceInXu} xu. Remaining: ${user.coins}`);

  // Tạo payment record
  const payment = new Payment({
    user: userId,
    product: productId,
    paymentMethod: 'xu',
    amount: product.price,
    xuAmount: product.priceInXu,
    status: 'success',
    transactionId: `XU_${Date.now()}_${userId}`
  });
  await payment.save();

  // Tăng download count
  await DigitalProduct.findByIdAndUpdate(productId, {
    $inc: { downloadCount: 1 }
  });

  return {
    success: true,
    downloadUrl: product.downloadUrl,
    remainingCoins: user.coins
  };
};

const getPaymentStatus = async (paymentId) => {
  const payment = await Payment.findById(paymentId)
    .populate('product', 'name downloadUrl description')
    .populate('user', 'fullName email');

  if (!payment) {
    throw new Error('Payment not found');
  }

  return payment;
};

const getUserPurchases = async (userId) => {
  const purchases = await Payment.find({ user: userId, status: 'success' })
    .populate('product')
    .sort({ createdAt: -1 });
  return purchases;
};

module.exports = {
  purchaseWithXu,
  getPaymentStatus,
  getUserPurchases
};