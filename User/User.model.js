const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            unique: true,
        },

        username: {
            type: String,
            trim: true,
            unique: true,
            sparse: true,
        },

        avatar: {
            type: String,
            default: null,
        },
        googleId: {
            type: String,
            default: null,
        },
        password: {
            type: String,
            default: null,
        },
        role: {
            type: String,
            enum: ["user", "teacher", "admin"],
            default: "user",
        },

        // ── Onboarding ──
        birthday: {
            type: Date,
            default: null,
        },
        province: {
            type: String,
            trim: true,
            default: null,
        },
        className: {
            type: String,
            trim: true,
            default: null,
        },
        school: {
            type: String,
            trim: true,
            default: null,
        },
        bio: {
            type: String,
            trim: true,
            default: null,
        },
        isProfileCompleted: {
            type: Boolean,
            default: false,
        },

        // ── Coins ──
        cncoins: {
            type: Number,
            default: 0,
        },
        streak: {
            type: Number,
            default: 0,
        },

        // ── Referral ──
        referralCode: {
            type: String,
            unique: true,
            sparse: true,
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // ── Plan ──
        plan: {
            type: String,
            enum: ["basic", "pro"],
            default: "basic",
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

userSchema.index({ googleId: 1 });

module.exports = mongoose.model("User", userSchema);