const exerciseService = require('./exercise.service');

// GET /api/exercise/lesson/:lessonId
async function getExerciseByLessonId(req, res) {
    try {
        const { lessonId } = req.params;
        const exercise = await exerciseService.getExerciseByLessonId(lessonId);

        if (!exercise) {
            return res.status(404).json({ message: 'Exercise not found' });
        }

        res.json(exercise);
    } catch (error) {
        console.error('[Exercise] Get by lesson error:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

// GET /api/exercise/:exerciseId
async function getExerciseById(req, res) {
    try {
        const { exerciseId } = req.params;
        const exercise = await exerciseService.getExerciseById(exerciseId);

        if (!exercise) {
            return res.status(404).json({ message: 'Exercise not found' });
        }

        res.json(exercise);
    } catch (error) {
        console.error('[Exercise] Get by ID error:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

// GET /api/exercise/course/:courseId
async function getExercisesByCourseId(req, res) {
    try {
        const { courseId } = req.params;
        const exercises = await exerciseService.getExercisesByCourseId(courseId);
        res.json(exercises);
    } catch (error) {
        console.error('[Exercise] Get by course error:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

// POST /api/exercise/lesson/:lessonId
async function createExercise(req, res) {
    try {
        const { lessonId } = req.params;
        const { courseId, questions, mustPassToNext } = req.body;

        if (!courseId || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const exerciseData = {
            lessonId,
            courseId,
            questions,
            mustPassToNext
        };

        const exercise = await exerciseService.createExercise(exerciseData);
        res.status(201).json(exercise);
    } catch (error) {
        console.error('[Exercise] Create error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Exercise already exists for this lesson' });
        }
        res.status(500).json({ message: 'Server error' });
    }
}

// PUT /api/exercise/:exerciseId
async function updateExercise(req, res) {
    try {
        const { exerciseId } = req.params;
        const { questions, mustPassToNext } = req.body;

        if (!questions || !Array.isArray(questions)) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const exercise = await exerciseService.updateExercise(exerciseId, {
            questions,
            mustPassToNext
        });

        if (!exercise) {
            return res.status(404).json({ message: 'Exercise not found' });
        }

        res.json(exercise);
    } catch (error) {
        console.error('[Exercise] Update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

// DELETE /api/exercise/:exerciseId
async function deleteExercise(req, res) {
    try {
        const { exerciseId } = req.params;
        const exercise = await exerciseService.deleteExercise(exerciseId);

        if (!exercise) {
            return res.status(404).json({ message: 'Exercise not found' });
        }

        res.json({ message: 'Exercise deleted successfully' });
    } catch (error) {
        console.error('[Exercise] Delete error:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

module.exports = {
    getExerciseByLessonId,
    getExerciseById,
    getExercisesByCourseId,
    createExercise,
    updateExercise,
    deleteExercise
};