const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, teacherController.getTeachers);
router.post('/', protect, authorize('SchoolAdmin'), requireSchoolScope, teacherController.createTeacher);
router.put('/:id', protect, authorize('SchoolAdmin'), requireSchoolScope, teacherController.updateTeacher);
router.delete('/:id', protect, authorize('SchoolAdmin'), requireSchoolScope, teacherController.deleteTeacher);

module.exports = router;
