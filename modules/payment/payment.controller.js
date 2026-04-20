const paymentService = require('./payment.service');
const payosService = require('./payos.service');
const Payment = require('./payment.model');
const DigitalProduct = require('../digital-product/digital-product.model');

const purchaseWithXu = async (req, res) => {
  try {
    const { productId } = req.body;
    const result = await paymentService.purchaseWithXu(req.userId, productId);

    res.status(200).json({ success: true, data: result, message: 'Mua sản phẩm thành công' });
  } catch (error) {
    console.error('Purchase with xu error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const purchaseWithPayOS = async (req, res) => {
  try {
    const { productId } = req.body;
    const result = await payosService.createPaymentLink(req.userId, productId);

    res.status(200).json({ success: true, data: result, message: 'Tạo link thanh toán thành công' });
  } catch (error) {
    console.error('Purchase with PayOS error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const handleWebhook = async (req, res) => {
  try {
    const body = req.body;

    const isValid = payosService.verifyWebhookSignature(body);
    console.log('Signature valid:', isValid);

    if (!isValid) {
      console.warn('Invalid webhook signature');
      return res.status(200).json({ success: false });
    }

    const code = body.code || body.data?.code;
    const orderCode = body.data?.orderCode;

    if (code === '00' && orderCode) {
      const payment = await Payment.findOne({ payosOrderId: orderCode.toString() });

      if (payment && payment.status === 'pending') {
        payment.status = 'success';
        await payment.save();

        await DigitalProduct.findByIdAndUpdate(payment.product, {
          $inc: { downloadCount: 1 },
        });

        console.log(`Payment ${orderCode} updated to success ✅`);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(200).json({ success: false });
  }
};


const checkPaymentStatus = async (req, res) => {
  try {
    const { orderCode } = req.params;

    const payment = await Payment.findOne({ payosOrderId: orderCode }).populate(
      'product',
      'name downloadUrl'
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    res.status(200).json({
      success: true,
      data: {
        status: payment.status,
        productName: payment.product.name,
        downloadUrl: payment.status === 'success' ? payment.product.downloadUrl : null,
      },
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const checkPurchased = async (req, res) => {
  try {
    const { productId } = req.params;

    const payment = await Payment.findOne({
      user: req.userId,
      product: productId,
      status: 'success',
    }).populate('product', 'name downloadUrl');

    if (!payment) {
      return res.status(200).json({ success: true, data: { purchased: false } });
    }

    res.status(200).json({
      success: true,
      data: {
        purchased: true,
        downloadUrl: payment.product.downloadUrl,
        productName: payment.product.name,
      },
    });
  } catch (error) {
    console.error('Check purchased error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  purchaseWithXu,
  purchaseWithPayOS,
  handleWebhook,
  checkPaymentStatus,
  checkPurchased
};