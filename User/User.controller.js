const User = require("./User.model");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Generate referral code ───
const generateReferralCode = async () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code, exists;

    do {
        code = Array.from({ length: 8 }, () =>
            chars[Math.floor(Math.random() * chars.length)]
        ).join("");

        exists = await User.findOne({ referralCode: code }).lean();
    } while (exists);

    return code;
};

// ─── JWT ───
const signToken = (userId) =>
    jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

// ─── Google Auth ───
const googleAuth = async (req, res) => {
    try {
        const { token: idToken, referralCode: inputCode } = req.body;

        if (!idToken) {
            return res.status(400).json({ message: "Thiếu token" });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { sub: googleId, email, name, picture } = ticket.getPayload();

        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (!user) {
            let referredByUser = null;

            if (inputCode) {
                referredByUser = await User.findOne({
                    referralCode: inputCode,
                }).lean();
            }

            const referralCode = await generateReferralCode();

            user = await User.create({
                googleId,
                email,
                name,
                avatar: picture,
                referralCode,
                referredBy: referredByUser?._id ?? null,
                cncoins: referredByUser ? 50 : 0,
            });

            // thưởng người giới thiệu
            if (referredByUser) {
                await User.findByIdAndUpdate(referredByUser._id, {
                    $inc: { cncoins: 100 },
                });
            }
        } else {
            if (!user.googleId) {
                user.googleId = googleId;
                if (!user.avatar) user.avatar = picture;
                await user.save();
            }
        }

        const token = signToken(user._id);

        return res.json({
            token,
            user: sanitizeUser(user),
        });
    } catch (err) {
        console.error("[googleAuth]", err);
        return res.status(500).json({
            message: err.message || "Đăng nhập thất bại",
        });
    }
};

// ─── Onboarding ───
const onboarding = async (req, res) => {
    try {
        const { username, birthday, province, className, school, bio } = req.body;

        if (!username || username.trim().length < 3) {
            return res.status(400).json({
                message: "Username phải >= 3 ký tự",
            });
        }

        const cleanUsername = username.trim();

        const existing = await User.findOne({
            username: cleanUsername,
            _id: { $ne: req.userId },
        }).lean();

        if (existing) {
            return res.status(400).json({
                message: "Username đã tồn tại",
            });
        }

        const updated = await User.findByIdAndUpdate(
            req.userId,
            {
                $set: {
                    username: cleanUsername,
                    birthday: birthday ? new Date(birthday) : null,
                    province: province?.trim() || null,
                    className: className?.trim() || null,
                    school: school?.trim() || null,
                    bio: bio?.trim() || null,
                    isProfileCompleted: true,
                },
            },
            { new: true }
        );

        return res.json({
            message: "Cập nhật thành công",
            user: sanitizeUser(updated),
        });
    } catch (err) {
        console.error("[onboarding]", err);
        return res.status(500).json({ message: "Lỗi server" });
    }
};

// ─── Get Me ───
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user || !user.isActive) {
            return res.status(404).json({
                message: "User không tồn tại",
            });
        }

        return res.json(sanitizeUser(user));
    } catch (err) {
        return res.status(500).json({ message: "Lỗi server" });
    }
};

// ─── Sanitize ───
const sanitizeUser = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    username: user.username,
    birthday: user.birthday,
    province: user.province,
    className: user.className,
    school: user.school,
    bio: user.bio,
    role: user.role,
    plan: user.plan,
    cncoins: user.cncoins,
    streak: user.streak,
    referralCode: user.referralCode,
    isProfileCompleted: user.isProfileCompleted,
});

module.exports = { googleAuth, onboarding, getMe };