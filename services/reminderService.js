const { Message } = require('../modules/chat/chat.model');
const { io } = require('../server');

class ReminderService {
    constructor() {
        this.checkInterval = null;
    }

    start() {
        console.log('🔔 Reminder service started');

        this.checkReminders();

        this.checkInterval = setInterval(() => {
            this.checkReminders();
        }, 60000);
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('🔕 Reminder service stopped');
        }
    }

    async checkReminders() {
        try {
            const now = new Date();

            const reminders = await Message.find({
                type: 'reminder',
                'reminder.isTriggered': false,
                'reminder.scheduledTime': { $lte: now },
                isDeleted: false
            }).populate('senderId', 'fullName avatar')
                .populate('conversationId', 'participants');

            if (reminders.length > 0) {
                console.log(`⏰ Found ${reminders.length} reminder(s) to trigger`);
            }

            // Trigger each reminder
            for (const reminder of reminders) {
                await this.triggerReminder(reminder);
            }
        } catch (error) {
            console.error('Error checking reminders:', error);
        }
    }

    // Trigger a specific reminder
    async triggerReminder(reminder) {
        try {
            // Mark as triggered
            reminder.reminder.isTriggered = true;
            reminder.reminder.triggeredAt = new Date();
            await reminder.save();

            // Emit socket event to all participants in the conversation
            if (reminder.conversationId && reminder.conversationId.participants) {
                reminder.conversationId.participants.forEach(participant => {
                    io.to(`user_${participant.userId}`).emit('reminder_triggered', {
                        messageId: reminder._id,
                        conversationId: reminder.conversationId._id,
                        title: reminder.reminder.title,
                        scheduledTime: reminder.reminder.scheduledTime,
                        sender: {
                            _id: reminder.senderId._id,
                            fullName: reminder.senderId.fullName,
                            avatar: reminder.senderId.avatar
                        }
                    });
                });
            }

            console.log(`✅ Triggered reminder: ${reminder.reminder.title}`);
        } catch (error) {
            console.error('Error triggering reminder:', error);
        }
    }
}

// Create singleton instance
const reminderService = new ReminderService();

module.exports = reminderService;