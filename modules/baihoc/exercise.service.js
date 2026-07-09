const KHExercise = require('./exercise.model');

// Get exercise by lesson ID
async function getExerciseByLessonId(lessonId) {
    return await KHExercise.findOne({ lessonId });
}

// Get exercise by ID
async function getExerciseById(exerciseId) {
    return await KHExercise.findById(exerciseId);
}

// Get exercises by course ID
async function getExercisesByCourseId(courseId) {
    return await KHExercise.find({ courseId });
}

// Create new exercise
async function createExercise(exerciseData) {
    const exercise = new KHExercise({
        lessonId: exerciseData.lessonId,
        courseId: exerciseData.courseId,
        questions: exerciseData.questions,
        mustPassToNext: exerciseData.mustPassToNext || false
    });

    return await exercise.save();
}

// Update exercise
async function updateExercise(exerciseId, exerciseData) {
    return await KHExercise.findByIdAndUpdate(
        exerciseId,
        {
            $set: {
                questions: exerciseData.questions,
                mustPassToNext: exerciseData.mustPassToNext !== undefined ? exerciseData.mustPassToNext : false
            }
        },
        { new: true }
    );
}

// Delete exercise
async function deleteExercise(exerciseId) {
    return await KHExercise.findByIdAndDelete(exerciseId);
}

module.exports = {
    getExerciseByLessonId,
    getExerciseById,
    getExercisesByCourseId,
    createExercise,
    updateExercise,
    deleteExercise
};