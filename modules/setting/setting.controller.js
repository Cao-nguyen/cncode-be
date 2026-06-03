const Setting = require('./setting.model');

class SettingController {
    async getSettings(req, res) {
        try {
            const settings = await Setting.find().lean();
            const settingsMap = {};
            settings.forEach(s => {
                settingsMap[s.key] = s.value;
            });

            res.json({
                success: true,
                data: settingsMap
            });
        } catch (error) {
            console.error('Get settings error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async getSettingByKey(req, res) {
        try {
            const { key } = req.params;
            const setting = await Setting.findOne({ key });

            res.json({
                success: true,
                data: setting ? setting.value : ''
            });
        } catch (error) {
            console.error('Get setting error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    async updateSetting(req, res) {
        try {
            const { key } = req.params;
            const { value } = req.body;
            const userId = req.user?._id;
            const adminName = req.user?.fullName || req.user?.username || 'Admin';

            const setting = await Setting.findOneAndUpdate(
                { key },
                { value, updatedAt: new Date() },
                { new: true, upsert: true }
            );

            // Check if this is a policy-related setting
            const policySettings = {
                'about_us': 'Giới thiệu',
                'terms_of_use': 'Điều khoản sử dụng',
                'security_policy': 'An toàn & bảo mật',
                'warranty_policy': 'Chính sách bảo hành',
                'payment_guide': 'Hướng dẫn thanh toán',
                'usage_process': 'Quy trình sử dụng'
            };

            console.log(`[Setting Controller] Updating setting with key: ${key}`);

            if (policySettings[key]) {
                console.log(`[Setting Controller] ✅ Key "${key}" is a policy setting`);
                const socketService = require('../../services/socket.service');
                const { createBroadcastNotification } = require('../broadcast-notification/broadcast-notification.service');

                const policyName = policySettings[key];

                // Tạo 1 broadcast notification duy nhất (không tạo N bản ghi cho N users)
                const result = await createBroadcastNotification({
                    type: 'policy_update',
                    title: `Cập nhật: ${policyName}`,
                    content: `${policyName} đã được cập nhật bởi ${adminName}`,
                    meta: {
                        policy_key: key,
                        policy_name: policyName,
                        updated_by: adminName,
                        updated_at: new Date().toISOString()
                    },
                    targetAudience: 'all', // Broadcast cho tất cả non-admin users
                    createdBy: userId
                });

                if (result.success) {
                    console.log(`✅ Created broadcast notification: ${result.broadcast._id}`);

                    // Broadcast qua socket để all clients refresh notifications
                    socketService.broadcastToAll('new_broadcast_notification', {
                        _id: result.broadcast._id,
                        type: result.broadcast.type,
                        title: result.broadcast.title,
                        content: result.broadcast.content,
                        meta: result.broadcast.meta,
                        createdAt: result.broadcast.createdAt
                    });

                    console.log(`📡 Broadcasted policy update to all connected clients`);
                } else {
                    console.log(`⚠️ Failed to create broadcast notification:`, result.error);
                }
            } else {
                console.log(`[Setting Controller] ⏭️ Key "${key}" is NOT a policy setting, skipping notification`);
            }

            res.json({
                success: true,
                message: 'Cập nhật cài đặt thành công',
                data: setting
            });
        } catch (error) {
            console.error('Update setting error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi cập nhật cài đặt'
            });
        }
    }
}

module.exports = new SettingController();