const express = require("express");
const router = express.Router();
const {
    getExercises,
    getExerciseById,
    submitExercise,
    spinWheel,
    createExercise,
    updateExerciseStatus,
    getMySubmissions,
} = require("./Exercise.controller");
const { authenticate, requireRole } = require("../../middleware/auth.middleware");

// Public
router.get("/exercises", getExercises);
router.get("/exercises/my-submissions", authenticate, getMySubmissions);
router.get("/exercises/:id", getExerciseById);

// Protected - cần đăng nhập
router.post("/exercises/:id/submit", authenticate, submitExercise);
router.post("/exercises/submissions/:submissionId/spin", authenticate, spinWheel);
router.post("/exercises", authenticate, createExercise);

// Admin only
router.patch("/exercises/:id/status", authenticate, requireRole("admin"), updateExerciseStatus);

module.exports = router;