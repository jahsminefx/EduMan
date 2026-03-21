const express = require('express');
const router = express.Router();
const schoolController = require('../controllers/schoolController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

// SuperAdmin APIs (Global)
router.get('/all', protect, authorize('SuperAdmin'), schoolController.getAllSchools);
router.post('/', protect, authorize('SuperAdmin'), schoolController.createSchool);

// SchoolAdmin/Teacher/Student APIs (Scoped)
router.get('/profile', protect, requireSchoolScope, schoolController.getMySchool);
router.put('/profile', protect, authorize('SchoolAdmin'), requireSchoolScope, schoolController.updateMySchool);

router.get('/sessions', protect, requireSchoolScope, schoolController.getSessions);
router.post('/sessions', protect, authorize('SchoolAdmin'), requireSchoolScope, schoolController.createSession);

router.get('/terms', protect, requireSchoolScope, schoolController.getTerms);
router.post('/terms', protect, authorize('SchoolAdmin'), requireSchoolScope, schoolController.createTerm);

module.exports = router;
