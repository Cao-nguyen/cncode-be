const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
    const auth = req.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Không có token xác thực" });
    }

    const token = auth.split(" ")[1];

    try {
        const { userId } = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = userId;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }
};

module.exports = { authenticate };