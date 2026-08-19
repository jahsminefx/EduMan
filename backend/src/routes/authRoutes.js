const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { setupTokenLimiter } = require('../middleware/rateLimiter');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/me', protect, authController.getMe);
router.get('/verify-setup-token', setupTokenLimiter, authController.verifySetupToken);
router.post('/setup-password', setupTokenLimiter, authController.setupPassword);

module.exports = router;
