const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All support routes require logged in user
router.use(protect);

router.get('/analytics', authorize('SupportOfficer', 'SuperAdmin'), supportController.getAnalytics);
router.post('/bulk', authorize('SupportOfficer', 'SuperAdmin'), supportController.bulkOperations);
router.get('/canned-responses', authorize('SupportOfficer', 'SuperAdmin'), supportController.getCannedResponses);
router.post('/canned-responses', authorize('SupportOfficer', 'SuperAdmin'), supportController.createCannedResponse);

router.get('/tickets', supportController.getThreads);
router.post('/tickets', supportController.createThread);
router.get('/tickets/:id', supportController.getThreadById);
router.put('/tickets/:id', supportController.updateThread);
router.post('/tickets/:id/escalate', authorize('SupportOfficer', 'SuperAdmin'), supportController.escalateThread);
router.delete('/tickets/:id', authorize('SuperAdmin'), supportController.deleteThread);

router.post('/tickets/:id/messages', supportController.addMessage);
router.post('/tickets/:id/feedback', supportController.submitFeedback);
router.post('/tickets/:id/watch', supportController.toggleWatcher);

module.exports = router;
