const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { protect, requireSchoolScope } = require('../middleware/authMiddleware');

router.get('/dashboard', protect, requireSchoolScope, statsController.getDashboardStats);
router.get('/performance', protect, requireSchoolScope, statsController.getPerformanceSnapshot);
router.get('/pending', protect, requireSchoolScope, statsController.getPendingTasks);

module.exports = router;
