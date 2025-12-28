const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Route test
app.get("/", (req, res) => {
    res.send("Lý Cao Nguyên 11A10")
});

// Start server
app.listen(PORT, () => {
    console.log(`Đã chạy thành công http://localhost:${PORT}`);
});