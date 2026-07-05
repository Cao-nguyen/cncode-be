/**
 * Encrypted File Controller
 * Handle upload, serve, và download encrypted files
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const uploadJobModel = require('./upload-job.model');
const EncryptedFile = require('./encrypted-file.model');
const { processImageFile } = require('../../workers/image.worker');
const { processVideoFile } = require('../../workers/video.worker');
const { processDocumentFile } = require('../../workers/document.worker');
const { addJob, updateProgress } = require('../../services/queue.service');
const telegramClient = require('../../services/telegram-client.service');

// Temp directory
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp', 'uploads');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Create blur placeholder sync (simple version)
 */
function createBlurPlaceholderSync(buffer) {
    try {
        const sharp = require('sharp');
        // Create a small blurred version
        const placeholderBuffer = sharp(buffer)
            .resize(32, 32, { fit: 'cover' })
            .blur(5)
            .jpeg({ quality: 50 })
            .toBuffer();
        return `data:image/jpeg;base64,${placeholderBuffer.toString('base64')}`;
    } catch (error) {
        console.warn('Failed to create placeholder:', error);
        // Return a simple placeholder
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjZGRkIi8+PC9zdmc+';
    }
}

/**
 * Multer config
 */
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${Date.now()}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images are allowed.'));
        }
    }
});

/**
 * Upload multiple images
 */
async function uploadMultipleImages(req, res) {
    try {
        const userId = req.user?._id || req.user?.id || null;

        const uploadMultiple = multer({
            storage,
            limits: { fileSize: 50 * 1024 * 1024 },
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Invalid file type. Only images are allowed.'));
                }
            }
        });

        uploadMultiple.array('files', 10)(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, error: err.message });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, error: 'No files uploaded' });
            }

            const uploadResults = [];

            for (const file of req.files) {
                const jobId = uuidv4();

                const job = new uploadJobModel({
                    jobId,
                    userId,
                    type: 'image',
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    tempPath: file.path,
                    progress: 0,
                    status: 'queued'
                });
                await job.save();

                const fileBuffer = fs.readFileSync(file.path);
                const placeholder = createBlurPlaceholderSync(fileBuffer);

                uploadResults.push({
                    jobId,
                    placeholder,
                    fileName: file.originalname,
                    fileSize: file.size
                });

                // Add to queue
                addJob('image', jobId, async () => {
                    try {
                        job.status = 'processing';
                        job.progress = 10;
                        await job.save();

                        const result = await processImageFile(file, jobId, userId);

                        const encryptedFile = new EncryptedFile({
                            fileId: jobId,
                            userId,
                            type: 'image',
                            originalName: file.originalname,
                            mimeType: file.mimetype,
                            size: file.size,
                            telegramMessageId: result.messageId,
                            placeholder: result.placeholder,
                            encrypted: true
                        });
                        await encryptedFile.save();

                        job.status = 'done';
                        job.progress = 100;
                        job.messageId = result.messageId;
                        job.url = result.url;
                        job.placeholder = result.placeholder;
                        await job.save();

                        return result;
                    } catch (error) {
                        job.status = 'failed';
                        job.error = error.message;
                        job.progress = 0;
                        await job.save();
                        throw error;
                    }
                });
            }

            res.status(200).json({
                success: true,
                uploads: uploadResults,
                message: `${uploadResults.length} images upload started`
            });
        });
    } catch (error) {
        console.error('Upload multiple images error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Upload image - trả về NGAY với jobId và placeholder
 */
async function uploadImage(req, res) {
    try {
        const userId = req.user?._id || req.user?.id || null;

        upload.single('file')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    error: err.message
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded'
                });
            }

            const jobId = uuidv4();

            // Tạo upload job để track
            const job = new uploadJobModel({
                jobId,
                userId,
                type: 'image',
                fileName: req.file.originalname,
                mimeType: req.file.mimetype,
                tempPath: req.file.path,
                progress: 0,
                status: 'queued'
            });
            await job.save();

            // Tạo placeholder ngay (không cần tung)
            const fileBuffer = fs.readFileSync(req.file.path);
            const placeholder = createBlurPlaceholderSync(fileBuffer);

            // Trả về NGAY với jobId
            res.status(200).json({
                success: true,
                jobId,
                placeholder,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                message: 'Upload started'
            });

            // Thêm vào queue xử lý background
            addJob('image', jobId, async () => {
                try {
                    // Update job status
                    job.status = 'processing';
                    job.progress = 10;
                    await job.save();

                    // Process upload
                    const result = await processImageFile(req.file, jobId, userId);

                    // Save encrypted file metadata
                    const encryptedFile = new EncryptedFile({
                        fileId: jobId,
                        userId,
                        type: 'image',
                        originalName: req.file.originalname,
                        mimeType: req.file.mimetype,
                        size: req.file.size,
                        telegramMessageId: result.messageId,
                        placeholder: result.placeholder,
                        encrypted: true
                    });
                    await encryptedFile.save();

                    // Update job
                    job.status = 'done';
                    job.progress = 100;
                    job.messageId = result.messageId;
                    job.url = result.url;
                    job.placeholder = result.placeholder;
                    await job.save();

                    return result;

                } catch (error) {
                    job.status = 'failed';
                    job.error = error.message;
                    job.progress = 0;
                    await job.save();
                    throw error;
                }
            });
        });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Serve encrypted image với giải mã
 */
