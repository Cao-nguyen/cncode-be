const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const telegramClientService = require('./telegram-client.service');

const execAsync = promisify(exec);

class ThumbnailService {
    /**
     * Extract thumbnail from video at specific timestamp
     * @param {string} videoPath - Path to video file
     * @param {number} timestamp - Timestamp in seconds (default: 0.5)
     * @returns {Promise<Buffer>} - Thumbnail image buffer
     */
    async extractThumbnail(videoPath, timestamp = 0.5) {
        try {
            const tempDir = os.tmpdir();
            const thumbnailPath = path.join(tempDir, `thumbnail_${Date.now()}.jpg`);

            // Check if ffmpeg is available
            try {
                await execAsync('ffmpeg -version');
            } catch (ffmpegError) {
                console.error('ffmpeg is not installed or not in PATH');
                throw new Error('ffmpeg is not installed. Please install ffmpeg to enable thumbnail generation.');
            }

            // Use ffmpeg to extract frame at timestamp
            const command = `ffmpeg -i "${videoPath}" -ss ${timestamp} -vframes 1 -q:v 2 "${thumbnailPath}" -y`;

            console.log('Extracting thumbnail from video with command:', command);
            await execAsync(command);

            // Check if thumbnail was created
            if (!fs.existsSync(thumbnailPath)) {
                throw new Error('Thumbnail file was not created by ffmpeg');
            }

            // Read the thumbnail file
            const thumbnailBuffer = fs.readFileSync(thumbnailPath);

            // Clean up temp file
            fs.unlinkSync(thumbnailPath);

            console.log('Thumbnail extracted successfully, size:', thumbnailBuffer.length);
            return thumbnailBuffer;
        } catch (error) {
            console.error('Error extracting thumbnail:', error.message);
            throw new Error('Failed to extract thumbnail from video: ' + error.message);
        }
    }

    /**
     * Extract thumbnail from video URL (requires download first)
     * @param {string} videoUrl - URL to video file
     * @param {number} timestamp - Timestamp in seconds (default: 0.5)
     * @returns {Promise<Buffer>} - Thumbnail image buffer
     */
    async extractThumbnailFromUrl(videoUrl, timestamp = 0.5) {
        try {
            const axios = require('axios');
            const tempDir = os.tmpdir();
            const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);

            // Download video
            console.log('Downloading video for thumbnail extraction from:', videoUrl);
            const response = await axios({
                method: 'GET',
                url: videoUrl,
                responseType: 'stream',
                timeout: 30000, // 30 seconds timeout
            });

            const writer = fs.createWriteStream(videoPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            console.log('Video downloaded successfully, size:', fs.statSync(videoPath).size);

            // Extract thumbnail
            const thumbnailBuffer = await this.extractThumbnail(videoPath, timestamp);

            // Clean up temp video file
            fs.unlinkSync(videoPath);

            return thumbnailBuffer;
        } catch (error) {
            console.error('Error extracting thumbnail from URL:', error.message);
            throw new Error('Failed to extract thumbnail from video URL: ' + error.message);
        }
    }

    /**
     * Extract thumbnail from video and upload to Telegram
     * @param {string} videoPath - Path to video file
     * @param {number} timestamp - Timestamp in seconds (default: 0.5)
     * @returns {Promise<Object>} - Upload result with URL
     */
    async extractAndUploadThumbnail(videoPath, timestamp = 0.5) {
        try {
            // Extract thumbnail
            const thumbnailBuffer = await this.extractThumbnail(videoPath, timestamp);

            // Upload to Telegram
            const uploadResult = await telegramClientService.uploadImage(
                thumbnailBuffer,
                `thumbnail_${Date.now()}.jpg`,
                'Video thumbnail'
            );

            if (!uploadResult.success) {
                throw new Error('Failed to upload thumbnail to Telegram');
            }

            console.log('Thumbnail uploaded to Telegram:', uploadResult.url);
            return uploadResult;
        } catch (error) {
            console.error('Error extracting and uploading thumbnail:', error);
            throw error;
        }
    }

    /**
     * Extract thumbnail from video URL and upload to Telegram
     * @param {string} videoUrl - URL to video file
     * @param {number} timestamp - Timestamp in seconds (default: 0.5)
     * @returns {Promise<Object>} - Upload result with URL
     */
    async extractAndUploadThumbnailFromUrl(videoUrl, timestamp = 0.5) {
        try {
            // Extract thumbnail from URL
            const thumbnailBuffer = await this.extractThumbnailFromUrl(videoUrl, timestamp);

            // Upload to Telegram
            const uploadResult = await telegramClientService.uploadImage(
                thumbnailBuffer,
                `thumbnail_${Date.now()}.jpg`,
                'Video thumbnail'
            );

            if (!uploadResult.success) {
                throw new Error('Failed to upload thumbnail to Telegram');
            }

            console.log('Thumbnail uploaded to Telegram:', uploadResult.url);
            return uploadResult;
        } catch (error) {
            console.error('Error extracting and uploading thumbnail from URL:', error);
            throw error;
        }
    }
}

module.exports = new ThumbnailService();
