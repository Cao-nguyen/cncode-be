// modules/sendmail/sendmail.controller.js
const sendmailService = require('./sendmail.service');

module.exports = {
    // Gửi email hàng loạt
    async sendBulkEmail(req, res) {
        try {
            const { userIds, subject, content } = req.body;

            if (!userIds || !userIds.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng chọn người nhận'
                });
            }

            if (!subject || !subject.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng nhập tiêu đề email'
                });
            }

            if (!content || !content.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng nhập nội dung email'
                });
            }

            const result = await sendmailService.sendBulkEmail(
                userIds,
                subject.trim(),
                content,
                req.userId
            );

            res.json({
                success: true,
                sentCount: result.sentCount,
                failedCount: result.failedCount,
                failedEmails: result.failedEmails,
                message: `Đã gửi thành công ${result.sentCount}/${userIds.length} email`
            });
        } catch (error) {
            console.error('Send mail error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    },

    // Lấy danh sách người dùng để chọn người nhận
    async getUsers(req, res) {
        try {
            const { page = 1, limit = 20, search = '', role = 'all' } = req.query;

            const result = await sendmailService.getUsers({
                page: parseInt(page),
                limit: parseInt(limit),
                search,
                role: role !== 'all' ? role : null
            });

            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Get users error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
};