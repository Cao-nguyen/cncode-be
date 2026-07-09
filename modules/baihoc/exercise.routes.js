const express = require('express');
const router = express.Router();
const exerciseController = require('./exercise.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// Get exercise by lesson ID
router.get('/lesson/:lessonId', authenticate, exerciseController.getExerciseByLessonId);

// Get exercise by ID
router.get('/:exerciseId', authenticate, exerciseController.getExerciseById);

// Get exercises by course ID
router.get('/course/:courseId', authenticate, exerciseController.getExercisesByCourseId);

// Create exercise for a lesson
router.post('/lesson/:lessonId', authenticate, exerciseController.createExercise);

// Update exercise
router.put('/:exerciseId', authenticate, exerciseController.updateExercise);

// Delete exercise
router.delete('/:exerciseId', authenticate, exerciseController.deleteExercise);

module.exports = router;