const paymentService = require('./payment.service');
const payosService = require('./payos.service');
const Payment = require('./payment.model');
const DigitalProduct = require('../digital-product/digital-product.model');

const purchaseWithXu = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.body;

    const result = await paymentService.purchaseWithXu(userId, productId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Mua sản phẩm thành công'
    });
  } catch (error) {
    console.error('Purchase with xu error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

const purchaseWithPayOS = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.body;

    const result = await payosService.createPaymentLink(userId, productId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Tạo link thanh toán thành công'
    });
  } catch (error) {
    console.error('Purchase with PayOS error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Không thể tạo link thanh toán'
    });
  }
};

const handleWebhook = async (req, res) => {
  try {
    let webhookData = req.body;
    
    if (Buffer.isBuffer(webhookData)) {
      webhookData = JSON.parse(webhookData.toString());
    }
    
    console.log('Webhook received:', JSON.stringify(webhookData, null, 2));
    
    const data = webhookData.data || webhookData;
    const { orderCode, status } = data;
    
    if (status === 'PAID' || data.code === '00') {
      const payment = await Payment.findOne({ payosOrderId: orderCode.toString() });
      
      if (payment && payment.status === 'pending') {
        payment.status = 'success';
        await payment.save();
        
        const product = await DigitalProduct.findById(payment.product);
        if (product) {
          await DigitalProduct.findByIdAndUpdate(product._id, {
            $inc: { downloadCount: 1 }
          });
        }
        
        console.log(`Payment successful for order ${orderCode}`);
      }
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ success: false });
  }
};

const paymentSuccess = async (req, res) => {
  try {
    const { orderCode } = req.query;
    
    console.log('Payment success callback, orderCode:', orderCode);
    
    if (!orderCode) {
      return res.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`);
    }
    
    const payment = await Payment.findOne({ payosOrderId: orderCode.toString() })
      .populate('product', 'name downloadUrl');
    
    if (!payment || payment.status !== 'success') {
      return res.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`);
    }
    
    const downloadUrl = encodeURIComponent(payment.product.downloadUrl);
    const productName = encodeURIComponent(payment.product.name);
    
    res.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/payment/success?downloadUrl=${downloadUrl}&productName=${productName}`);
  } catch (error) {
    console.error('Payment success error:', error);
    res.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`);
  }
};

const paymentCancel = async (req, res) => {
  console.log('Payment cancel callback');
  res.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`);
};

const checkPaymentStatus = async (req, res) => {
  try {
    const { orderCode } = req.params;
    const payment = await Payment.findOne({ payosOrderId: orderCode })
      .populate('product', 'name downloadUrl');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        status: payment.status,
        downloadUrl: payment.status === 'success' ? payment.product.downloadUrl : null,
        productName: payment.product.name
      }
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  purchaseWithXu,
  purchaseWithPayOS,
  handleWebhook,
  paymentSuccess,
  paymentCancel,
  checkPaymentStatus
};