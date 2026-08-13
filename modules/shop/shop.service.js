const Product = require('./shop.model');
const ShopPurchase = require('./shopPurchase.model');
const ShopReview = require('./shopReview.model');
const CoinTransaction = require('../coin/coin.model');
const User = require('../user/user.model');
const mongoose = require('mongoose');
const { generateSlug } = require('../../utils/slug');
const { recordUniqueView } = require('../../utils/uniqueView');

function computeDiscountPrice(price, discountType = 'percent', discountValue = 0) {
    const base = Number(price) || 0;
    const discount = Number(discountValue) || 0;
    if (discount <= 0) return null;
    if (discountType === 'vnd') return Math.max(0, base - discount);
    return Math.max(0, Math.round(base * (1 - discount / 100)));
}

function getProductPayableAmount(product) {
    if (!product) return 0;
    const price = Number(product.price) || 0;
    if (product.discountPrice != null && product.discountPrice !== '') {
        return Number(product.discountPrice) || 0;
    }
    return price;
}

async function populatePurchasedProduct(productId) {
    const populated = await Product.findById(productId)
        .populate('seller', 'fullName avatar email')
        .lean();
    if (!populated) return null;
    return sanitizeProductForPublic(populated, { includeFiles: true });
}

async function countProductPurchases(productId, sellerId) {
    return ShopPurchase.countDocuments({
        productId,
        paymentStatus: 'completed',
        userId: { $ne: sellerId },
    });
}

async function syncProductPurchaseCount(productId) {
    const product = await Product.findById(productId).select('seller purchases').lean();
    if (!product) return 0;

    const count = await countProductPurchases(productId, product.seller);
    if ((product.purchases || 0) !== count) {
        await Product.findByIdAndUpdate(productId, { $set: { purchases: count } });
    }
    return count;
}

async function attachPurchaseCounts(products) {
    if (!products.length) return products;

    const productIds = products.map((product) => product._id);
    const rows = await ShopPurchase.aggregate([
        { $match: { productId: { $in: productIds }, paymentStatus: 'completed' } },
        {
            $lookup: {
                from: 'products',
                localField: 'productId',
                foreignField: '_id',
                as: 'product',
            },
        },
        { $unwind: '$product' },
        {
            $match: {
                $expr: { $ne: ['$userId', '$product.seller'] },
            },
        },
        {
            $group: {
                _id: '$productId',
                count: { $sum: 1 },
            },
        },
    ]);

    const countMap = new Map(rows.map((row) => [String(row._id), row.count]));
    return products.map((product) => ({
        ...product,
        purchases: countMap.get(String(product._id)) || 0,
    }));
}

const buyerPurchaseLookupStages = [
    {
        $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product',
        },
    },
    { $unwind: '$product' },
    {
        $match: {
            $expr: { $ne: ['$userId', '$product.seller'] },
        },
    },
];

async function finalizeDirectShopPurchase({ userId, productId, sellerId, amount, paymentMethod }) {
    if (String(userId) === String(sellerId)) {
        return { purchase: null, alreadyOwned: false, blockedSeller: true };
    }
    let purchase = await ShopPurchase.findOneAndUpdate(
        { userId, productId, paymentStatus: { $ne: 'completed' } },
        {
            $set: {
                userId,
                productId,
                sellerId,
                amount,
                paymentMethod,
                paymentStatus: 'completed',
                purchasedAt: new Date(),
            },
        },
        { new: true },
    );

    if (purchase) {
        await syncProductPurchaseCount(productId);
        return { purchase, alreadyOwned: false };
    }

    const existing = await ShopPurchase.findOne({ userId, productId });
    if (existing) {
        return { purchase: existing, alreadyOwned: existing.paymentStatus === 'completed' };
    }

    try {
        purchase = await ShopPurchase.create({
            userId,
            productId,
            sellerId,
            amount,
            paymentMethod,
            paymentStatus: 'completed',
            purchasedAt: new Date(),
        });
        await syncProductPurchaseCount(productId);
        return { purchase, alreadyOwned: false };
    } catch (error) {
        if (error?.code === 11000) {
            const duplicate = await ShopPurchase.findOne({ userId, productId });
            return {
                purchase: duplicate,
                alreadyOwned: duplicate?.paymentStatus === 'completed',
            };
        }
        throw error;
    }
}

async function finalizeShopPurchaseByOrderCode(orderCode) {
    const purchase = await ShopPurchase.findOneAndUpdate(
        { orderCode: Number(orderCode), paymentStatus: { $ne: 'completed' } },
        {
            $set: {
                paymentStatus: 'completed',
                paymentMethod: 'payos',
                purchasedAt: new Date(),
            },
        },
        { new: true },
    );

    if (purchase) {
        await syncProductPurchaseCount(purchase.productId);
    }

    return ShopPurchase.findOne({ orderCode: Number(orderCode) });
}

