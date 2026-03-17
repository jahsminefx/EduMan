const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, attendanceController.getAttendance);
router.post('/', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, attendanceController.markAttendance);
router.get('/summary/:studentId', protect, requireSchoolScope, attendanceController.getStudentAttendanceSummary);

module.exports = router;
