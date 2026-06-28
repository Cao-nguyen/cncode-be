const Certificate = require('./chungchi.model');
const ProgressService = require('../tiendo/tiendo.service');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

class CertificateService {
    async checkEligible(userId, courseId) {
        const isCompleted = await ProgressService.checkCourseCompleted(userId, courseId);
        return { eligible: isCompleted };
    }

    async getByUserAndCourse(userId, courseId) {
        return Certificate.findOne({ userId, courseId });
    }

    async create(userId, courseId, fullName) {
        const existing = await Certificate.findOne({ userId, courseId });
        if (existing) return existing;

        const eligible = await ProgressService.checkCourseCompleted(userId, courseId);
        if (!eligible) throw new Error('Course not completed yet');

        // Generate certificate image
        const imageUrl = await this.generateCertificateImage(fullName, courseId);

        const certificate = new Certificate({
            userId,
            courseId,
            fullName,
            imageUrl,
            issuedAt: new Date()
        });
        await certificate.save();
        return certificate;
    }

    async generateCertificateImage(fullName, courseId) {
        try {
            const uploadsDir = path.join(__dirname, '../../uploads/certificates');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const fileName = `cert_${courseId}_${Date.now()}.png`;
            const filePath = path.join(uploadsDir, fileName);

            // Create canvas certificate
            const canvas = createCanvas(1200, 800);
            const ctx = canvas.getContext('2d');

            // Background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 1200, 800);

            // Border
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 8;
            ctx.strokeRect(30, 30, 1140, 740);
            ctx.strokeStyle = '#1a365d';
            ctx.lineWidth = 3;
            ctx.strokeRect(45, 45, 1110, 710);

            // Title
            ctx.fillStyle = '#1a365d';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('CHỨNG NHẬN HOÀN THÀNH', 600, 200);

            // Subtitle
            ctx.fillStyle = '#4a5568';
            ctx.font = '24px Arial';
            ctx.fillText('Certificate of Completion', 600, 240);

            // Full name
            ctx.fillStyle = '#1a365d';
            ctx.font = 'bold 42px Arial';
            ctx.fillText(fullName, 600, 380);

            // Line under name
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(300, 400);
            ctx.lineTo(900, 400);
            ctx.stroke();

            // Description
            ctx.fillStyle = '#4a5568';
            ctx.font = '22px Arial';
            ctx.fillText('Đã hoàn thành xuất sắc khoá học tại CNCode', 600, 460);

            // Date
            const date = new Date().toLocaleDateString('vi-VN');
            ctx.font = '20px Arial';
            ctx.fillText(`Ngày cấp: ${date}`, 600, 550);

            // Save
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(filePath, buffer);

            return `/uploads/certificates/${fileName}`;
        } catch (err) {
            console.error('Failed to generate certificate image:', err);
            return null;
        }
    }
}

module.exports = new CertificateService();