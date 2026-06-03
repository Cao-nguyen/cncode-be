const pushSubscriptionService = require('./push-subscription.service');

class PushSubscriptionController {
    /**
     * Subscribe to push notifications
     * POST /api/push/subscribe
     */
    async subscribe(req, res) {
        try {
            const userId = req.user.id;
            const { subscription } = req.body;
            const userAgent = req.headers['user-agent'];

            if (!subscription || !subscription.endpoint || !subscription.keys) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid subscription object'
                });
            }

            const result = await pushSubscriptionService.subscribe(
                userId,
                subscription,
                userAgent
            );

            res.json({
                success: true,
                message: 'Subscribed successfully',
                data: result
            });
        } catch (error) {
            console.error('Subscribe controller error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to subscribe'
            });
        }
    }

    /**
     * Unsubscribe from push notifications
     * POST /api/push/unsubscribe
     */
    async unsubscribe(req, res) {
        try {
            const userId = req.user.id;
            const { endpoint } = req.body;

            if (!endpoint) {
                return res.status(400).json({
                    success: false,
                    message: 'Endpoint is required'
                });
            }

            const result = await pushSubscriptionService.unsubscribe(userId, endpoint);

            res.json({
                success: true,
                message: result ? 'Unsubscribed successfully' : 'Subscription not found'
            });
        } catch (error) {
            console.error('Unsubscribe controller error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to unsubscribe'
            });
        }
    }

    /**
     * Get VAPID public key
     * GET /api/push/vapid-public-key
     */
    getPublicKey(req, res) {
        try {
            const publicKey = pushSubscriptionService.getPublicKey();

            if (!publicKey) {
                return res.status(500).json({
                    success: false,
                    message: 'VAPID keys not configured'
                });
            }

            res.json({
                success: true,
                publicKey
            });
        } catch (error) {
            console.error('Get public key error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get public key'
            });
        }
    }

    /**
     * Test send notification (for testing)
     * POST /api/push/test
     */
    async testSend(req, res) {
        try {
            const userId = req.user.id;
            const { title, body, url } = req.body;

            const payload = {
                title: title || 'Test Notification',
                body: body || 'This is a test notification from CNCode',
                icon: '/icon-192x192.png',
                badge: '/badge-72x72.png',
                url: url || '/',
                timestamp: Date.now()
            };

            const result = await pushSubscriptionService.sendToUser(userId, payload);

            res.json({
                success: true,
                message: 'Test notification sent',
                data: result
            });
        } catch (error) {
            console.error('Test send error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send test notification'
            });
        }
    }
}

module.exports = new PushSubscriptionController();