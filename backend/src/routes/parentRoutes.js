const express = require('express');
const router = express.Router();
const parentController = require('../controllers/parentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('Parent'));

router.get('/children', parentController.getChildren);
router.get('/children/:studentId', parentController.getChildProfile);
router.get('/children/:studentId/academics', parentController.getChildAcademics);
router.get('/children/:studentId/attendance', parentController.getChildAttendance);
router.get('/children/:studentId/homework', parentController.getChildHomework);
router.get('/children/:studentId/fees', parentController.getChildFees);
router.get('/receipts/:paymentId', parentController.getPaymentReceipt);

module.exports = router;
