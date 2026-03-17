const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('SuperAdmin', 'SchoolAdmin'), requireSchoolScope, assignmentController.getAssignments);
router.post('/', protect, authorize('SchoolAdmin'), requireSchoolScope, assignmentController.assignTeacher);
router.delete('/:id', protect, authorize('SchoolAdmin'), requireSchoolScope, assignmentController.removeAssignment);

module.exports = router;
