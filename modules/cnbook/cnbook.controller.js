const cnbookService = require('./cnbook.service');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ASK_AI_MODEL = 'llama-3.3-70b-versatile';

function stripThinkingContent(content) {
    if (!content || typeof content !== 'string') return '';
    return content
        .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '')
        .replace(/<redacted_thinking[^>]*>[\s\S]*?<\/redacted_thinking>/gi, '')
        .replace(/<thinking[^>]*>[\s\S]*?<\/thinking>/gi, '')
        .replace(/^\s*\n+/, '')
        .trim();
}

module.exports = {
    
    async createBook(req, res) {
        try {
            const book = await cnbookService.createBook(req.userId, req.body, req.userRole);
            res.status(201).json({ success: true, data: book });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async updateBook(req, res) {
        try {
            const book = await cnbookService.updateBook(req.params.id, req.userId, req.body, req.userRole);
            res.json({ success: true, data: book });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getBooks(req, res) {
        try {
            const { page, limit, category, search, sort } = req.query;
            const result = await cnbookService.getBooks({
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 12,
                category,
                search,
                sort,
                status: 'published'
            });
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getBookBySlug(req, res) {
        try {
            const book = await cnbookService.getBookBySlug(req.params.slug);
            res.json({ success: true, data: book });
        } catch (error) {
            res.status(404).json({ success: false, message: error.message });
        }
    },

    async getBookById(req, res) {
        try {
            const { id } = req.params;
            const book = await cnbookService.getBookById(id);
            res.json({ success: true, data: book });
        } catch (error) {
            res.status(404).json({ success: false, message: error.message });
        }
    },

    async getUserBooks(req, res) {
        try {
            console.log('📚 [CONTROLLER] getUserBooks called');
            console.log('📚 userId:', req.userId);
            console.log('📚 query:', req.query);

            const { page, limit, status, search } = req.query;
            const result = await cnbookService.getUserBooks(req.userId, {
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                status,
                search: search || ''
            });
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('❌ getUserBooks error:', error.message);
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getAdminBooks(req, res) {
        try {
            const { page, limit, status, search, category } = req.query;
            const result = await cnbookService.getAdminBooks({
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                status,
                search,
                category
            });
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async approveBook(req, res) {
        try {
            const { status, rejectReason } = req.body;
            const book = await cnbookService.approveBook(req.params.id, status, rejectReason);
            res.json({ success: true, data: book });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async deleteBook(req, res) {
        try {
            await cnbookService.deleteBook(req.params.id, req.userId, req.userRole);
            res.json({ success: true, message: 'Xóa sách thành công' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getStatistics(req, res) {
        try {
            const stats = await cnbookService.getStatistics();
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async addSection(req, res) {
        try {
            const book = await cnbookService.addSection(req.params.bookId, req.userId, req.body, req.userRole);
            res.json({ success: true, data: book });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async updateSection(req, res) {
        try {
            const book = await cnbookService.updateSection(req.params.bookId, req.params.sectionId, req.userId, req.body, req.userRole);
            res.json({ success: true, data: book });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async deleteSection(req, res) {
        try {
            const book = await cnbookService.deleteSection(req.params.bookId, req.params.sectionId, req.userId, req.userRole);
            res.json({ success: true, data: book });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async addLesson(req, res) {
        try {
            const lesson = await cnbookService.addLesson(req.params.bookId, req.params.sectionId, req.userId, req.body, req.userRole);
            res.status(201).json({ success: true, data: lesson });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async updateLesson(req, res) {
        try {
            const lesson = await cnbookService.updateLesson(req.params.id, req.userId, req.body, req.userRole);
            res.json({ success: true, data: lesson });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async deleteLesson(req, res) {
        try {
            await cnbookService.deleteLesson(req.params.id, req.userId, req.userRole);
            res.json({ success: true, message: 'Xóa bài học thành công' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async addExercise(req, res) {
        try {
            const exercise = await cnbookService.addExercise(req.params.lessonId, req.userId, req.body, req.userRole);
            res.status(201).json({ success: true, data: exercise });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async updateExercise(req, res) {
        try {
            const exercise = await cnbookService.updateExercise(req.params.id, req.userId, req.body, req.userRole);
            res.json({ success: true, data: exercise });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async deleteExercise(req, res) {
        try {
            await cnbookService.deleteExercise(req.params.id, req.userId, req.userRole);
            res.json({ success: true, message: 'Xóa bài tập thành công' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async purchaseBook(req, res) {
        try {
            const { bookId, useCoins } = req.body;
            const userBook = await cnbookService.purchaseBook(req.userId, bookId, useCoins);
            res.json({ success: true, data: userBook });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getUserBook(req, res) {
        try {
            const { bookId } = req.params;
            const data = await cnbookService.getUserBook(req.userId, bookId);
            res.json({ success: true, data });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async saveNote(req, res) {
        try {
            const { bookId, lessonId, content, highlight } = req.body;
            const note = await cnbookService.saveNote(req.userId, bookId, lessonId, content, highlight);
            res.json({ success: true, data: note });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async saveExerciseAnswer(req, res) {
        try {
            const { bookId, exerciseId, answer } = req.body;
            const result = await cnbookService.saveExerciseAnswer(req.userId, bookId, exerciseId, answer);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async updateProgress(req, res) {
        try {
            const { bookId, lessonId, progress } = req.body;
            const userBook = await cnbookService.updateProgress(req.userId, bookId, lessonId, progress);
            res.json({ success: true, data: userBook });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async getUserProgress(req, res) {
        try {
            const { bookId } = req.params;
            const progress = await cnbookService.getUserProgress(req.userId, bookId);
            res.json({ success: true, data: progress });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    async askAi(req, res) {
        try {
            const { text, lessonTitle, bookTitle } = req.body;
            const selected = typeof text === 'string' ? text.trim() : '';

            if (!selected || selected.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng chọn đoạn văn bản cần hỏi',
                });
            }

            if (selected.length > 2000) {
                return res.status(400).json({
                    success: false,
                    message: 'Đoạn văn bản quá dài',
                });
            }

            if (!process.env.GROQ_API_KEY) {
                return res.status(503).json({
                    success: false,
                    message: 'AI chưa được cấu hình',
                });
            }

            const completion = await groq.chat.completions.create({
                model: ASK_AI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content:
                            'Bạn là trợ lý học lập trình Python. Trả lời ngắn gọn 2-4 câu bằng tiếng Việt, dễ hiểu cho người mới. Không dùng markdown phức tạp.',
                    },
                    {
                        role: 'user',
                        content: [
                            bookTitle ? `Sách: ${bookTitle}` : null,
                            lessonTitle ? `Bài học: ${lessonTitle}` : null,
                            `Đoạn được chọn: "${selected}"`,
                            '',
                            'Giải thích ngắn gọn đoạn này trong ngữ cảnh học Python.',
                        ]
                            .filter(Boolean)
                            .join('\n'),
                    },
                ],
                temperature: 0.5,
                max_tokens: 400,
            });

            const raw = completion.choices?.[0]?.message?.content ?? '';
            const answer = stripThinkingContent(raw);

            if (!answer) {
                return res.status(502).json({
                    success: false,
                    message: 'AI không trả lời được. Vui lòng thử lại.',
                });
            }

            res.json({ success: true, data: { answer } });
        } catch (error) {
            console.error('CNbooks askAi error:', error?.message || error);
            res.status(500).json({
                success: false,
                message: 'Không thể kết nối AI. Vui lòng thử lại sau.',
            });
        }
    },
};
