const mongoose = require('mongoose');

const workingHoursSchema = new mongoose.Schema({
    dayOfWeek: {
        type: Number, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        required: true,
        min: 0,
        max: 6
    },
    isWorkingDay: {
        type: Boolean,
        default: true
    },
    startTime: {
        type: String, // Format: "HH:mm" e.g., "08:00"
        required: true,
        default: "08:00"
    },
    endTime: {
        type: String, // Format: "HH:mm" e.g., "17:00"
        required: true,
        default: "17:00"
    }
}, {
    timestamps: true
});

// Ensure only one document per day of week
workingHoursSchema.index({ dayOfWeek: 1 }, { unique: true });

// Helper method to check if current time is within working hours
workingHoursSchema.statics.isWithinWorkingHours = async function () {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const config = await this.findOne({ dayOfWeek: currentDay });

    if (!config || !config.isWorkingDay) {
        return false;
    }

    return currentTime >= config.startTime && currentTime <= config.endTime;
};

// Helper method to get all working hours config
workingHoursSchema.statics.getAllConfig = async function () {
    const configs = await this.find().sort({ dayOfWeek: 1 });

    // If no config exists, create default (Mon-Fri 8:00-17:00)
    if (configs.length === 0) {
        const defaultConfig = [];
        for (let day = 0; day <= 6; day++) {
            const isWorkingDay = day >= 1 && day <= 5; // Monday to Friday
            await this.create({
                dayOfWeek: day,
                isWorkingDay,
                startTime: "08:00",
                endTime: "17:00"
            });
            defaultConfig.push({
                dayOfWeek: day,
                isWorkingDay,
                startTime: "08:00",
                endTime: "17:00"
            });
        }
        return defaultConfig;
    }

    return configs;
};

const WorkingHours = mongoose.model('WorkingHours', workingHoursSchema);

module.exports = WorkingHours;