async function recordShopProductView(product, { userId = null, clientIp = null, userRole = null } = {}) {
    const sellerId = String(product.seller?._id || product.seller);
    const isSeller = userId && String(userId) === sellerId;
    const isAdmin = userRole === 'admin';
    if (isSeller || isAdmin) {
        return { counted: false, views: product.views || 0 };
    }

    const guestId = !userId && clientIp ? `ip:${clientIp}` : null;
    if (!userId && !guestId) {
        return { counted: false, views: product.views || 0 };
    }

    return recordUniqueView({
        targetType: 'shop_product',
        targetId: product._id,
        userId,
        guestId,
        incrementFn: async () => {
            await Product.findByIdAndUpdate(product._id, { $inc: { views: 1 } });
        },
        getViewsFn: async () => {
            const doc = await Product.findById(product._id).select('views').lean();
            return doc?.views || 0;
        },
    });
}

function normalizeProductPayload(data = {}) {
    const price = Number(data.price) || 0;
    const discountType = data.discountType === 'vnd' ? 'vnd' : 'percent';
    const discountValue = Number(data.discountValue) || 0;
    const discountPrice = computeDiscountPrice(price, discountType, discountValue);

    const normalized = {
        title: data.title,
        description: data.description,
        category: data.category,
        seller: data.seller,
        price,
        discountType,
        discountValue,
        allowCoinPayment: data.allowCoinPayment !== false,
        coverImage: data.coverImage || '',
        images: Array.isArray(data.images) ? data.images.filter(Boolean) : [],
        files: Array.isArray(data.files)
            ? data.files
                .filter((file) => file?.url)
                .map((file) => ({
                    url: String(file.url),
                    name: String(file.name || 'file'),
                    size: Number(file.size) || 0,
                    type: String(file.type || ''),
                }))
            : [],
    };

    if (discountPrice != null) {
        normalized.discountPrice = discountPrice;
    }

    if (data.preview?.url) {
        normalized.preview = {
            url: String(data.preview.url),
            name: String(data.preview.name || 'Xem trước'),
            size: Number(data.preview.size) || 0,
            type: String(data.preview.type || ''),
        };
    }

    return normalized;
}

function sanitizeProductForPublic(product, options = {}) {
    const data = typeof product.toObject === 'function' ? product.toObject() : { ...product };
    if (!options.includeFiles) {
        data.files = (data.files || []).map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
        }));
    }
    if (data.preview?.url) {
        data.preview = {
            url: data.preview.url,
            name: data.preview.name,
            size: data.preview.size,
            type: data.preview.type,
        };
    } else {
        data.preview = null;
    }
    return data;
}

class ShopService {
    // Create new product
    async createProduct(productData, userRole = 'user') {
        try {
            const normalized = normalizeProductPayload(productData);
            const slug = generateSlug(normalized.title);
            const isAdmin = userRole === 'admin';
            const product = new Product({
                ...normalized,
                slug,
                status: isAdmin ? 'approved' : 'pending',
            });
            await product.save();
            const populated = await Product.findById(product._id)
                .populate('seller', 'fullName avatar email')
                .lean();
            return {
                success: true,
                data: populated,
                message: isAdmin
                    ? 'Sản phẩm đã được đăng và hiển thị ngay'
                    : 'Sản phẩm đã được tạo và đang chờ duyệt',
            };
        } catch (error) {
            console.error('Error creating product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi tạo sản phẩm',
                errors: error.errors ? Object.values(error.errors).map((e) => e.message) : undefined,
            };
        }
    }

    // Get all products with filters
    async getProducts(filters = {}, viewer = {}) {
        try {
            const {
                page = 1,
                limit = 12,
                category,
                status,
                search,
                featured,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const { userId, userRole } = viewer;
            const query = {};
            const andConditions = [];

            if (userRole === 'admin') {
                if (status === 'all') {
                    // no status filter
                } else if (status) {
                    query.status = status;
                } else {
                    query.status = 'approved';
                }
                if (filters.seller) query.seller = filters.seller;
            } else if (userId) {
                const sellerId = mongoose.Types.ObjectId.isValid(userId)
                    ? new mongoose.Types.ObjectId(userId)
                    : userId;
                andConditions.push({
                    $or: [
                        { status: 'approved' },
                        { status: 'pending', seller: sellerId },
                        { status: 'rejected', seller: sellerId },
                    ],
                });
            } else {
                query.status = 'approved';
            }

            if (category) andConditions.push({ category });
            if (featured !== undefined) andConditions.push({ featured });
            if (search) andConditions.push({ $text: { $search: search } });

            if (andConditions.length > 0) {
                query.$and = andConditions;
            }

            const skip = (page - 1) * limit;
            const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

            const [products, total] = await Promise.all([
                Product.find(query)
                    .populate('seller', 'fullName avatar email')
                    .sort(sort)
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Product.countDocuments(query)
            ]);

            const sanitized = await attachPurchaseCounts(
                products.map((p) => sanitizeProductForPublic(p)),
            );

            return {
                success: true,
                data: sanitized,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                    limit: parseInt(limit)
                }
            };
        } catch (error) {
            console.error('Error getting products:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi lấy danh sách sản phẩm'
            };
        }
    }

