const DigitalProduct = require('./digital-product.model');
const { deleteImage, deleteMultipleImages } = require('../../utils/cloudinary');

const createProduct = async (productData, authorId) => {
  const slug = productData.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  let priceInXu = 0;
  if (productData.enableXuPayment && productData.price > 0) {
    priceInXu = Math.floor(productData.price / 10);
  }

  const product = new DigitalProduct({
    ...productData,
    slug,
    priceInXu,
    author: authorId
  });

  await product.save();
  return product;
};

const getProducts = async (filters) => {
  const { category, search, sort, status = 'published' } = filters;

  let query = { status };

  if (category && category !== 'all') {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  let sortOption = {};
  switch (sort) {
    case 'newest':
      sortOption = { createdAt: -1 };
      break;
    case 'popular':
      sortOption = { downloadCount: -1 };
      break;
    case 'price-asc':
      sortOption = { price: 1 };
      break;
    case 'price-desc':
      sortOption = { price: -1 };
      break;
    case 'rating':
      sortOption = { rating: -1 };
      break;
    default:
      sortOption = { createdAt: -1 };
  }

  const products = await DigitalProduct.find(query)
    .sort(sortOption)
    .populate('author', 'fullName avatar');

  return products;
};

const getProductBySlug = async (slug) => {
  const product = await DigitalProduct.findOne({ slug, status: 'published' })
    .populate('author', 'fullName avatar');

  if (!product) {
    throw new Error('Product not found');
  }

  return product;
};

const getProductById = async (productId, userId) => {
  const product = await DigitalProduct.findOne({ _id: productId, author: userId });
  if (!product) {
    throw new Error('Product not found');
  }
  return product;
};

const getUserProducts = async (userId) => {
  const products = await DigitalProduct.find({ author: userId })
    .sort({ createdAt: -1 })
    .populate('author', 'fullName avatar');

  return products;
};

const updateProduct = async (productId, updateData, userId) => {
  const product = await DigitalProduct.findOne({ _id: productId, author: userId });

  if (!product) {
    throw new Error('Product not found or unauthorized');
  }

  if (updateData.enableXuPayment !== undefined && updateData.price !== undefined) {
    if (updateData.enableXuPayment && updateData.price > 0) {
      updateData.priceInXu = Math.floor(updateData.price / 10);
    } else {
      updateData.priceInXu = 0;
    }
  }

  Object.assign(product, updateData);
  await product.save();
  return product;
};

const deleteProduct = async (productId, userId) => {
  const product = await DigitalProduct.findOne({ _id: productId, author: userId });

  if (!product) {
    throw new Error('Product not found or unauthorized');
  }

  // Xóa ảnh thumbnail trên Cloudinary
  if (product.thumbnail) {
    await deleteImage(product.thumbnail);
  }

  // Xóa các ảnh previewImages trên Cloudinary
  if (product.previewImages && product.previewImages.length > 0) {
    await deleteMultipleImages(product.previewImages);
  }

  await product.deleteOne();
  return product;
};

const incrementDownloadCount = async (productId) => {
  await DigitalProduct.findByIdAndUpdate(productId, {
    $inc: { downloadCount: 1 }
  });
};

module.exports = {
  createProduct,
  getProducts,
  getProductBySlug,
  getProductById,
  getUserProducts,
  updateProduct,
  deleteProduct,
  incrementDownloadCount
};