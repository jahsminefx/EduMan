const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { protect, authorize } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too Many Requests', message: 'Too many contact messages sent. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Public routes
router.post('/', contactLimiter, contactController.submitContactForm);
router.get('/track/:inquiryNumber', contactController.getTrackedInquiry);
router.post('/track/:inquiryNumber/reply', contactController.addTrackedInquiryMessage);

// Support staff routes (SupportOfficer & SuperAdmin)
router.get('/inquiries', protect, authorize('SupportOfficer', 'SuperAdmin'), contactController.getInquiries);
router.get('/inquiries/:id', protect, authorize('SupportOfficer', 'SuperAdmin'), contactController.getInquiryById);
router.post('/inquiries/:id/messages', protect, authorize('SupportOfficer', 'SuperAdmin'), contactController.addInquiryMessage);
router.put('/inquiries/:id/status', protect, authorize('SupportOfficer', 'SuperAdmin'), contactController.updateInquiryStatus);
router.post('/inquiries/:id/convert', protect, authorize('SupportOfficer', 'SuperAdmin'), contactController.convertInquiryToTicket);

module.exports = router;

