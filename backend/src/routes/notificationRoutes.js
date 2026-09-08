const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', notificationController.getNotifications);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);

// Web Push Notification Endpoints
router.get('/vapid-public-key', notificationController.getVapidPublicKey);
router.post('/push-subscribe', notificationController.subscribePush);
router.delete('/push-subscribe', notificationController.unsubscribePush);
router.post('/broadcast', authorize('SuperAdmin'), notificationController.broadcastNotification);

module.exports = router;

