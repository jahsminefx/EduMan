const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/classes', protect, requireSchoolScope, classController.getClasses);
router.post('/classes', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, classController.createClass);
router.put('/classes/:id', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, classController.updateClass);
router.delete('/classes/:id', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, classController.deleteClass);
router.get('/subjects', protect, requireSchoolScope, classController.getSubjects);
router.post('/subjects', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, classController.createSubject);

module.exports = router;
