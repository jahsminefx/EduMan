const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/', protect, requireSchoolScope, subjectController.getSubjects);
router.post('/', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, subjectController.createSubject);
router.put('/:id', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, subjectController.updateSubject);
router.delete('/:id', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, subjectController.deleteSubject);
router.post('/:id/assign', protect, authorize('SchoolAdmin'), requireSchoolScope, subjectController.assignTeacher);

module.exports = router;
