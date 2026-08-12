const FeedbackVersion = require('./feedbackVersion.model');

function normalizeChanges(changes = []) {
    if (!Array.isArray(changes)) return [];
    return changes.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeVersion(version = '') {
    return String(version || '').trim();
}

async function listVersions({ publishedOnly = false } = {}) {
    const query = publishedOnly ? { isPublished: true } : {};
    return FeedbackVersion.find(query)
        .populate('createdBy', '_id fullName')
        .sort({ releasedAt: -1, createdAt: -1 })
        .lean();
}

async function createVersion(adminId, payload) {
    const version = normalizeVersion(payload.version);
    const changes = normalizeChanges(payload.changes);

    if (!version) throw new Error('Version không được để trống');
    if (changes.length === 0) throw new Error('Cần ít nhất một thay đổi');

    const exists = await FeedbackVersion.findOne({ version });
    if (exists) throw new Error('Version này đã tồn tại');

    const doc = await FeedbackVersion.create({
        version,
        changes,
        isPublished: payload.isPublished !== false,
        releasedAt: payload.releasedAt ? new Date(payload.releasedAt) : new Date(),
        createdBy: adminId,
    });

    return FeedbackVersion.findById(doc._id)
        .populate('createdBy', '_id fullName')
        .lean();
}

async function updateVersion(id, payload) {
    const doc = await FeedbackVersion.findById(id);
    if (!doc) throw new Error('Không tìm thấy phiên bản');

    if (payload.version !== undefined) {
        const version = normalizeVersion(payload.version);
        if (!version) throw new Error('Version không được để trống');
        const exists = await FeedbackVersion.findOne({ version, _id: { $ne: id } });
        if (exists) throw new Error('Version này đã tồn tại');
        doc.version = version;
    }

    if (payload.changes !== undefined) {
        const changes = normalizeChanges(payload.changes);
        if (changes.length === 0) throw new Error('Cần ít nhất một thay đổi');
        doc.changes = changes;
    }

    if (payload.isPublished !== undefined) doc.isPublished = !!payload.isPublished;
    if (payload.releasedAt !== undefined) doc.releasedAt = new Date(payload.releasedAt);

    await doc.save();

    return FeedbackVersion.findById(doc._id)
        .populate('createdBy', '_id fullName')
        .lean();
}

async function deleteVersion(id) {
    const doc = await FeedbackVersion.findByIdAndDelete(id);
    if (!doc) throw new Error('Không tìm thấy phiên bản');
    return { success: true };
}

module.exports = {
    listVersions,
    createVersion,
    updateVersion,
    deleteVersion,
};
