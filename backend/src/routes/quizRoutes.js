const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('SchoolAdmin', 'Teacher', 'Student'), requireSchoolScope, quizController.getQuizzes);
router.post('/', protect, authorize('Teacher'), requireSchoolScope, quizController.createQuiz);
router.get('/:id', protect, requireSchoolScope, quizController.getQuizDetails);
router.get('/:id/review', protect, authorize('Student'), requireSchoolScope, quizController.reviewQuiz);
router.post('/submit', protect, authorize('Student'), requireSchoolScope, quizController.submitQuiz);
router.delete('/:id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, quizController.deleteQuiz);

module.exports = router;
