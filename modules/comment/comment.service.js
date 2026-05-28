
const Comment = require('./comment.model');
const CommentReaction = require('./commentReaction.model');
const CommentReport = require('./commentReport.model');
const Notification = require('../notification/notification.model');
const User = require('../user/user.model');

function getIo() {
    try {
        const { getIo } = require('../../server');
        const io = getIo?.();
        return io;
    } catch (e) {
        console.error('Comment getIo error:', e.message);
        return null;
    }
}

class CommentService {

    async createComment(userId, data) {
        const { targetType, targetId, parentId, content, attachments = [] } = data;

        if (!content || content.trim().length === 0) {
            throw new Error('Nội dung bình luận không được để trống');
        }

        if (content.length > 5000) {
            throw new Error('Nội dung bình luận không được quá 5000 ký tự');
        }

        let finalParentId = parentId || null;

        if (parentId) {
            const parentComment = await Comment.findById(parentId);

            if (!parentComment) {
                throw new Error('Không tìm thấy bình luận cha');
            }

            finalParentId =
                parentComment.parentId || parentComment._id;
        }

        const comment = new Comment({
            userId,
            targetType,
            targetId,
            parentId: finalParentId,
            content: content.trim(),
            attachments
        });

        await comment.save();

        await comment.populate(
            'userId',
            '_id fullName email avatar username'
        );

        if (finalParentId) {
            await Comment.findByIdAndUpdate(finalParentId, {
                $inc: { replyCount: 1 }
            });
        }

        const io = getIo();

        if (io) {
            io.emit(
                `comment_created_${targetType}_${targetId}`,
                comment
            );
        }

        return comment;
    }

