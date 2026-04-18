const cloudinary = require('cloudinary').v2
const multer = require('multer')
const { Readable } = require('stream')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const storage = multer.memoryStorage()
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only images are allowed'), false)
    }
  }
})

const uploadToCloudinary = (file, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folder, resource_type: 'auto' },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    )
    const readableStream = new Readable()
    readableStream.push(file.buffer)
    readableStream.push(null)
    readableStream.pipe(stream)
  })
}

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      })
    }

    const folder = `cncode/digital-products/${req.body.folder || 'general'}`
    const result = await uploadToCloudinary(req.file, folder)

    res.status(200).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id
      },
      message: 'Upload successful'
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed'
    })
  }
}

const uploadMultipleImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      })
    }

    const folder = `cncode/digital-products/${req.body.folder || 'general'}`
    const uploadPromises = req.files.map(file => uploadToCloudinary(file, folder))
    const results = await Promise.all(uploadPromises)

    const urls = results.map(result => result.secure_url)

    res.status(200).json({
      success: true,
      data: {
        urls: urls,
        publicIds: results.map(r => r.public_id)
      },
      message: 'Upload successful'
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed'
    })
  }
}

module.exports = {
  upload,
  uploadImage,
  uploadMultipleImages
}