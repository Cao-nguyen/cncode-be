const express = require('express');
const router = express.Router();
const notesController = require('./notes.controller');
const { authenticate } = require('../../middleware/auth.middleware');

// All note routes require authentication
router.post('/', authenticate, notesController.createNote);
router.get('/lesson/:lessonId', authenticate, notesController.getNotesByLesson);
router.get('/course/:courseId', authenticate, notesController.getNotesByCourse);
router.put('/:noteId', authenticate, notesController.updateNote);
router.delete('/:noteId', authenticate, notesController.deleteNote);

module.exports = router;
