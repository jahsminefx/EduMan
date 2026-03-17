const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, gradeController.getGrades);
router.post('/', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, gradeController.saveGrades);
router.get('/report/:studentId/:termId', protect, requireSchoolScope, gradeController.getStudentReport);

module.exports = router;
