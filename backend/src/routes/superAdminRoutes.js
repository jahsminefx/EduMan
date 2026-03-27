const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes are SuperAdmin-only
router.use(protect, authorize('SuperAdmin'));

// Stats
router.get('/stats', superAdminController.getGlobalStats);

// Schools CRUD
router.get('/schools', superAdminController.getSchools);
router.get('/schools/:id', superAdminController.getSchoolById);
router.post('/schools', superAdminController.createSchool);
router.put('/schools/:id', superAdminController.updateSchool);

// School Admins CRUD
router.get('/admins', superAdminController.getAdmins);
router.post('/admins', superAdminController.createAdmin);
router.put('/admins/:id', superAdminController.updateAdmin);

module.exports = router;
