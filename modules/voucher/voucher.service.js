// modules/voucher/voucher.service.js
const Voucher = require('./voucher.model');
const UserVoucher = require('./userVoucher.model');
const User = require('../user/user.model');

class VoucherService {
    // ============ USER SERVICE ============

    async getUserVouchers(userId) {
        // Update expired status
        await UserVoucher.updateMany(
            { userId, status: 'available', expiresAt: { $lt: new Date() } },
            { status: 'expired' }
        );

        // Chỉ lấy voucher chưa dùng và chưa hết hạn
        const userVouchers = await UserVoucher.find({
            userId,
            status: 'available',
            expiresAt: { $gt: new Date() }
        }).populate('voucherId').sort({ expiresAt: 1 });

        return userVouchers;
    }

    async getAllUserVouchers(userId, status = null) {
        const query = { userId };
        if (status && status !== 'all') {
            query.status = status;
        }

        await UserVoucher.updateMany(
            { userId, status: 'available', expiresAt: { $lt: new Date() } },
            { status: 'expired' }
        );

        const userVouchers = await UserVoucher.find(query)
            .populate('voucherId')
            .sort({ createdAt: -1 });

        return userVouchers;
    }

    async applyVoucher(userId, code, orderTotal) {
        const userVoucher = await UserVoucher.findOne({
            code,
            userId,
            status: 'available'
        }).populate('voucherId');

        if (!userVoucher) {
            throw new Error('Mã giảm giá không hợp lệ hoặc đã hết hạn');
        }

        const voucher = userVoucher.voucherId;

        // Check expiry
        if (new Date(voucher.expiryDate) < new Date()) {
            userVoucher.status = 'expired';
            await userVoucher.save();
            throw new Error('Mã giảm giá đã hết hạn');
        }

        // Check min order
        if (orderTotal < voucher.minOrder) {
            throw new Error(`Đơn hàng tối thiểu ${voucher.minOrder.toLocaleString()}đ để sử dụng mã này`);
        }

        // Calculate discount
        let discount = 0;
        if (voucher.discountType === 'percentage') {
            discount = (orderTotal * voucher.discountValue) / 100;
            if (voucher.maxDiscount) {
                discount = Math.min(discount, voucher.maxDiscount);
            }
        } else if (voucher.discountType === 'fixed') {
            discount = Math.min(voucher.discountValue, orderTotal);
        } else if (voucher.discountType === 'freeship') {
            discount = 30000;
        }

        const finalAmount = orderTotal - discount;

        return {
            discount,
            finalAmount: Math.max(0, finalAmount),
            voucher: userVoucher,
            discountValue: voucher.discountValue,
            discountType: voucher.discountType
        };
    }

    async markVoucherAsUsed(userId, code) {
        const userVoucher = await UserVoucher.findOne({ code, userId, status: 'available' });
        if (!userVoucher) {
            throw new Error('Không tìm thấy voucher');
        }

        userVoucher.status = 'used';
        userVoucher.usedAt = new Date();
        await userVoucher.save();

        await Voucher.findByIdAndUpdate(userVoucher.voucherId, {
            $inc: { usedCount: 1 }
        });

        return userVoucher;
    }

    // ============ ADMIN SERVICE ============

    async getAllVouchers(filters = {}) {
        const query = {};
        if (filters.status && filters.status !== 'all' && filters.status !== '') {
            query.status = filters.status;
        }
        if (filters.search) {
            query.$or = [
                { title: { $regex: filters.search, $options: 'i' } },
                { code: { $regex: filters.search, $options: 'i' } }
            ];
        }

        const vouchers = await Voucher.find(query)
            .populate('createdBy', 'fullName email')
            .populate('assignedUsers', 'fullName email')
            .sort({ createdAt: -1 });

        return vouchers;
    }

    async getVoucherById(id) {
        const voucher = await Voucher.findById(id)
            .populate('createdBy', 'fullName email')
            .populate('assignedUsers', 'fullName email');

        if (!voucher) {
            throw new Error('Không tìm thấy voucher');
        }

        return voucher;
    }