    // Get single product by ID
    async getProductById(productId, userId = null, userRole = null, clientIp = null) {
        try {
            const product = await Product.findById(productId)
                .populate('seller', 'fullName avatar email role');

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            if (product.status !== 'approved') {
                const sellerId = String(product.seller?._id || product.seller);
                const isSeller = userId && String(userId) === sellerId;
                const isAdmin = userRole === 'admin';
                if (!isSeller && !isAdmin) {
                    return {
                        success: false,
                        message: 'Không tìm thấy sản phẩm',
                    };
                }
            }

            const viewResult = await recordShopProductView(product, { userId, clientIp, userRole });
            product.views = viewResult.views;

            const includeFiles = userRole === 'admin' || await this.canAccessFiles(product, userId);
            product.purchases = await syncProductPurchaseCount(product._id);

            return {
                success: true,
                data: sanitizeProductForPublic(product, { includeFiles }),
                owned: includeFiles,
            };
        } catch (error) {
            console.error('Error getting product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi lấy thông tin sản phẩm'
            };
        }
    }

    // Get single product by slug
    async getProductBySlug(slug, userId = null, userRole = null, clientIp = null) {
        try {
            const product = await Product.findOne({ slug })
                .populate('seller', 'fullName avatar email role');

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            if (product.status !== 'approved') {
                const sellerId = String(product.seller?._id || product.seller);
                const isSeller = userId && String(userId) === sellerId;
                const isAdmin = userRole === 'admin';
                if (!isSeller && !isAdmin) {
                    return {
                        success: false,
                        message: 'Không tìm thấy sản phẩm',
                    };
                }
            }

            const viewResult = await recordShopProductView(product, { userId, clientIp, userRole });
            product.views = viewResult.views;

            const includeFiles = await this.canAccessFiles(product, userId);
            product.purchases = await syncProductPurchaseCount(product._id);

            return {
                success: true,
                data: sanitizeProductForPublic(product, { includeFiles }),
                owned: includeFiles,
            };
        } catch (error) {
            console.error('Error getting product by slug:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi lấy thông tin sản phẩm'
            };
        }
    }

    async canAccessFiles(product, userId) {
        if (!userId) return false;
        const userIdStr = String(userId);
        if (String(product.seller?._id || product.seller) === userIdStr) return true;
        if (product.status !== 'approved') return false;

        const purchase = await ShopPurchase.findOne({
            userId,
            productId: product._id,
            paymentStatus: 'completed',
        }).lean();
        return !!purchase;
    }

    async getUserProducts(userId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                status,
            } = filters;

            const query = {
                seller: mongoose.Types.ObjectId.isValid(userId)
                    ? new mongoose.Types.ObjectId(userId)
                    : userId,
            };
            if (status && status !== 'all') query.status = status;

            const skip = (page - 1) * limit;
            const [products, total] = await Promise.all([
                Product.find(query)
                    .populate('seller', 'fullName avatar email')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Product.countDocuments(query),
            ]);