    async getCommentsByTarget(targetType, targetId, page = 1, limit = 20, sortBy = 'latest') {
        const skip = (page - 1) * limit;

        let sort = { createdAt: -1 };
        if (sortBy === 'oldest') sort = { createdAt: 1 };
        if (sortBy === 'most_liked') sort = { 'reactions.like': -1, createdAt: -1 };

        const [comments, total] = await Promise.all([
            Comment.find({ targetType, targetId, parentId: null, isDeleted: false })
                .populate('userId', '_id fullName email avatar username')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Comment.countDocuments({ targetType, targetId, parentId: null, isDeleted: false })
        ]);

        const commentIds = comments.map(c => c._id);
        const replies = await Comment.find({ parentId: { $in: commentIds }, isDeleted: false })
            .populate('userId', '_id fullName email avatar username')
            .sort({ createdAt: 1 })
            .lean();

        const repliesMap = new Map();
        replies.forEach(reply => {
            if (!repliesMap.has(reply.parentId.toString())) {
                repliesMap.set(reply.parentId.toString(), []);
            }
            repliesMap.get(reply.parentId.toString()).push(reply);
        });

        const commentsWithReplies = comments.map(comment => ({
            ...comment,
            replies: repliesMap.get(comment._id.toString()) || [],
            reactionCounts: comment.reactions || {},
            userReaction: null
        }));

        return {
            comments: commentsWithReplies,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getRepliesByParent(parentId, page = 1, limit = 50) {
        const skip = (page - 1) * limit;

        const [replies, total] = await Promise.all([
            Comment.find({ parentId, isDeleted: false })
                .populate('userId', '_id fullName email avatar username')
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Comment.countDocuments({ parentId, isDeleted: false })
        ]);

        return {
            replies,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async updateComment(commentId, userId, content) {
        const comment = await Comment.findOne({ _id: commentId, userId });

        if (!comment) {
            throw new Error('Không tìm thấy bình luận hoặc bạn không có quyền chỉnh sửa');
        }

        if (comment.isDeleted) {
            throw new Error('Bình luận đã bị xóa, không thể chỉnh sửa');
        }

        comment.content = content.trim();
        comment.isEdited = true;
        comment.editedAt = new Date();
        await comment.save();

        await comment.populate('userId', '_id fullName email avatar username');

        const io = getIo();
        if (io) {
            io.emit(`comment_updated_${comment.targetType}_${comment.targetId}`, comment);
        }

        return comment;
    }

    async deleteComment(commentId, userId, isAdmin = false) {
        const comment = await Comment.findById(commentId);

        if (!comment) {
            throw new Error('Không tìm thấy bình luận');
        }

        if (!isAdmin && comment.userId.toString() !== userId) {
            throw new Error('Bạn không có quyền xóa bình luận này');
        }

        comment.isDeleted = true;
        comment.deletedAt = new Date();
        comment.content = '[Bình luận đã bị xóa]';
        await comment.save();

        if (comment.parentId) {
            await Comment.findByIdAndUpdate(comment.parentId, { $inc: { replyCount: -1 } });
        }

        const io = getIo();
        if (io) {
            io.emit(`comment_deleted_${comment.targetType}_${comment.targetId}`, commentId);
        }

        return { success: true };
    }

    async hardDeleteComment(commentId, adminId) {
        const comment = await Comment.findById(commentId);

        if (!comment) {
            throw new Error('Không tìm thấy bình luận');
        }

        await CommentReaction.deleteMany({ commentId });

        await CommentReport.deleteMany({ commentId });

        if (comment.parentId) {
            await Comment.findByIdAndUpdate(comment.parentId, { $inc: { replyCount: -1 } });
        }

        await Comment.findByIdAndDelete(commentId);

        const io = getIo();
        if (io) {
            io.emit(`comment_deleted_${comment.targetType}_${comment.targetId}`, commentId);
        }

        return { success: true };
    }

    async reactToComment(commentId, userId, reactionType) {
        const validTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
        if (!validTypes.includes(reactionType)) {
            throw new Error('Loại reaction không hợp lệ');
        }

        const comment = await Comment.findById(commentId);
        if (!comment) {
            throw new Error('Không tìm thấy bình luận');
        }

        const existingReaction = await CommentReaction.findOne({ commentId, userId });

        if (existingReaction) {
            if (existingReaction.type === reactionType) {

                await CommentReaction.deleteOne({ _id: existingReaction._id });

                const currentCount = comment.reactions.get(reactionType) || 0;
                if (currentCount > 0) {
                    comment.reactions.set(reactionType, currentCount - 1);
                }
                await comment.save();

                return { reacted: false, reactionType: null, reactionCounts: comment.reactions };
            } else {

                const oldType = existingReaction.type;
                existingReaction.type = reactionType;
                await existingReaction.save();

                const oldCount = comment.reactions.get(oldType) || 0;
                if (oldCount > 0) {
                    comment.reactions.set(oldType, oldCount - 1);
                }
                const newCount = comment.reactions.get(reactionType) || 0;
                comment.reactions.set(reactionType, newCount + 1);
                await comment.save();

                return { reacted: true, reactionType, reactionCounts: comment.reactions };
            }
        } else {

            await CommentReaction.create({ commentId, userId, type: reactionType });

            const currentCount = comment.reactions.get(reactionType) || 0;
            comment.reactions.set(reactionType, currentCount + 1);
            await comment.save();

            return { reacted: true, reactionType, reactionCounts: comment.reactions };
        }
    }

    async getUserReactionsForComments(userId, commentIds) {
        const reactions = await CommentReaction.find({
            commentId: { $in: commentIds },
            userId
        });

        const reactionMap = new Map();
        reactions.forEach(r => {
            reactionMap.set(r.commentId.toString(), r.type);
        });

        return reactionMap;
    }

    async reportComment(commentId, reporterId, reason, description = '') {
        const comment = await Comment.findById(commentId);
        if (!comment) {
            throw new Error('Không tìm thấy bình luận');
        }

        const existingReport = await CommentReport.findOne({ commentId, reporterId });
        if (existingReport) {
            throw new Error('Bạn đã báo cáo bình luận này rồi');
        }

        const report = new CommentReport({
            commentId,
            reporterId,
            reason,
            description,
            status: 'pending'
        });

        await report.save();

        const admins = await User.find({ role: 'admin' }).select('_id');
        const io = getIo();

        if (admins.length > 0 && io) {
            admins.forEach(admin => {
                io.to(admin._id.toString()).emit('new_notification', {
                    type: 'comment_reported',
                    commentId,
                    reason,
                    reporterId
                });
            });
        }

        return report;
    }

    async getReportsForAdmin(page = 1, limit = 20, status = null) {
        const skip = (page - 1) * limit;

        const query = status && status !== 'all' ? { status } : {};

        const [reports, total] = await Promise.all([
            CommentReport.find(query)
                .populate('commentId')
                .populate('reporterId', '_id fullName email avatar')
                .populate('reviewedBy', '_id fullName')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CommentReport.countDocuments(query)
        ]);

        return {
            reports,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async resolveReport(reportId, adminId, actionTaken, status = 'resolved') {
        const report = await CommentReport.findById(reportId);
        if (!report) {
            throw new Error('Không tìm thấy báo cáo');
        }

        report.status = status;
        report.reviewedBy = adminId;
        report.reviewedAt = new Date();
        report.actionTaken = actionTaken;
        await report.save();

        if (actionTaken === 'delete_comment') {
            await this.hardDeleteComment(report.commentId, adminId);
        }

        return report;
    }

    async getReactionUsers(commentId, reactionType, page = 1, limit = 50) {
        const skip = (page - 1) * limit;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            throw new Error('Không tìm thấy bình luận');
        }

        let query = { commentId };
        if (reactionType && reactionType !== 'all') {
            query.type = reactionType;
        }

        const reactions = await CommentReaction.find(query)
            .populate('userId', '_id fullName email avatar username')
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await CommentReaction.countDocuments(query);

        return {
            users: reactions.map(r => ({
                userId: r.userId,
                reactionType: r.type,
                createdAt: r.createdAt
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }
}

module.exports = new CommentService();
