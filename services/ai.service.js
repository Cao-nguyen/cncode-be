// services/ai.service.js
const Groq = require('groq-sdk');

let groq;

function initGroq() {
    if (!groq && process.env.GROQ_API_KEY) {
        groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return groq;
}

class AIService {
    async generateAnswer(question, context = '') {
        try {
            const groqClient = initGroq();

            if (!groqClient) {
                return this.getFallbackAnswer(question);
            }

            const systemPrompt = `Bạn là trợ lý hỗ trợ của nền tảng học lập trình CNcode. 
Nhiệm vụ của bạn là trả lời các câu hỏi của người dùng một cách chuyên nghiệp, thân thiện và hữu ích.
Hãy trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.
${context ? `\nThông tin tham khảo:\n${context}` : ''}`;

            const completion = await groqClient.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: question }
                ],
                model: 'mixtral-8x7b-32768',
                temperature: 0.7,
                max_tokens: 500,
            });

            return completion.choices[0]?.message?.content || this.getFallbackAnswer(question);
        } catch (error) {
            console.error('Groq AI error:', error);
            return this.getFallbackAnswer(question);
        }
    }

    getFallbackAnswer(question) {
        const lowerQuestion = question.toLowerCase();

        const answers = {
            'khóa học': 'CNcode cung cấp đa dạng khóa học lập trình: HTML/CSS, JavaScript, React, Node.js, Python, Java, C#,... Bạn có thể xem chi tiết tại trang Khóa học.',
            'đăng ký': 'Đăng ký cực kỳ đơn giản! Chỉ cần nhấn nút "Đăng ký" góc phải màn hình, nhập email và mật khẩu. Hoặc đăng ký nhanh bằng Google.',
            'xu': 'Xu là tiền ảo trong CNcode. Kiếm xu bằng: đăng nhập hàng ngày (5 xu), làm bài tập (10-50 xu), đăng bài viết (30 xu), giới thiệu bạn bè (100 xu).',
            'giáo viên': 'Để trở thành giáo viên, bạn vào Cài đặt → Nâng cấp tài khoản → Đăng ký làm giáo viên. Admin sẽ duyệt trong vòng 24h.',
            'bài tập': 'Mỗi bài học đều có bài tập kèm theo. Làm đúng được thưởng xu và tăng streak. Làm sai được gợi ý và làm lại.',
            'học phí': 'Nhiều khóa học MIỄN PHÍ. Khóa học nâng cao có phí nhưng rất hợp lý (từ 500-2000 xu). Dùng xu thưởng để học.',
            'chứng chỉ': 'Hoàn thành khóa học được cấp chứng chỉ điện tử, có thể chia sẻ lên LinkedIn, Facebook.',
            'support': 'Đội ngũ hỗ trợ hoạt động 24/7. Bạn có thể chat trực tiếp hoặc gửi email đến support@cncode.com.',
            'cộng đồng': 'CNcode có cộng đồng 50.000+ thành viên. Tham gia diễn đàn, nhóm Facebook, Discord để giao lưu học hỏi.'
        };

        for (const [key, value] of Object.entries(answers)) {
            if (lowerQuestion.includes(key)) {
                return value;
            }
        }

        return `Cảm ơn câu hỏi của bạn! 🙏

Đội ngũ hỗ trợ sẽ trả lời bạn trong thời gian sớm nhất. Bạn cũng có thể:
• Tìm kiếm câu hỏi tương tự trong mục Hỏi đáp
• Chat với admin để được hỗ trợ nhanh hơn
• Gửi email về support@cncode.com

Câu hỏi của bạn đã được ghi nhận và sẽ có câu trả lời sớm! ✨`;
    }

    async getRelatedQuestions(content, limit = 5) {
        const keywords = content.split(' ').slice(0, 10).join(' ');

        const questions = await FAQ.find({
            $or: [
                { title: { $regex: keywords, $options: 'i' } },
                { content: { $regex: keywords, $options: 'i' } }
            ],
            status: { $in: ['answered', 'resolved'] }
        })
            .limit(limit)
            .lean();

        return questions;
    }
}

module.exports = new AIService();