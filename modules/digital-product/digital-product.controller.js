// modules/digital-product/digital-product.controller.js
const digitalProductService = require('./digital-product.service')
const Review = require('../review/review.model')
const Payment = require('../payment/payment.model')
const DigitalProduct = require('./digital-product.model')

const createProduct = async (req, res) => {
  try {
    const userId = req.userId
    const productData = req.body

    if (!productData.name || !productData.description || !productData.price) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc'
      })
    }

    const product = await digitalProductService.createProduct(productData, userId)

    res.status(201).json({
      success: true,
      data: product,
      message: 'Tạo sản phẩm thành công'
    })
  } catch (error) {
    console.error('Create product error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    })
  }
}

const getProducts = async (req, res) => {
  try {
    const { category, search, sort } = req.query
    const products = await digitalProductService.getProducts({ category, search, sort })

    res.status(200).json({
      success: true,
      data: products,
      message: 'Lấy danh sách sản phẩm thành công'
    })
  } catch (error) {
    console.error('Get products error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params
    const product = await digitalProductService.getProductBySlug(slug)

    res.status(200).json({
      success: true,
      data: product,
      message: 'Lấy thông tin sản phẩm thành công'
    })
  } catch (error) {
    console.error('Get product error:', error)
    res.status(404).json({
      success: false,
      message: error.message || 'Product not found'
    })
  }
}

const getUserProducts = async (req, res) => {
  try {
    const userId = req.userId
    const products = await digitalProductService.getUserProducts(userId)

    res.status(200).json({
      success: true,
      data: products,
      message: 'Lấy danh sách sản phẩm thành công'
    })
  } catch (error) {
    console.error('Get user products error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.userId
    const updateData = req.body

    const product = await digitalProductService.updateProduct(id, updateData, userId)

    res.status(200).json({
      success: true,
      data: product,
      message: 'Cập nhật sản phẩm thành công'
    })
  } catch (error) {
    console.error('Update product error:', error)
    res.status(400).json({
      success: false,
      message: error.message
    })
  }
}

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    await digitalProductService.deleteProduct(id, userId);

    res.status(200).json({
      success: true,
      message: 'Xóa sản phẩm thành công'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// THÊM METHOD NÀY ĐỂ LẤY SẢN PHẨM THEO ID CHO TRANG EDIT
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const product = await digitalProductService.getProductById(id, userId);

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product by id error:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

const getReviews = async (req, res) => {
  try {
    const { productId } = req.params

    const product = await DigitalProduct.findById(productId)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      })
    }

    const reviews = await Review.find({ product: productId })
      .populate('user', 'fullName email')
      .sort({ createdAt: -1 })

    res.status(200).json({
      success: true,
      data: reviews
    })
  } catch (error) {
    console.error('Get reviews error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

const submitReview = async (req, res) => {
  try {
    const { rating, comment } = req.body
    const { productId } = req.params
    const userId = req.userId

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating phải từ 1 đến 5'
      })
    }

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập nội dung đánh giá'
      })
    }

    const product = await DigitalProduct.findById(productId)
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      })
    }

    const payment = await Payment.findOne({
      user: userId,
      product: productId,
      status: 'success'
    })

    if (!payment) {
      return res.status(403).json({
        success: false,
        message: 'Bạn cần mua sản phẩm để đánh giá'
      })
    }

    const existingReview = await Review.findOne({
      user: userId,
      product: productId
    })

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá sản phẩm này rồi'
      })
    }

    const review = await Review.create({
      user: userId,
      product: productId,
      rating,
      comment: comment.trim()
    })

    const allReviews = await Review.find({ product: productId })
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0)
    const avgRating = totalRating / allReviews.length

    await DigitalProduct.findByIdAndUpdate(productId, {
      rating: Number(avgRating.toFixed(1)),
      reviewCount: allReviews.length
    })

    const populatedReview = await Review.findById(review._id)
      .populate('user', 'fullName email')

    res.status(201).json({
      success: true,
      data: populatedReview,
      message: 'Đánh giá thành công'
    })
  } catch (error) {
    console.error('Submit review error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Có lỗi xảy ra khi gửi đánh giá'
    })
  }
}

module.exports = {
  createProduct,
  getProducts,
  getProductBySlug,
  getProductById,
  getUserProducts,
  updateProduct,
  deleteProduct,
  getReviews,
  submitReview
}