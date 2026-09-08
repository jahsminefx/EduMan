const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { setupTokenLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/me', protect, authController.getMe);
router.get('/verify-setup-token', setupTokenLimiter, authController.verifySetupToken);
router.post('/setup-password', setupTokenLimiter, authController.setupPassword);

// Password Reset Routes
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/verify-reset-code', forgotPasswordLimiter, authController.verifyResetCode);
router.post('/reset-password', forgotPasswordLimiter, authController.resetPassword);

module.exports = router;
