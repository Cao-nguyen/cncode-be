const express = require("express");
const router = express.Router();
const { googleAuth, onboarding, getMe } = require("./User.controller");
const { authenticate } = require("../middleware/auth.middleware");

// Public
router.post("/user/google", googleAuth);

// Protected
router.post("/user/onboarding", authenticate, onboarding);
router.get("/user/me", authenticate, getMe);

module.exports = router;