            return {
                success: true,
                data: products,
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                    limit: parseInt(limit),
                },
            };
        } catch (error) {
            console.error('Error getting user products:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi lấy sản phẩm của bạn',
            };
        }
    }

    async recordProductDownload(productId, userId, fileIndex) {
        try {
            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return { success: false, message: 'ID sản phẩm không hợp lệ' };
            }

            const product = await Product.findById(productId).select('seller files downloads status');
            if (!product) {
                return { success: false, message: 'Sản phẩm không tồn tại' };
            }

            const index = Number(fileIndex);
            if (!Number.isInteger(index) || index < 0 || index >= (product.files?.length || 0)) {
                return { success: false, message: 'File không hợp lệ' };
            }

            const isSeller = String(product.seller) === String(userId);
            if (!isSeller) {
                const purchase = await ShopPurchase.findOne({
                    userId,
                    productId,
                    paymentStatus: 'completed',
                }).lean();
                if (!purchase) {
                    return { success: false, message: 'Bạn chưa sở hữu sản phẩm này' };
                }
            }

            // Chỉ tính lượt tải từ người mua, không tính người bán
            if (isSeller) {
                return {
                    success: true,
                    data: { downloads: product.downloads || 0, counted: false },
                };
            }

            const updated = await Product.findByIdAndUpdate(
                productId,
                { $inc: { downloads: 1 } },
                { new: true },
            ).select('downloads');

            return {
                success: true,
                data: {
                    downloads: updated?.downloads || 0,
                    counted: true,
                },
            };
        } catch (error) {
            console.error('Error recording product download:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi ghi nhận lượt tải',
            };
        }
    }

    async getPurchaseStatus(productId, userId) {
        try {
            const product = await Product.findById(productId).select('price discountPrice allowCoinPayment seller status title');
            if (!product) {
                return { success: false, message: 'Không tìm thấy sản phẩm' };
            }

            if (String(product.seller) === String(userId)) {
                return {
                    success: true,
                    data: {
                        owned: true,
                        isSeller: true,
                        amount: getProductPayableAmount(product),
                    },
                };
            }

            const purchase = await ShopPurchase.findOne({
                userId,
                productId,
                paymentStatus: 'completed',
            }).lean();

            return {
                success: true,
                data: {
                    owned: !!purchase,
                    isSeller: false,
                    amount: getProductPayableAmount(product),
                    allowCoinPayment: product.allowCoinPayment !== false,
                    purchase,
                },
            };
        } catch (error) {
            console.error('Error getting purchase status:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi kiểm tra trạng thái mua',
            };
        }
    }

    async purchaseProduct(productId, userId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(productId)) {
                return { success: false, message: 'ID sản phẩm không hợp lệ' };
            }

            const [product, user] = await Promise.all([
                Product.findOne({ _id: productId, status: 'approved' }),
                User.findById(userId),
            ]);

            if (!product) {
                return { success: false, message: 'Sản phẩm không tồn tại hoặc chưa được duyệt' };
            }
            if (!user) {
                return { success: false, message: 'Người dùng không tồn tại' };
            }
            if (String(product.seller) === String(userId)) {
                return { success: false, message: 'Bạn không thể mua sản phẩm của chính mình' };
            }

            const existing = await ShopPurchase.findOne({
                userId,
                productId,
                paymentStatus: 'completed',
            }).lean();
            if (existing) {
                return {
                    success: true,
                    data: {
                        purchase: existing,
                        product: await populatePurchasedProduct(productId),
                        alreadyOwned: true,
                        coins: user.coins ?? 0,
                    },
                    message: 'Bạn đã sở hữu sản phẩm này',
                };
            }

            const amount = getProductPayableAmount(product);

            if (amount > 0 && product.allowCoinPayment === false) {
                return {
                    success: false,
                    message: 'Sản phẩm này không hỗ trợ thanh toán bằng xu',
                };
            }

            if (amount <= 0) {
                const { purchase, alreadyOwned } = await finalizeDirectShopPurchase({
                    userId,
                    productId,
                    sellerId: product.seller,
                    amount: 0,
                    paymentMethod: 'free',
                });

                if (alreadyOwned) {
                    return {
                        success: true,
                        data: {
                            purchase,
                            product: await populatePurchasedProduct(productId),
                            alreadyOwned: true,
                            coins: user.coins ?? 0,
                        },
                        message: 'Bạn đã sở hữu sản phẩm này',
                    };
                }

                return {
                    success: true,
                    data: {
                        purchase,
                        product: await populatePurchasedProduct(productId),
                        alreadyOwned: false,
                        coins: user.coins ?? 0,
                    },
                    message: 'Tải xuống miễn phí thành công',
                };
            }

            const buyerCoins = Number(user.coins) || 0;
            if (buyerCoins < amount) {
                return {
                    success: false,
                    message: `Không đủ xu. Cần ${amount.toLocaleString('vi-VN')} xu, hiện có ${buyerCoins.toLocaleString('vi-VN')} xu`,
                };
            }

            const updatedBuyer = await User.findOneAndUpdate(
                { _id: userId, coins: { $gte: amount } },
                { $inc: { coins: -amount } },
                { new: true },
            );

            if (!updatedBuyer) {
                return { success: false, message: `Không đủ xu. Cần ${amount.toLocaleString('vi-VN')} xu` };
            }

            try {
                await CoinTransaction.create({
                    userId,
                    type: 'debit',
                    amount,
                    reason: `Mua sản phẩm "${product.title}"`,
                    relatedId: product._id,
                    relatedType: 'cuahangso',
                    balanceAfter: updatedBuyer.coins,
                });

                const { purchase, alreadyOwned } = await finalizeDirectShopPurchase({
                    userId,
                    productId,
                    sellerId: product.seller,
                    amount,
                    paymentMethod: 'coin',
                });

                if (alreadyOwned) {
                    await User.findByIdAndUpdate(userId, { $inc: { coins: amount } });
                    return {
                        success: true,
                        data: {
                            purchase,
                            product: await populatePurchasedProduct(productId),
                            alreadyOwned: true,
                            coins: (updatedBuyer.coins ?? 0) + amount,
                        },
                        message: 'Bạn đã sở hữu sản phẩm này',
                    };
                }

                const updatedSeller = await User.findByIdAndUpdate(
                    product.seller,
                    { $inc: { coins: amount } },
                    { new: true },
                );

                if (updatedSeller) {
                    await CoinTransaction.create({
                        userId: product.seller,
                        type: 'credit',
                        amount,
                        reason: `Bán sản phẩm "${product.title}"`,
                        relatedId: product._id,
                        relatedType: 'cuahangso',
                        balanceAfter: updatedSeller.coins,
                    });
                }

                return {
                    success: true,
                    data: {
                        purchase,
                        product: await populatePurchasedProduct(productId),
                        alreadyOwned: false,
                        coins: updatedBuyer.coins,
                    },
                    message: 'Mua sản phẩm thành công',
                };
            } catch (innerError) {
                await User.findByIdAndUpdate(userId, { $inc: { coins: amount } });
                console.error('Purchase rollback after coin debit:', innerError);
                throw innerError;
            }
        } catch (error) {
            console.error('Error purchasing product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi mua sản phẩm',
            };
        }
    }

    async createPayOSPurchase(productId, userId) {
        try {
            const { PayOS } = require('@payos/node');
            const payos = new PayOS({
                clientId: process.env.PAYOS_CLIENT_ID,
                apiKey: process.env.PAYOS_API_KEY,
                checksumKey: process.env.PAYOS_CHECKSUM_KEY,
            });

            const product = await Product.findOne({ _id: productId, status: 'approved' });
            if (!product) {
                return { success: false, message: 'Sản phẩm không tồn tại hoặc chưa được duyệt' };
            }
            if (String(product.seller) === String(userId)) {
                return { success: false, message: 'Bạn không thể mua sản phẩm của chính mình' };
            }

            const existing = await ShopPurchase.findOne({
                userId,
                productId,
                paymentStatus: 'completed',
            }).lean();
            if (existing) {
                return {
                    success: true,
                    data: {
                        purchase: existing,
                        product: await populatePurchasedProduct(productId),
                        alreadyOwned: true,
                    },
                    message: 'Bạn đã sở hữu sản phẩm này',
                };
            }

            const amount = getProductPayableAmount(product);
            if (amount <= 0) {
                return this.purchaseProduct(productId, userId);
            }

            const orderCode = Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const params = new URLSearchParams({
                orderCode: String(orderCode),
                product: product.slug || String(product._id),
                type: 'cuahangso',
            });

            const paymentLink = await payos.paymentRequests.create({
                orderCode,
                amount,
                description: `SHOP${String(orderCode).slice(-10)}`,
                returnUrl: `${frontendUrl}/payment/success?${params.toString()}`,
                cancelUrl: `${frontendUrl}/payment/cancel?${params.toString()}`,
                items: [{ name: product.title, quantity: 1, price: amount }],
            });

            const purchase = await ShopPurchase.findOneAndUpdate(
                { userId, productId },
                {
                    $set: {
                        userId,
                        productId,
                        sellerId: product.seller,
                        paymentMethod: 'payos',
                        paymentStatus: 'pending',
                        orderCode,
                        amount,
                    },
                },
                { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
            );

            return {
                success: true,
                data: {
                    purchase,
                    checkoutUrl: paymentLink.checkoutUrl,
                    paymentLink,
                    alreadyOwned: false,
                },
                message: 'Tạo liên kết thanh toán thành công',
            };
        } catch (error) {
            console.error('Error creating PayOS shop purchase:', error);
            return {
                success: false,
                message: error.message || 'Không tạo được thanh toán',
            };
        }
    }

    async completePurchaseByOrderCode(orderCode) {
        return finalizeShopPurchaseByOrderCode(orderCode);
    }

    // Update product
    async updateProduct(productId, updateData, userId, userRole) {
        try {
            const product = await Product.findById(productId);

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            // Check permissions
            if (userRole !== 'admin' && product.seller.toString() !== userId) {
                return {
                    success: false,
                    message: 'Bạn không có quyền chỉnh sửa sản phẩm này'
                };
            }

            if (userRole !== 'admin' && !['pending', 'rejected', 'approved'].includes(product.status)) {
                return {
                    success: false,
                    message: 'Không thể cập nhật sản phẩm này',
                };
            }

            const wasRejected = product.status === 'rejected';
            const wasApproved = product.status === 'approved';
            const payload = { ...updateData };
            if (userRole !== 'admin') {
                ['status', 'rejectionReason', 'seller', 'views', 'purchases', 'downloads', 'slug'].forEach((key) => {
                    delete payload[key];
                });
            }

            Object.keys(payload).forEach((key) => {
                if (payload[key] !== undefined) {
                    product[key] = payload[key];
                }
            });

            if (
                payload.price !== undefined
                || payload.discountType !== undefined
                || payload.discountValue !== undefined
            ) {
                product.discountPrice = computeDiscountPrice(
                    product.price,
                    product.discountType,
                    product.discountValue,
                );
            }

            let resubmitted = false;
            if (userRole !== 'admin' && (wasRejected || wasApproved)) {
                product.status = 'pending';
                product.rejectionReason = null;
                resubmitted = true;
            }

            await product.save();

            return {
                success: true,
                data: product,
                message: resubmitted
                    ? 'Cập nhật thành công. Sản phẩm đã được gửi duyệt lại.'
                    : 'Cập nhật sản phẩm thành công',
            };
        } catch (error) {
            console.error('Error updating product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi cập nhật sản phẩm'
            };
        }
    }

    // Delete product
    async deleteProduct(productId, userId, userRole) {
        try {
            const product = await Product.findById(productId);

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            // Check permissions
            if (userRole !== 'admin' && product.seller.toString() !== userId) {
                return {
                    success: false,
                    message: 'Bạn không có quyền xóa sản phẩm này'
                };
            }

            await Product.findByIdAndDelete(productId);

            return {
                success: true,
                message: 'Xóa sản phẩm thành công'
            };
        } catch (error) {
            console.error('Error deleting product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi xóa sản phẩm'
            };
        }
    }

    // Approve product (admin only)
    async approveProduct(productId) {
        try {
            const product = await Product.findById(productId);

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            if (product.status === 'approved') {
                return {
                    success: false,
                    message: 'Sản phẩm đã được duyệt',
                };
            }

            const wasRejected = product.status === 'rejected';

            const approved = await Product.findByIdAndUpdate(
                productId,
                { status: 'approved', rejectionReason: null },
                { new: true }
            ).populate('seller', 'fullName email');

            return {
                success: true,
                data: approved,
                message: wasRejected ? 'Đã duyệt lại sản phẩm' : 'Đã duyệt sản phẩm',
            };
        } catch (error) {
            console.error('Error approving product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi duyệt sản phẩm'
            };
        }
    }

    // Reject product (admin only)
    async rejectProduct(productId, reason) {
        try {
            const product = await Product.findByIdAndUpdate(
                productId,
                { status: 'rejected', rejectionReason: reason },
                { new: true }
            ).populate('seller', 'fullName email');

            if (!product) {
                return {
                    success: false,
                    message: 'Không tìm thấy sản phẩm'
                };
            }

            return {
                success: true,
                data: product,
                message: 'Đã từ chối sản phẩm'
            };
        } catch (error) {
            console.error('Error rejecting product:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi từ chối sản phẩm'
            };
        }
    }

    // Get stats (admin only)
    async getStats() {
        try {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
            sixMonthsAgo.setDate(1);
            sixMonthsAgo.setHours(0, 0, 0, 0);

            const monthBuckets = [];
            const now = new Date();
            for (let i = 5; i >= 0; i -= 1) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                monthBuckets.push({
                    key: `${date.getFullYear()}-${date.getMonth() + 1}`,
                    label: date.toLocaleDateString('vi-VN', { month: 'short', year: '2-digit' }),
                    year: date.getFullYear(),
                    month: date.getMonth() + 1,
                });
            }

            const [
                totalProducts,
                pendingProducts,
                approvedProducts,
                rejectedProducts,
                totalViews,
                totalPurchases,
                totalDownloads,
                totalRevenueAgg,
                categoryCounts,
                topProducts,
                revenueTrendRaw,
                categoryRevenue,
            ] = await Promise.all([
                Product.countDocuments(),
                Product.countDocuments({ status: 'pending' }),
                Product.countDocuments({ status: 'approved' }),
                Product.countDocuments({ status: 'rejected' }),
                Product.aggregate([
                    { $group: { _id: null, total: { $sum: '$views' } } },
                ]),
                ShopPurchase.aggregate([
                    { $match: { paymentStatus: 'completed' } },
                    ...buyerPurchaseLookupStages,
                    { $count: 'total' },
                ]),
                Product.aggregate([
                    { $group: { _id: null, total: { $sum: '$downloads' } } },
                ]),
                ShopPurchase.aggregate([
                    { $match: { paymentStatus: 'completed' } },
                    ...buyerPurchaseLookupStages,
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ]),
                Product.aggregate([
                    { $group: { _id: '$category', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ]),
                ShopPurchase.aggregate([
                    { $match: { paymentStatus: 'completed' } },
                    ...buyerPurchaseLookupStages,
                    {
                        $group: {
                            _id: '$productId',
                            revenue: { $sum: '$amount' },
                            orders: { $sum: 1 },
                            title: { $first: '$product.title' },
                            category: { $first: '$product.category' },
                            views: { $first: '$product.views' },
                            downloads: { $first: '$product.downloads' },
                        },
                    },
                    { $sort: { orders: -1, revenue: -1 } },
                    { $limit: 8 },
                    {
                        $project: {
                            productId: '$_id',
                            title: 1,
                            category: 1,
                            purchases: '$orders',
                            revenue: 1,
                            views: 1,
                            downloads: 1,
                        },
                    },
                ]),
                ShopPurchase.aggregate([
                    {
                        $match: {
                            paymentStatus: 'completed',
                            purchasedAt: { $gte: sixMonthsAgo },
                        },
                    },
                    ...buyerPurchaseLookupStages,
                    {
                        $group: {
                            _id: {
                                year: { $year: '$purchasedAt' },
                                month: { $month: '$purchasedAt' },
                            },
                            revenue: { $sum: '$amount' },
                            orders: { $sum: 1 },
                        },
                    },
                    { $sort: { '_id.year': 1, '_id.month': 1 } },
                ]),
                ShopPurchase.aggregate([
                    { $match: { paymentStatus: 'completed' } },
                    ...buyerPurchaseLookupStages,
                    {
                        $group: {
                            _id: '$product.category',
                            revenue: { $sum: '$amount' },
                            orders: { $sum: 1 },
                        },
                    },
                    { $sort: { revenue: -1 } },
                ]),
            ]);

            const revenueTrendMap = new Map(
                revenueTrendRaw.map((item) => [
                    `${item._id.year}-${item._id.month}`,
                    { revenue: item.revenue || 0, orders: item.orders || 0 },
                ]),
            );

            const revenueTrend = monthBuckets.map((bucket) => {
                const found = revenueTrendMap.get(bucket.key);
                return {
                    label: bucket.label,
                    revenue: found?.revenue || 0,
                    orders: found?.orders || 0,
                };
            });

            return {
                success: true,
                data: {
                    totalProducts,
                    pendingProducts,
                    approvedProducts,
                    rejectedProducts,
                    totalViews: totalViews[0]?.total || 0,
                    totalPurchases: totalPurchases[0]?.total || 0,
                    totalDownloads: totalDownloads[0]?.total || 0,
                    totalRevenue: totalRevenueAgg[0]?.total || 0,
                    categoryCounts,
                    topProducts,
                    revenueTrend,
                    categoryRevenue: categoryRevenue.map((item) => ({
                        category: item._id || 'Khác',
                        revenue: item.revenue || 0,
                        orders: item.orders || 0,
                    })),
                },
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi lấy thống kê',
            };
        }
    }

    async assertPurchasedForReview(productId, userId) {
        const product = await Product.findById(productId).select('seller status');
        if (!product || product.status !== 'approved') {
            return { ok: false, message: 'Sản phẩm không tồn tại hoặc chưa được duyệt' };
        }
        if (String(product.seller) === String(userId)) {
            return { ok: false, message: 'Người bán không thể đánh giá sản phẩm của mình' };
        }
        const purchase = await ShopPurchase.findOne({
            userId,
            productId,
            paymentStatus: 'completed',
        });
        if (!purchase) {
            return { ok: false, message: 'Chỉ người đã mua sản phẩm mới được đánh giá' };
        }
        return { ok: true, product };
    }

    async getProductReviews(productId, { page = 1, limit = 10 } = {}) {
        try {
            const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
            const [reviews, total, stats] = await Promise.all([
                ShopReview.find({ productId })
                    .populate('userId', 'fullName avatar')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(Number(limit))
                    .lean(),
                ShopReview.countDocuments({ productId }),
                ShopReview.getStatsForProduct(productId),
            ]);

            const data = reviews.map((review) => ({
                _id: review._id,
                rating: review.rating,
                content: review.content,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
                user: review.userId
                    ? {
                        _id: review.userId._id,
                        fullName: review.userId.fullName,
                        avatar: review.userId.avatar,
                    }
                    : null,
            }));

            return {
                success: true,
                data,
                stats,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit)) || 1,
                },
            };
        } catch (error) {
            console.error('Error getting product reviews:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi lấy đánh giá',
            };
        }
    }

    async getMyProductReview(productId, userId) {
        try {
            if (!userId) {
                return {
                    success: true,
                    data: { canReview: false, myReview: null },
                };
            }

            const [purchase, myReview, product] = await Promise.all([
                ShopPurchase.findOne({ userId, productId, paymentStatus: 'completed' }),
                ShopReview.findOne({ productId, userId }).lean(),
                Product.findById(productId).select('seller status'),
            ]);

            const isSeller = product && String(product.seller) === String(userId);
            const canReview = !!purchase && !isSeller && product?.status === 'approved';

            return {
                success: true,
                data: {
                    canReview,
                    myReview: myReview
                        ? {
                            _id: myReview._id,
                            rating: myReview.rating,
                            content: myReview.content,
                            createdAt: myReview.createdAt,
                            updatedAt: myReview.updatedAt,
                        }
                        : null,
                },
            };
        } catch (error) {
            console.error('Error getting my product review:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi lấy đánh giá của bạn',
            };
        }
    }

    async createProductReview(productId, userId, { rating, content }) {
        try {
            const stars = Number(rating);
            const text = String(content || '').trim();
            if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
                return { success: false, message: 'Đánh giá phải từ 1 đến 5 sao' };
            }
            if (!text || text.length < 5) {
                return { success: false, message: 'Nội dung đánh giá phải có ít nhất 5 ký tự' };
            }
            if (text.length > 1000) {
                return { success: false, message: 'Nội dung đánh giá tối đa 1000 ký tự' };
            }

            const access = await this.assertPurchasedForReview(productId, userId);
            if (!access.ok) {
                return { success: false, message: access.message };
            }

            const existing = await ShopReview.findOne({ productId, userId });
            if (existing) {
                return { success: false, message: 'Bạn đã đánh giá sản phẩm này rồi' };
            }

            const review = await ShopReview.create({
                productId,
                userId,
                rating: stars,
                content: text,
            });

            const populated = await ShopReview.findById(review._id)
                .populate('userId', 'fullName avatar')
                .lean();

            const stats = await ShopReview.getStatsForProduct(productId);

            return {
                success: true,
                data: {
                    _id: populated._id,
                    rating: populated.rating,
                    content: populated.content,
                    createdAt: populated.createdAt,
                    updatedAt: populated.updatedAt,
                    user: populated.userId
                        ? {
                            _id: populated.userId._id,
                            fullName: populated.userId.fullName,
                            avatar: populated.userId.avatar,
                        }
                        : null,
                },
                stats,
                message: 'Đánh giá thành công',
            };
        } catch (error) {
            if (error?.code === 11000) {
                return { success: false, message: 'Bạn đã đánh giá sản phẩm này rồi' };
            }
            console.error('Error creating product review:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi gửi đánh giá',
            };
        }
    }

    async updateProductReview(productId, userId, reviewId, { rating, content }) {
        try {
            const review = await ShopReview.findOne({ _id: reviewId, productId, userId });
            if (!review) {
                return { success: false, message: 'Không tìm thấy đánh giá' };
            }

            if (rating !== undefined) {
                const stars = Number(rating);
                if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
                    return { success: false, message: 'Đánh giá phải từ 1 đến 5 sao' };
                }
                review.rating = stars;
            }

            if (content !== undefined) {
                const text = String(content).trim();
                if (!text || text.length < 5) {
                    return { success: false, message: 'Nội dung đánh giá phải có ít nhất 5 ký tự' };
                }
                if (text.length > 1000) {
                    return { success: false, message: 'Nội dung đánh giá tối đa 1000 ký tự' };
                }
                review.content = text;
            }

            await review.save();

            const populated = await ShopReview.findById(review._id)
                .populate('userId', 'fullName avatar')
                .lean();

            const stats = await ShopReview.getStatsForProduct(productId);

            return {
                success: true,
                data: {
                    _id: populated._id,
                    rating: populated.rating,
                    content: populated.content,
                    createdAt: populated.createdAt,
                    updatedAt: populated.updatedAt,
                    user: populated.userId
                        ? {
                            _id: populated.userId._id,
                            fullName: populated.userId.fullName,
                            avatar: populated.userId.avatar,
                        }
                        : null,
                },
                stats,
                message: 'Cập nhật đánh giá thành công',
            };
        } catch (error) {
            console.error('Error updating product review:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi cập nhật đánh giá',
            };
        }
    }

    async deleteProductReview(productId, userId, reviewId) {
        try {
            const review = await ShopReview.findOneAndDelete({ _id: reviewId, productId, userId });
            if (!review) {
                return { success: false, message: 'Không tìm thấy đánh giá' };
            }

            const stats = await ShopReview.getStatsForProduct(productId);

            return {
                success: true,
                stats,
                message: 'Đã xóa đánh giá',
            };
        } catch (error) {
            console.error('Error deleting product review:', error);
            return {
                success: false,
                message: error.message || 'Lỗi khi xóa đánh giá',
            };
        }
    }
}

module.exports = new ShopService();