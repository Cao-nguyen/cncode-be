const webpush = require('web-push');
const PushSubscription = require('./push-subscription.model');

// Configure web-push với VAPID keys từ .env
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        'mailto:admin@cncode.edu.vn',
        vapidPublicKey,
        vapidPrivateKey
    );
}

class PushSubscriptionService {
    /**
     * Subscribe user to push notifications
     */
    async subscribe(userId, subscription, userAgent) {
        try {
            // Kiểm tra xem subscription này đã tồn tại chưa
            const existing = await PushSubscription.findOne({
                endpoint: subscription.endpoint
            });

            if (existing) {
                // Nếu đã tồn tại nhưng user khác, xóa cái cũ (user đã logout/login user khác)
                if (existing.user.toString() !== userId.toString()) {
                    await PushSubscription.deleteOne({ _id: existing._id });
                } else {
                    // Cùng user, update lastUsed
                    existing.lastUsed = new Date();
                    await existing.save();
                    return existing;
                }
            }

            // Tạo mới
            const newSubscription = new PushSubscription({
                user: userId,
                endpoint: subscription.endpoint,
                keys: subscription.keys,
                userAgent
            });

            await newSubscription.save();
            return newSubscription;
        } catch (error) {
            console.error('Subscribe error:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe user
     */
    async unsubscribe(userId, endpoint) {
        try {
            const result = await PushSubscription.deleteOne({
                user: userId,
                endpoint
            });
            return result.deletedCount > 0;
        } catch (error) {
            console.error('Unsubscribe error:', error);
            throw error;
        }
    }

    /**
     * Get all subscriptions for a user
     */
    async getUserSubscriptions(userId) {
        try {
            return await PushSubscription.find({ user: userId });
        } catch (error) {
            console.error('Get user subscriptions error:', error);
            throw error;
        }
    }

    /**
     * Send push notification to a user (all their devices)
     */
    async sendToUser(userId, payload) {
        try {
            const subscriptions = await this.getUserSubscriptions(userId);

            if (subscriptions.length === 0) {
                return { success: true, sent: 0, failed: 0 };
            }

            const results = await Promise.allSettled(
                subscriptions.map(sub => this.sendNotification(sub, payload))
            );

            const sent = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            return { success: true, sent, failed, total: subscriptions.length };
        } catch (error) {
            console.error('Send to user error:', error);
            throw error;
        }
    }

    /**
     * Send push notification to multiple users
     */
    async sendToMultipleUsers(userIds, payload) {
        try {
            const results = await Promise.allSettled(
                userIds.map(userId => this.sendToUser(userId, payload))
            );

            const summary = results.reduce((acc, result) => {
                if (result.status === 'fulfilled') {
                    acc.sent += result.value.sent;
                    acc.failed += result.value.failed;
                }
                return acc;
            }, { sent: 0, failed: 0 });

            return {
                success: true,
                ...summary,
                users: userIds.length
            };
        } catch (error) {
            console.error('Send to multiple users error:', error);
            throw error;
        }
    }

    /**
     * Send notification to a specific subscription
     */
    async sendNotification(subscription, payload) {
        try {
            const pushPayload = JSON.stringify(payload);

            await webpush.sendNotification(
                {
                    endpoint: subscription.endpoint,
                    keys: subscription.keys
                },
                pushPayload
            );

            // Update lastUsed
            subscription.lastUsed = new Date();
            await subscription.save();

            return { success: true };
        } catch (error) {
            // Nếu subscription hết hạn (410 Gone), xóa khỏi DB
            if (error.statusCode === 410) {
                console.log('Subscription expired, removing:', subscription.endpoint);
                await PushSubscription.deleteOne({ _id: subscription._id });
            }
            throw error;
        }
    }

    /**
     * Clean up expired subscriptions
     */
    async cleanupExpiredSubscriptions(daysOld = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const result = await PushSubscription.deleteMany({
                lastUsed: { $lt: cutoffDate }
            });

            return result.deletedCount;
        } catch (error) {
            console.error('Cleanup expired subscriptions error:', error);
            throw error;
        }
    }

    /**
     * Get VAPID public key
     */
    getPublicKey() {
        return vapidPublicKey;
    }
}

module.exports = new PushSubscriptionService();