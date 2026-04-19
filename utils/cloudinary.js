// utils/cloudinary.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const extractPublicId = (url) => {
    if (!url) return null;
    const parts = url.split('/');
    const filename = parts.pop();
    const publicId = filename.split('.')[0];
    const folder = parts.slice(-2)[0];
    return `${folder}/${publicId}`;
};

const deleteImage = async (url) => {
    try {
        const publicId = extractPublicId(url);
        if (!publicId) return { success: false };
        const result = await cloudinary.uploader.destroy(publicId);
        return { success: result.result === 'ok', result };
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        return { success: false, error };
    }
};

const deleteMultipleImages = async (urls) => {
    const results = await Promise.all(urls.map(url => deleteImage(url)));
    return results;
};

module.exports = { cloudinary, extractPublicId, deleteImage, deleteMultipleImages };