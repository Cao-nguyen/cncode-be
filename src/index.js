const express = require("express");
require("dotenv").config();
const { connectDB } = require("./libs/mongodb");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Route test
app.get("/", (req, res) => {
    res.send("Lý Cao Nguyên 11A10")
});

const startServer = async () => {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
};

startServer();