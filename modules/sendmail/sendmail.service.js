
const User = require('../user/user.model');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('Email configuration error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

class SendmailService {
    async getUsers({ page = 1, limit = 20, search = '', role = null }) {
        const query = {};

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        if (role) {
            query.role = role;
        }

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find(query)
                .select('_id email fullName avatar role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(query)
        ]);

        return {
            data: users,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    }

    async sendBulkEmail(userIds, subject, content, adminId) {

        const users = await User.find({
            _id: { $in: userIds },
            isBanned: { $ne: true }
        }).select('email fullName');

        console.log(`Found ${users.length} users to send email`);

        if (!users.length) {
            throw new Error('Không tìm thấy người nhận hợp lệ');
        }

        const results = {
            sentCount: 0,
            failedCount: 0,
            failedEmails: []
        };

        for (const user of users) {
            try {
                const mailOptions = {
                    from: `"CNcode" <${process.env.EMAIL_USER}>`,
                    to: user.email,
                    subject: subject,
                    html: `
                <!DOCTYPE html>
                <html lang="vi">
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        /* CSS Reset cho Email */
                        body, table, td, p, a, li, blockquote { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
                        body { margin: 0; padding: 0; width: 100% !important; background-color: #ffffff; }
                        
                        .email-container {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                            color: #111827;
                            line-height: 1.8;
                            font-size: 16px;
                            padding: 20px;
                            max-width: 800px;
                            margin: 0 auto;
                        }

                        /* Typography */
                        h1 { font-size: 28px; font-weight: 700; margin: 0 0 15px 0; color: #0f172a; }
                        h2 { font-size: 22px; font-weight: 600; margin: 0 0 12px 0; color: #0f172a; }
                        h3 { font-size: 18px; font-weight: 600; margin: 0 0 10px 0; color: #0f172a; }
                        p { margin: 0 0 15px 0; }

                        /* Blockquote */
                        blockquote {
                            border-left: 4px solid #6366f1;
                            padding: 12px 20px;
                            margin: 20px 0;
                            color: #6b7280;
                            font-style: italic;
                            background-color: #f5f5ff !important;
                            border-radius: 0 8px 8px 0;
                        }

                        /* Inline Code */
                        code {
                            font-family: 'JetBrains Mono', 'Fira Code', monospace;
                            font-size: 14px;
                            padding: 2px 6px;
                            background-color: #f3f4f6 !important;
                            color: #4338ca;
                            border-radius: 4px;
                        }

                        /* Code Block (PHẦN FIX LỖI TRẮNG) */
                        pre {
                            background-color: #1e1e2e !important;
                            background: #1e1e2e !important; /* Đảm bảo phủ màu toàn bộ */
                            color: #d4d4d4 !important;
                            padding: 16px !important;
                            border-radius: 10px;
                            overflow-x: auto;
                            font-size: 13px;
                            line-height: 1.7;
                            margin: 20px 0 !important;
                            display: block !important;
                            border: none !important; /* Xóa bỏ viền mặc định của client */
                        }
                        
                        /* Đảm bảo code bên trong pre không bị đè màu */
                        pre code {
                            background-color: transparent !important;
                            color: inherit !important;
                            padding: 0 !important;
                            font-size: inherit !important;
                        }

                        /* Link */
                        a { color: #6366f1; text-decoration: underline; }

                        /* List */
                        ul, ol { margin: 15px 0 15px 25px; padding: 0; }
                        li { margin-bottom: 8px; }
                        
                        /* Table Style Excel */
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 20px 0;
                            border: 1px solid #d1d5db;
                        }
                        th, td {
                            border: 1px solid #d1d5db;
                            padding: 12px;
                            text-align: left;
                        }
                        th {
                            background-color: #f3f4f6 !important;
                            font-weight: 600;
                            color: #111827;
                        }
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        ${content}
                    </div>
                </body>
                </html>
            `
                };

                const info = await transporter.sendMail(mailOptions);
                console.log(`Email sent to ${user.email}, MessageId: ${info.messageId}`);
                results.sentCount++;

            } catch (error) {
                console.error(`Failed to send email to ${user.email}:`, error.message);
                results.failedCount++;
                results.failedEmails.push(user.email);
            }
        }

        console.log(`Send result: ${results.sentCount} success, ${results.failedCount} failed`);

        return results;
    }

    async testSendEmail(toEmail, subject, content) {
        try {
            const mailOptions = {
                from: `"CNcode" <${process.env.EMAIL_USER}>`,
                to: toEmail,
                subject: subject,
                html: content
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('Test email sent:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Test email failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new SendmailService();
