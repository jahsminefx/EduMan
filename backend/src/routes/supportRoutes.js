const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { protect } = require('../middleware/authMiddleware');

// All support routes require logged in user
router.use(protect);

router.get('/analytics', supportController.getAnalytics);
router.post('/bulk', supportController.bulkOperations);
router.get('/canned-responses', supportController.getCannedResponses);
router.post('/canned-responses', supportController.createCannedResponse);

router.get('/tickets', supportController.getThreads);
router.post('/tickets', supportController.createThread);
router.get('/tickets/:id', supportController.getThreadById);
router.put('/tickets/:id', supportController.updateThread);
router.delete('/tickets/:id', supportController.deleteThread);

router.post('/tickets/:id/messages', supportController.addMessage);
router.post('/tickets/:id/feedback', supportController.submitFeedback);
router.post('/tickets/:id/watch', supportController.toggleWatcher);

module.exports = router;
