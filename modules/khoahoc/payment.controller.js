const { PayOS } = require('@payos/node');
const Enrollment = require('../enrollment/enrollment.model');
const Course = require('../khoahoc/khoahoc.model');
const User = require('../user/user.model');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

/**
 * Initialize PayOS client.
 * Requires environment variables:
 *   PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY, FRONTEND_URL
 */
const payos = new PayOS({
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

/**
 * Helper: generate a unique numeric order code.
 * Uses timestamp + random suffix to avoid collisions.
 */
function generateOrderCode() {
    const timestamp = Date.now(); // ms since epoch
    const random = Math.floor(Math.random() * 1000); // 0‑999
    return Number(`${timestamp}${random}`);
}

function getPayableAmount(course) {
    return course.type === 'pro' ? (course.discountPrice || course.price) : 0;
}

function buildPaymentRedirectUrl(path, orderCode, courseSlug) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
        orderCode: String(orderCode),
        course: courseSlug,
    });
    return `${frontendUrl}${path}?${params.toString()}`;
}

/**
 * POST /api/payment/khoahoc/:courseId/payos
 * Create a PayOS payment request and a pending enrollment record.
 */
async function payosPayment(req, res) {
    try {
        const { courseId } = req.params;
        const userId = req.userId; // set by authentication middleware

        // Load course to get price & title
        const course = await Course.findById(courseId);
        if (!course) {
            return errorResponse(res, 404, 'Course not found');
        }

        const existingCompleted = await Enrollment.findOne({
            userId,
            courseId,
            paymentStatus: 'completed',
        });
        if (existingCompleted) {
            return successResponse(res, 200, 'Already enrolled', {
                enrollment: existingCompleted,
                alreadyEnrolled: true,
            });
        }

        // Determine payable amount (price for pro courses, 0 for free)
        const amount = getPayableAmount(course);
        if (amount <= 0) {
            // Free course – directly enroll without payment
            const enrollment = await Enrollment.findOneAndUpdate(
                { userId, courseId },
                {
                    $set: {
                        userId,
                        courseId,
                        paymentMethod: 'free',
                        paymentStatus: 'completed',
                    },
                    $unset: { orderCode: '' },
                },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            return successResponse(res, 200, 'Enrolled (free)', enrollment);
        }

        // Create a unique order code
        const orderCode = generateOrderCode();

        // Build PayOS payment request payload
        const paymentPayload = {
            orderCode,
            amount,
            description: `KHOAHOC${String(orderCode).slice(-10)}`,
            // Frontend URLs – fallback to localhost if not set
            returnUrl: buildPaymentRedirectUrl('/payment/success', orderCode, course.slug),
            cancelUrl: buildPaymentRedirectUrl('/payment/cancel', orderCode, course.slug),
            items: [
                {
                    name: course.title,
                    quantity: 1,
                    price: amount,
                },
            ],
        };

        // Create payment link via PayOS SDK
        const paymentLink = await payos.paymentRequests.create(paymentPayload);

        // Save pending enrollment
        const enrollment = await Enrollment.findOneAndUpdate(
            { userId, courseId, paymentStatus: 'pending' },
            {
                $set: {
                    userId,
                    courseId,
                    paymentMethod: 'payos',
                    paymentStatus: 'pending',
                    orderCode,
                },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return successResponse(res, 200, 'Payment link generated', {
            checkoutUrl: paymentLink.checkoutUrl,
            qrCode: paymentLink.qrCode,
            paymentLinkId: paymentLink.paymentLinkId,
            payosPaymentId: paymentLink.paymentLinkId,
            orderCode,
            enrollment,
            paymentLink,
        });
    } catch (err) {
        console.error('PayOS payment error:', err);
        return errorResponse(res, 500, 'Failed to create PayOS payment', err);
    }
}

/**
 * POST /api/payment/khoahoc/:courseId/coin
 * Pay for a course using system coins.
 */
async function coinPayment(req, res) {
    try {
        const { courseId } = req.params;
        const userId = req.userId;

        const [course, user] = await Promise.all([
            Course.findById(courseId),
            User.findById(userId),
        ]);

        if (!course) {
            return errorResponse(res, 404, 'Course not found');
        }
        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        const existingCompleted = await Enrollment.findOne({
            userId,
            courseId,
            paymentStatus: 'completed',
        });
        if (existingCompleted) {
            return successResponse(res, 200, 'Already enrolled', existingCompleted);
        }

        // Determine payable amount (price for pro courses, 0 for free)
        const amount = getPayableAmount(course);
        if (amount <= 0) {
            // Free course – directly enroll
            const enrollment = await Enrollment.findOneAndUpdate(
                { userId, courseId },
                {
                    $set: {
                        userId,
                        courseId,
                        paymentMethod: 'free',
                        paymentStatus: 'completed',
                    },
                    $unset: { orderCode: '' },
                },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            return successResponse(res, 200, 'Enrolled (free)', enrollment);
        }

        if (!course.allowCoinPayment) {
            return errorResponse(res, 400, 'Khoá học này không hỗ trợ thanh toán bằng xu');
        }

        if (user.coins < amount) {
            return errorResponse(res, 400, `Không đủ xu. Cần ${amount} xu, hiện có ${user.coins} xu`);
        }

        // Atomic coin deduction + enrollment (prevent race condition)
        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, coins: { $gte: amount } },
            { $inc: { coins: -amount } },
            { new: true }
        );
        if (!updatedUser) {
            return errorResponse(res, 400, `Không đủ xu. Cần ${amount} xu, hiện có ${user.coins} xu`);
        }

        // Create completed enrollment
        const enrollment = await Enrollment.findOneAndUpdate(
            { userId, courseId },
            {
                $set: {
                    userId,
                    courseId,
                    paymentMethod: 'coin',
                    paymentStatus: 'completed',
                },
                $unset: { orderCode: '' },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // Use updatedUser for socket event
        user = updatedUser;

        // Notify client via socket (if needed)
        const io = req.app.get('io');
        if (io) {
            io.to(userId.toString()).emit('coins_updated', {
                userId,
                coins: user.coins,
                amount: -amount,
                reason: `Mua khoá học ${course.title}`,
            });
        }

        return successResponse(res, 200, 'Course purchased with coins', enrollment);
    } catch (err) {
        console.error('Coin payment error:', err);
        return errorResponse(res, 500, 'Failed to process coin payment', err);
    }
}

/**
 * POST /api/payment/webhook/payos
 * PayOS webhook endpoint – verifies signature and updates enrollment status.
 */
async function payosWebhook(req, res) {
    try {
        const payload = req.body;

        // Verify webhook signature (throws if invalid)
        const webhookData = await payos.webhooks.verify(payload);

        const { orderCode, status } = webhookData;
        const isSuccess = status === 'PAID';
        const isCancelled = status === 'CANCELLED';

        // Đảm bảo orderCode được so sánh đúng kiểu dữ liệu Number
        const enrollment = await Enrollment.findOne({ orderCode: Number(orderCode) });
        if (!enrollment) {
            return errorResponse(res, 404, 'Enrollment not found for orderCode');
        }

        if (isSuccess) {
            enrollment.paymentStatus = 'completed';
            enrollment.paymentMethod = 'payos';
            enrollment.enrolledAt = new Date();
            await enrollment.save();

            // Optional: emit socket event to user
            const io = req.app.get('io');
            if (io) {
                io.to(enrollment.userId.toString()).emit('enrollment_updated', {
                    enrollmentId: enrollment._id,
                    status: enrollment.paymentStatus,
                });
            }
        } else if (isCancelled) {
            enrollment.paymentStatus = 'failed';
            await enrollment.save();
        }

        // Respond with 200 OK to acknowledge receipt
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('PayOS webhook error:', err);
        return errorResponse(res, 500, 'Webhook processing failed', err);
    }
}

/**
 * GET /api/payment/khoahoc/:courseId/status
 * Returns the payment status for the current user and course.
 */
async function paymentStatus(req, res) {
    try {
        const { courseId } = req.params;
        const userId = req.userId;

        const enrollment = await Enrollment.findOne({
            userId,
            courseId,
            paymentStatus: 'completed',
        }).sort({ updatedAt: -1 }) || await Enrollment.findOne({ userId, courseId }).sort({ updatedAt: -1 });
        if (!enrollment) {
            return errorResponse(res, 404, 'Enrollment not found');
        }

        return successResponse(res, 200, 'Payment status retrieved', {
            _id: enrollment._id,
            userId: enrollment.userId,
            courseId: enrollment.courseId,
            paymentMethod: enrollment.paymentMethod,
            paymentStatus: enrollment.paymentStatus,
            orderCode: enrollment.orderCode,
            enrolledAt: enrollment.enrolledAt,
            createdAt: enrollment.createdAt,
        });
    } catch (err) {
        console.error('Payment status error:', err);
        return errorResponse(res, 500, 'Failed to retrieve payment status', err);
    }
}

/**
 * POST /api/payment/khoahoc/:courseId/free
 * Enroll in a free course directly (no payment).
 */
async function freeEnroll(req, res) {
    try {
        const { courseId } = req.params;
        const userId = req.userId;

        const course = await Course.findById(courseId);
        if (!course) return errorResponse(res, 404, 'Course not found');
        if (getPayableAmount(course) > 0) {
            return errorResponse(res, 400, 'This course is not free');
        }

        const existingCompleted = await Enrollment.findOne({
            userId, courseId, paymentStatus: 'completed'
        });
        if (existingCompleted) {
            return successResponse(res, 200, 'Already enrolled', existingCompleted);
        }

        const enrollment = await Enrollment.findOneAndUpdate(
            { userId, courseId },
            {
                $set: { userId, courseId, paymentMethod: 'free', paymentStatus: 'completed' },
                $unset: { orderCode: '' },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return successResponse(res, 200, 'Enrolled (free)', enrollment);
    } catch (err) {
        console.error('Free enroll error:', err);
        return errorResponse(res, 500, 'Failed to enroll', err);
    }
}

/**
 * POST /api/payment/payos/confirm
 * Confirm payment status. Checks MongoDB first (webhook may have updated it),
 * then falls back to PayOS API if still pending.
 */
async function confirmPayOSPayment(req, res) {
    try {
        const { orderCode } = req.body;
        console.log('[confirmPayOSPayment] Received orderCode:', orderCode);

        if (!orderCode) return errorResponse(res, 400, 'Missing orderCode');

        const numericOrderCode = Number(orderCode);
        console.log('[confirmPayOSPayment] Numeric orderCode:', numericOrderCode);

        // 1. Check MongoDB — webhook may have already updated it
        const enrollment = await Enrollment.findOne({ orderCode: numericOrderCode });
        console.log('[confirmPayOSPayment] Found enrollment:', enrollment ? {
            _id: enrollment._id,
            paymentStatus: enrollment.paymentStatus,
            userId: enrollment.userId,
            courseId: enrollment.courseId
        } : 'NOT FOUND');

        if (!enrollment) {
            console.error('[confirmPayOSPayment] Enrollment not found for orderCode:', numericOrderCode);
            return errorResponse(res, 404, 'Enrollment not found');
        }

        if (enrollment.paymentStatus === 'completed') {
            console.log('[confirmPayOSPayment] Already completed, returning enrollment');
            return successResponse(res, 200, 'Payment confirmed', enrollment);
        }

        // 2. Fallback: check PayOS API with timeout
        console.log('[confirmPayOSPayment] Checking PayOS API...');
        let paymentInfo;
        try {
            paymentInfo = await Promise.race([
                payos.paymentRequests.get(numericOrderCode),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('PayOS API timeout')), 10000)
                ),
            ]);
            console.log('[confirmPayOSPayment] PayOS response:', {
                status: paymentInfo?.status,
                orderCode: paymentInfo?.orderCode
            });
        } catch (apiErr) {
            console.error('[confirmPayOSPayment] PayOS API error:', apiErr.message);
            // If PayOS API fails, return current enrollment status
            return errorResponse(res, 500, 'PayOS API unavailable. Check back in a moment or contact support.', {
                currentStatus: enrollment.paymentStatus
            });
        }

        if (paymentInfo && paymentInfo.status === 'PAID') {
            console.log('[confirmPayOSPayment] Payment is PAID, updating enrollment...');
            enrollment.paymentStatus = 'completed';
            enrollment.paymentMethod = 'payos';
            enrollment.enrolledAt = new Date();
            await enrollment.save();
            console.log('[confirmPayOSPayment] Enrollment updated successfully');

            // Emit socket event to notify user
            const io = req.app.get('io');
            if (io) {
                io.to(enrollment.userId.toString()).emit('enrollment_updated', {
                    enrollmentId: enrollment._id,
                    status: enrollment.paymentStatus,
                });
                console.log('[confirmPayOSPayment] Socket event emitted');
            }

            return successResponse(res, 200, 'Payment confirmed', enrollment);
        }

        // Payment not completed yet — return current status
        console.log('[confirmPayOSPayment] Payment not PAID yet, status:', paymentInfo?.status);
        return errorResponse(res, 400, `Payment status: ${paymentInfo?.status || 'unknown'}`);
    } catch (err) {
        console.error('[confirmPayOSPayment] Unexpected error:', err);
        return errorResponse(res, 500, 'Failed to confirm payment', err);
    }
}

module.exports = {
    payosPayment,
    coinPayment,
    freeEnroll,
    payosWebhook,
    paymentStatus,
    confirmPayOSPayment,
};