const jwt = require("jsonwebtoken");
const User = require("../User/User.model");

const authenticate = async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Không có token xác thực" });
    }

    const token = auth.split(" ")[1];
    try {
        const { userId } = jwt.verify(token, process.env.JWT_SECRET);
        // Gắn role để requireRole dùng được
        const user = await User.findById(userId).select("role isActive").lean();
        if (!user || !user.isActive) {
            return res.status(401).json({ message: "Tài khoản không hợp lệ" });
        }
        req.userId = userId;
        req.userRole = user.role;
        next();
    } catch {
        return res.status(401).json({ message: "Token không hợp lệ hoặc hết hạn" });
    }
};

const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.userRole)) {
        return res.status(403).json({ message: "Không có quyền truy cập" });
    }
    next();
};

module.exports = { authenticate, requireRole };