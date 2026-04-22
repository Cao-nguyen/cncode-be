const paymentService = require('./payment.service');
const payosService = require('./payos.service');
const Payment = require('./payment.model');
const DigitalProduct = require('../digital-product/digital-product.model');

const purchaseWithXu = async (req, res) => {
  try {
    const { productId } = req.body;
    const result = await paymentService.purchaseWithXu(req.userId, productId);

    // Chỉ trả về thành công, không tự động redirect
    res.status(200).json({
      success: true,
      data: result,
      message: 'Mua sản phẩm thành công'
    });
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

const getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      paymentMethod = '',
      status = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const query = {};

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    if (search) {
      const users = await User.find({
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(u => u._id);

      query.$or = [
        { user: { $in: userIds } },
        { transactionId: { $regex: search, $options: 'i' } },
        { payosOrderId: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Payment.find(query)
        .populate('user', 'fullName email avatar')
        .populate('product', 'name thumbnail price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payment.countDocuments(query)
    ]);

    // Thống kê tổng quan
    const stats = await Payment.aggregate([
      {
        $facet: {
          totalRevenue: [
            { $match: { status: 'success', paymentMethod: 'banking' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ],
          totalXuSpent: [
            { $match: { status: 'success', paymentMethod: 'xu' } },
            { $group: { _id: null, total: { $sum: '$xuAmount' } } }
          ],
          totalOrders: [
            { $match: { status: 'success' } },
            { $count: 'count' }
          ],
          pendingOrders: [
            { $match: { status: 'pending' } },
            { $count: 'count' }
          ],
          todayRevenue: [
            {
              $match: {
                status: 'success',
                paymentMethod: 'banking',
                createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
              }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        totalRevenue: stats[0]?.totalRevenue[0]?.total || 0,
        totalXuSpent: stats[0]?.totalXuSpent[0]?.total || 0,
        totalOrders: stats[0]?.totalOrders[0]?.count || 0,
        pendingOrders: stats[0]?.pendingOrders[0]?.count || 0,
        todayRevenue: stats[0]?.todayRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get all transactions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Lấy chi tiết giao dịch
const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Payment.findById(id)
      .populate('user', 'fullName email avatar phone')
      .populate('product', 'name thumbnail price description')
      .lean();

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Get transaction by id error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Cập nhật trạng thái giao dịch
const updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!['pending', 'success', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    const transaction = await Payment.findById(id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    transaction.status = status;
    if (note) transaction.adminNote = note;
    await transaction.save();

    res.status(200).json({
      success: true,
      data: transaction,
      message: 'Cập nhật trạng thái thành công'
    });
  } catch (error) {
    console.error('Update transaction status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  purchaseWithXu,
  purchaseWithPayOS,
  handleWebhook,
  checkPaymentStatus,
  checkPurchased,
  getAllTransactions,
  getTransactionById,
  updateTransactionStatus
};