    async createVoucher(adminId, data) {
        const existing = await Voucher.findOne({ code: data.code.toUpperCase() });
        if (existing) {
            throw new Error('Mã voucher đã tồn tại');
        }

        const voucher = new Voucher({
            ...data,
            code: data.code.toUpperCase(),
            createdBy: adminId,
            status: new Date(data.expiryDate) < new Date() ? 'expired' : 'active'
        });

        await voucher.save();

        if (data.assignedUsers && data.assignedUsers.length > 0) {
            await this.assignVoucherToUsers(voucher._id, data.assignedUsers);
        }

        if (data.isGlobal) {
            const allUsers = await User.find({ role: { $ne: 'admin' } }).select('_id');
            const userIds = allUsers.map(u => u._id);
            await this.assignVoucherToUsers(voucher._id, userIds);
        }

        return await Voucher.findById(voucher._id).populate('createdBy', 'fullName email');
    }

    async updateVoucher(id, data) {
        const voucher = await Voucher.findById(id);
        if (!voucher) {
            throw new Error('Không tìm thấy voucher');
        }

        if (data.code && data.code !== voucher.code) {
            const existing = await Voucher.findOne({ code: data.code.toUpperCase() });
            if (existing) {
                throw new Error('Mã voucher đã tồn tại');
            }
            data.code = data.code.toUpperCase();
        }

        if (data.expiryDate) {
            data.status = new Date(data.expiryDate) < new Date() ? 'expired' : 'active';
        }

        Object.assign(voucher, data);
        await voucher.save();

        return await Voucher.findById(id).populate('createdBy', 'fullName email');
    }

    async deleteVoucher(id) {
        const voucher = await Voucher.findById(id);
        if (!voucher) {
            throw new Error('Không tìm thấy voucher');
        }

        await UserVoucher.deleteMany({ voucherId: id });
        await voucher.deleteOne();

        return true;
    }

    async assignVoucherToUsers(voucherId, userIds) {
        const voucher = await Voucher.findById(voucherId);
        if (!voucher) {
            throw new Error('Không tìm thấy voucher');
        }

        const users = await User.find({ _id: { $in: userIds } });
        const userVouchers = [];

        for (const user of users) {
            const existing = await UserVoucher.findOne({ voucherId, userId: user._id });
            if (!existing) {
                userVouchers.push({
                    voucherId,
                    userId: user._id,
                    code: voucher.code,
                    expiresAt: voucher.expiryDate,
                    assignedAt: new Date(),
                    status: 'available'
                });
            }
        }

        if (userVouchers.length > 0) {
            await UserVoucher.insertMany(userVouchers);
            await Voucher.findByIdAndUpdate(voucherId, {
                $addToSet: { assignedUsers: { $each: userIds } }
            });
        }

        return userVouchers.length;
    }

    async getAssignableUsers(search = '') {
        const query = { role: { $ne: 'admin' } };
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query).select('_id fullName email avatar');
        return users;
    }

    async getUserVoucherStats(userId) {
        const stats = await UserVoucher.aggregate([
            { $match: { userId: userId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            available: 0,
            used: 0,
            expired: 0,
            total: 0
        };

        stats.forEach(stat => {
            if (stat._id === 'available') result.available = stat.count;
            if (stat._id === 'used') result.used = stat.count;
            if (stat._id === 'expired') result.expired = stat.count;
        });

        result.total = result.available + result.used + result.expired;

        return result;
    }

    async getAdminVoucherStats() {
        const vouchers = await Voucher.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalUsage: { $sum: '$usedCount' }
                }
            }
        ]);

        const discountTypeStats = await Voucher.aggregate([
            {
                $group: {
                    _id: '$discountType',
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            total: 0,
            active: 0,
            inactive: 0,
            expired: 0,
            totalUsage: 0
        };

        vouchers.forEach(stat => {
            if (stat._id === 'active') result.active = stat.count;
            if (stat._id === 'inactive') result.inactive = stat.count;
            if (stat._id === 'expired') result.expired = stat.count;
            result.totalUsage += stat.totalUsage;
        });

        result.total = result.active + result.inactive + result.expired;

        return {
            status: result,
            discountType: discountTypeStats
        };
    }
}

module.exports = new VoucherService();