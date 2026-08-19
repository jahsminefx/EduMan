const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { resendInvitationLimiter } = require('../middleware/rateLimiter');

// All routes are SuperAdmin-only
router.use(protect, authorize('SuperAdmin'));

// Stats & Command Center
router.get('/stats', superAdminController.getGlobalStats);
router.get('/command-center', superAdminController.getCommandCenter);
router.get('/users/search', superAdminController.searchUsers);
router.get('/audit-logs', superAdminController.getAuditLogs);
router.get('/escalations', superAdminController.getEscalations);

// Settings
router.get('/settings', superAdminController.getSettings);
router.put('/settings', superAdminController.updateSettings);

// Platform Staff Management (ContentManager & SupportOfficer ONLY)
router.get('/platform-staff', superAdminController.getPlatformStaff);
router.post('/platform-staff', superAdminController.createPlatformStaff);
router.get('/platform-staff/:id', superAdminController.getPlatformStaffById);
router.put('/platform-staff/:id', superAdminController.updatePlatformStaff);
router.put('/platform-staff/:id/status', superAdminController.updatePlatformStaffStatus);
router.post('/platform-staff/:id/resend-invitation', resendInvitationLimiter, superAdminController.resendStaffInvitation);
router.post('/platform-staff/:id/reset-access', resendInvitationLimiter, superAdminController.resetStaffAccess);
router.post('/platform-staff/:id/revoke-sessions', superAdminController.revokeStaffSessions);

// Schools Lifecycle & CRUD
router.get('/schools', superAdminController.getSchools);
router.get('/schools/:id', superAdminController.getSchoolById);
router.post('/schools', superAdminController.createSchool);
router.put('/schools/:id', superAdminController.updateSchool);
router.put('/schools/:id/suspend', superAdminController.suspendSchool);
router.put('/schools/:id/reactivate', superAdminController.reactivateSchool);
router.put('/schools/:id/archive', superAdminController.archiveSchool);

// School Admins CRUD
router.get('/admins', superAdminController.getAdmins);
router.post('/admins', superAdminController.createAdmin);
router.put('/admins/:id', superAdminController.updateAdmin);

module.exports = router;
