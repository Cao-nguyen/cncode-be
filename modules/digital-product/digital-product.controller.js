const digitalProductService = require('./digital-product.service')

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
      message: 'Internal server error'
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
      message: error.message || 'Internal server error'
    })
  }
}

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.userId

    await digitalProductService.deleteProduct(id, userId)

    res.status(200).json({
      success: true,
      message: 'Xóa sản phẩm thành công'
    })
  } catch (error) {
    console.error('Delete product error:', error)
    res.status(400).json({
      success: false,
      message: error.message || 'Internal server error'
    })
  }
}

module.exports = {
  createProduct,
  getProducts,
  getProductBySlug,
  getUserProducts,
  updateProduct,
  deleteProduct
}