const telegramService =
    require('./telegram-bot.service.js');

class UploadService {

    async uploadFromBase64(
        base64String,
        folder = 'general'
    ) {

        try {

            const result =
                await telegramService.uploadBase64(
                    base64String
                );

            if (result.success) {

                return {
                    success: true,
                    url: result.url,
                    messageId: result.messageId,
                    folder,
                };
            }

            return {
                success: false,
                error: result.error,
            };

        } catch (error) {

            return {
                success: false,
                error: error.message,
            };
        }
    }

    async uploadMultiple(
        images,
        folder = 'general'
    ) {

        const results = [];

        for (const image of images) {

            const result =
                await this.uploadFromBase64(
                    image.base64,
                    folder
                );

            results.push(result);
        }

        return results;
    }
}

module.exports =
    new UploadService();