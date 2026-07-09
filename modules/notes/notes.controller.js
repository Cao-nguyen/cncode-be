const Note = require('./notes.model');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class NotesController {
    async createNote(req, res) {
        try {
            const { lessonId, courseId, time, timeStr, text } = req.body;
            const userId = req.userId;

            const note = await Note.create({
                userId,
                lessonId,
                courseId,
                time,
                timeStr,
                text,
            });

            return successResponse(res, 201, 'Note created', note);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to create note', err);
        }
    }

    async getNotesByLesson(req, res) {
        try {
            const { lessonId } = req.params;
            const userId = req.userId;

            const notes = await Note.find({ userId, lessonId }).sort({ time: 1 });
            return successResponse(res, 200, 'Notes retrieved', notes);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get notes', err);
        }
    }

    async getNotesByCourse(req, res) {
        try {
            const { courseId } = req.params;
            const userId = req.userId;

            const notes = await Note.find({ userId, courseId }).sort({ lessonId: 1, time: 1 });
            return successResponse(res, 200, 'Notes retrieved', notes);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to get notes', err);
        }
    }

    async updateNote(req, res) {
        try {
            const { noteId } = req.params;
            const { text } = req.body;
            const userId = req.userId;

            const note = await Note.findOne({ _id: noteId, userId });
            if (!note) {
                return errorResponse(res, 404, 'Note not found');
            }

            note.text = text;
            await note.save();

            return successResponse(res, 200, 'Note updated', note);
        } catch (err) {
            return errorResponse(res, 500, 'Failed to update note', err);
        }
    }

    async deleteNote(req, res) {
        try {
            const { noteId } = req.params;
            const userId = req.userId;

            const note = await Note.findOne({ _id: noteId, userId });
            if (!note) {
                return errorResponse(res, 404, 'Note not found');
            }

            await Note.deleteOne({ _id: noteId });

            return successResponse(res, 200, 'Note deleted');
        } catch (err) {
            return errorResponse(res, 500, 'Failed to delete note', err);
        }
    }
}

module.exports = new NotesController();
