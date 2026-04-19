const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const sharp = require('sharp');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'), false);
  },
});

const compressBuffer = async (buffer, mimetype) => {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const maxWidth = 1280;
  const shouldResize = metadata.width && metadata.width > maxWidth;

  let pipeline = shouldResize ? image.resize({ width: maxWidth, withoutEnlargement: true }) : image;

  if (mimetype === 'image/png') {
    return pipeline.png({ quality: 80, compressionLevel: 8 }).toBuffer();
  }
  return pipeline.jpeg({ quality: 80, progressive: true }).toBuffer();
};

const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: 'image',
          eager: [{ width: 400, crop: 'scale', quality: 'auto:low', format: 'webp' }],
          eager_async: true,
          quality: 'auto',
          fetch_format: 'auto',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      )
      .end(buffer);
  });
};

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const folder = `cncode/${req.body.folder || 'general'}`;
    const compressed = await compressBuffer(req.file.buffer, req.file.mimetype);
    const result = await uploadBufferToCloudinary(compressed, folder);

    res.status(200).json({
      success: true,
      data: { url: result.secure_url, publicId: result.public_id },
      message: 'Upload successful',
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
};

const uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const folder = `cncode/${req.body.folder || 'general'}`;

    const results = await Promise.all(
      req.files.map(async (file) => {
        const compressed = await compressBuffer(file.buffer, file.mimetype);
        return uploadBufferToCloudinary(compressed, folder);
      }),
    );

    res.status(200).json({
      success: true,
      data: {
        urls: results.map((r) => r.secure_url),
        publicIds: results.map((r) => r.public_id),
      },
      message: 'Upload successful',
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
};

module.exports = { upload, uploadImage, uploadMultipleImages };