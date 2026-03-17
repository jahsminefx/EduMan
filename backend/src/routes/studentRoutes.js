const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/', protect, requireSchoolScope, studentController.getStudents);
router.post('/', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, studentController.createStudent);
router.put('/:id', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, studentController.updateStudent);
router.delete('/:id', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, studentController.deleteStudent);

module.exports = router;
