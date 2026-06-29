const express = require('express');
const router = express.Router();
const classInfoController = require('../controllers/classInfoController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/my', protect, authorize('Student'), requireSchoolScope, classInfoController.getMyClassInfo);
router.get('/teacher/classes', protect, authorize('Teacher'), requireSchoolScope, classInfoController.getFormTeacherClasses);
router.get('/classes/:classId', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, classInfoController.getClassInfo);

router.post('/timetables', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, classInfoController.createTimetableEntry);
router.put('/timetables/:id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, classInfoController.updateTimetableEntry);
router.delete('/timetables/:id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, classInfoController.deleteTimetableEntry);

router.post('/announcements', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, classInfoController.createAnnouncement);
router.delete('/announcements/:id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, classInfoController.deleteAnnouncement);

router.post('/events', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, classInfoController.createEvent);
router.delete('/events/:id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, classInfoController.deleteEvent);

module.exports = router;
