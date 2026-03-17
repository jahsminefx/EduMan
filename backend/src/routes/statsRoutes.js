const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { protect, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/dashboard', protect, statsController.getDashboardStats);
router.get('/performance', protect, statsController.getPerformanceSnapshot);
router.get('/pending', protect, statsController.getPendingTasks);

module.exports = router;