async function serveEncryptedImage(req, res) {
    try {
        const { fileId } = req.params;

        const encryptedFile = await EncryptedFile.findOne({ fileId });

        if (!encryptedFile) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Increment access count
        await encryptedFile.incrementAccess();

        // Find message ID từ Telegram
        const messageId = encryptedFile.telegramMessageId;

        if (!messageId) {
            return res.status(404).json({
                success: false,
                error: 'Telegram message not found'
            });
        }

        // Download từ Telegram
        const result = await telegramClient.downloadFileWithMetadata(messageId);

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'File not found on Telegram'
            });
        }

        // Giải mã
        const decryptedBuffer = require('../../utils/crypto').decryptBuffer(result.buffer);

        // Set headers với encoding cho tiếng Việt
        const encodedFilename = encodeURIComponent(encryptedFile.originalName);
        res.setHeader('Content-Type', encryptedFile.mimeType);
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-File-Id', fileId);

        res.send(decryptedBuffer);

    } catch (error) {
        console.error('Serve encrypted image error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Serve encrypted file (general)
 */
async function serveEncryptedFile(req, res) {
    try {
        const { type, fileId } = req.params;

        const encryptedFile = await EncryptedFile.findOne({
            fileId,
            type
        });

        if (!encryptedFile) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        await encryptedFile.incrementAccess();

        const messageId = encryptedFile.telegramMessageId;
        const result = await telegramClient.downloadFileWithMetadata(messageId);

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'File not found on Telegram'
            });
        }

        const decryptedBuffer = require('../../utils/crypto').decryptBuffer(result.buffer);

        const isInline = type === 'image';
        const encodedFilename = encodeURIComponent(encryptedFile.originalName);

        res.setHeader('Content-Type', encryptedFile.mimeType);
        res.setHeader('Content-Disposition', isInline
            ? `inline; filename*=UTF-8''${encodedFilename}`
            : `attachment; filename*=UTF-8''${encodedFilename}`
        );
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-File-Id', fileId);

        res.send(decryptedBuffer);

    } catch (error) {
        console.error('Serve encrypted file error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Get file info
 */
async function getFileInfo(req, res) {
    try {
        const { fileId } = req.params;

        const encryptedFile = await EncryptedFile.findOne({ fileId }).select('-_id fileId type originalName mimeType size createdAt');

        if (!encryptedFile) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        res.json({
            success: true,
            ...encryptedFile.toObject()
        });

    } catch (error) {
        console.error('Get file info error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * List user's encrypted files
 */
async function listUserFiles(req, res) {
    try {
        const userId = req.user?._id || req.user?.id;

        const { type, page = 1, limit = 20 } = req.query;

        // Build query - nếu có userId thì filter theo userId, không thì lấy tất cả
        const query = {};
        if (userId) {
            query.userId = userId;
        }
        if (type) {
            query.type = type;
        }

        const files = await EncryptedFile.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Decode originalName for files uploaded before encoding fix
        const filesWithDecodedNames = files.map(file => {
            const fileObj = file.toObject();
            try {
                // Try to decode if filename looks like it has encoding issues
                if (fileObj.originalName && /[Ã¡Ã Ã¢Ã£Ã¨Ã©ÃªÃ¬Ã­Ã²Ã³Ã´ÃµÃ¹ÃºÆ°Ä']/i.test(fileObj.originalName)) {
                    fileObj.originalName = Buffer.from(fileObj.originalName, 'latin1').toString('utf8');
                }
            } catch (e) {
                // Keep original if decode fails
            }
            return fileObj;
        });

        const total = await EncryptedFile.countDocuments(query);

        res.json({
            success: true,
            data: filesWithDecodedNames,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('List user files error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * Upload video
 */
const uploadVideo = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
        if (videoTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only videos allowed.'));
        }
    }
});

async function uploadVideoFile(req, res) {
    try {
        const userId = req.user?._id || req.user?.id || null;

        uploadVideo.single('file')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, error: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const jobId = uuidv4();

            // Decode filename properly (multer may encode it incorrectly)
            const decodedFilename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

            const job = new uploadJobModel({
                jobId,
                userId,
                type: 'video',
                fileName: decodedFilename,
                mimeType: req.file.mimetype,
                tempPath: req.file.path,
                progress: 0,
                status: 'queued'
            });
            await job.save();

            res.status(200).json({
                success: true,
                jobId,
                fileName: decodedFilename,
                fileSize: req.file.size,
                message: 'Video upload started'
            });

            addJob('video', jobId, async () => {
                try {
                    job.status = 'processing';
                    job.progress = 10;
                    await job.save();

                    const result = await processVideoFile(req.file, jobId, userId);

                    const encryptedFile = new EncryptedFile({
                        fileId: jobId,
                        userId,
                        type: 'video',
                        originalName: req.file.originalname,
                        mimeType: req.file.mimetype,
                        size: req.file.size,
                        telegramMessageId: result.messageId,
                        encrypted: true
                    });
                    await encryptedFile.save();

                    job.status = 'done';
                    job.progress = 100;
                    job.messageId = result.messageId;
                    job.url = result.url;
                    await job.save();

                    return result;
                } catch (error) {
                    job.status = 'failed';
                    job.error = error.message;
                    job.progress = 0;
                    await job.save();
                    throw error;
                }
            });
        });
    } catch (error) {
        console.error('Upload video error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Upload document
 */
const uploadDoc = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const docTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        if (docTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only documents allowed.'));
        }
    }
});

async function uploadDocument(req, res) {
    try {
        const userId = req.user?._id || req.user?.id || null;

        uploadDoc.single('file')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, error: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const jobId = uuidv4();

            // Decode filename properly (multer may encode it incorrectly)
            const decodedFilename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

            const job = new uploadJobModel({
                jobId,
                userId,
                type: 'document',
                fileName: decodedFilename,
                mimeType: req.file.mimetype,
                tempPath: req.file.path,
                progress: 0,
                status: 'queued'
            });
            await job.save();

            res.status(200).json({
                success: true,
                jobId,
                fileName: decodedFilename,
                fileSize: req.file.size,
                message: 'Document upload started'
            });

            addJob('document', jobId, async () => {
                try {
                    job.status = 'processing';
                    job.progress = 10;
                    await job.save();

                    const result = await processDocumentFile(req.file, jobId, userId);

                    const encryptedFile = new EncryptedFile({
                        fileId: jobId,
                        userId,
                        type: 'document',
                        originalName: decodedFilename,
                        mimeType: req.file.mimetype,
                        size: req.file.size,
                        telegramMessageId: result.messageId,
                        encrypted: true
                    });
                    await encryptedFile.save();

                    job.status = 'done';
                    job.progress = 100;
                    job.messageId = result.messageId;
                    job.url = result.url;
                    await job.save();

                    return result;
                } catch (error) {
                    job.status = 'failed';
                    job.error = error.message;
                    job.progress = 0;
                    await job.save();
                    throw error;
                }
            });
        });
    } catch (error) {
        console.error('Upload document error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Stream video with Range Request support and caching
 */
async function streamVideo(req, res) {
    try {
        const { fileId } = req.params;
        const range = req.headers.range;

        const encryptedFile = await EncryptedFile.findOne({ fileId, type: 'video' });

        if (!encryptedFile) {
            return res.status(404).json({
                success: false,
                error: 'Video not found'
            });
        }

        await encryptedFile.incrementAccess();

        const messageId = encryptedFile.telegramMessageId;
        if (!messageId) {
            return res.status(404).json({
                success: false,
                error: 'Telegram message not found'
            });
        }

        // Cache directory
        const os = require('os');
        const cacheDir = path.join(os.tmpdir(), 'video_cache');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        const cachePath = path.join(cacheDir, `${fileId}_decrypted.mp4`);

        // Check cache first
        console.log(`[${fileId}] Checking cache at: ${cachePath}`);
        if (!fs.existsSync(cachePath)) {
            console.log(`[${fileId}] ❌ Cache MISS - downloading and decrypting from Telegram...`);
            console.log(`[${fileId}] This may take several minutes for large videos...`);

            // Download encrypted video từ Telegram
            const result = await telegramClient.downloadFileWithMetadata(messageId);
            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found on Telegram'
                });
            }

            // Giải mã video
            const decryptedBuffer = require('../../utils/crypto').decryptBuffer(result.buffer);

            // Save to cache
            fs.writeFileSync(cachePath, decryptedBuffer);
            console.log(`[${fileId}] Cached decrypted video`);
        } else {
            console.log(`[${fileId}] Cache hit - serving from cache`);
        }

        // Get file stats
        const stats = fs.statSync(cachePath);
        const videoSize = stats.size;

        // Handle Range Request
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
            const chunkSize = (end - start) + 1;

            if (start >= videoSize || end >= videoSize) {
                res.status(416).send('Requested range not satisfiable');
                return;
            }

            // Stream chunk from cache file
            const readStream = fs.createReadStream(cachePath, { start, end });

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${videoSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': encryptedFile.mimeType || 'video/mp4',
                'Cache-Control': 'public, max-age=86400'
            });

            readStream.pipe(res);
        } else {
            // No range request - stream full video
            res.writeHead(200, {
                'Content-Length': videoSize,
                'Content-Type': encryptedFile.mimeType || 'video/mp4',
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=86400'
            });

            const readStream = fs.createReadStream(cachePath);
            readStream.pipe(res);
        }

    } catch (error) {
        console.error('Stream video error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    upload,
    uploadImage,
    uploadMultipleImages,
    uploadVideoFile,
    uploadDocument,
    serveEncryptedImage,
    serveEncryptedFile,
    streamVideo,
    getFileInfo,
    listUserFiles
};
