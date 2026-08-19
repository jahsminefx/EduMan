const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('Accountant', 'SchoolAdmin', 'SuperAdmin'));
router.use(requireSchoolScope);

router.get('/overview', financeController.getOverview);

router.get('/fees', financeController.getFeeStructures);
router.post('/fees', financeController.createFeeStructure);
router.post('/fees/assign', financeController.assignFeesToStudents);

router.get('/invoices', financeController.getInvoices);
router.get('/invoices/:id', financeController.getInvoiceById);

router.post('/payments', financeController.recordPayment);
router.put('/payments/:id/verify', financeController.verifyPayment);

router.post('/discounts', financeController.applyDiscount);
router.post('/refunds', financeController.processRefund);

router.get('/reports', financeController.getReports);
router.get('/audit-logs', financeController.getAuditLogs);

// SchoolAdmin can create Accountants
router.post('/accountants', authorize('SchoolAdmin', 'SuperAdmin'), financeController.createAccountant);

module.exports = router;
