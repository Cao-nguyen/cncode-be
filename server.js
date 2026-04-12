require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const userRoutes = require("./User/User.routes");
const exerciseRoutes = require("./Exercise/Exercise.routes"); // ← THÊM DÒNG NÀY

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
    "http://localhost:3000",
    "https://cncode.io.vn",
    "https://cncode.vercel.app",
    process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(new Error("CORS blocked: " + origin));
    },
    credentials: true,
}));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", userRoutes);
app.use("/api", exerciseRoutes); // ← THÊM DÒNG NÀY

app.get("/health", (_, res) => res.send("ok"));

app.use((req, res) => res.status(404).json({ message: "Route không tồn tại" }));

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Lỗi server" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB connected");
        app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
    })
    .catch((err) => {
        console.error("❌ MongoDB failed:", err.message);
        process.exit(1);
    });