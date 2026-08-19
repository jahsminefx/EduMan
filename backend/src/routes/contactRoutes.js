const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public route
router.post('/', contactController.submitContactForm);

// Support staff routes (SupportOfficer & SuperAdmin)
router.get('/inquiries', protect, authorize('SupportOfficer', 'SuperAdmin'), contactController.getInquiries);
router.get('/inquiries/:id', protect, authorize('SupportOfficer', 'SuperAdmin'), contactController.getInquiryById);
router.post('/inquiries/:id/messages', protect, authorize('SupportOfficer', 'SuperAdmin'), contactController.addInquiryMessage);
router.put('/inquiries/:id/status', protect, authorize('SupportOfficer', 'SuperAdmin'), contactController.updateInquiryStatus);
router.post('/inquiries/:id/convert', protect, authorize('SupportOfficer', 'SuperAdmin'), contactController.convertInquiryToTicket);

module.exports = router;

