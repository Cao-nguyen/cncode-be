const ContentView = require('../modules/contentview/contentview.model');

/**
 * Ghi nhận lượt xem duy nhất theo user hoặc khách (guestId).
 * Chỉ gọi incrementFn khi viewer chưa từng xem target này.
 */
async function recordUniqueView({
    targetType,
    targetId,
    userId = null,
    guestId = null,
    incrementFn,
    getViewsFn,
}) {
    const viewerKey = userId
        ? `user:${userId}`
        : guestId
            ? `guest:${guestId}`
            : null;

    if (!viewerKey) {
        throw new Error('Thiếu thông tin người xem');
    }

    try {
        await ContentView.create({
            targetType,
            targetId,
            viewerKey,
            userId: userId || null,
            guestId: userId ? null : guestId,
        });
    } catch (error) {
        if (error?.code !== 11000) throw error;
        return {
            counted: false,
            views: await getViewsFn(),
        };
    }

    await incrementFn();
    return {
        counted: true,
        views: await getViewsFn(),
    };
}

module.exports = { recordUniqueView };
