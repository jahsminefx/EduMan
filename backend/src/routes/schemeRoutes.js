const express = require('express');
const router = express.Router();
const schemeController = require('../controllers/schemeController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Options (Classes, Subjects, Sessions, Terms)
router.get(
    '/options',
    protect,
    authorize('Teacher', 'SchoolAdmin', 'SuperAdmin'),
    schemeController.getOptions
);

// List schemes (Filtered for Teacher, Student, Parent, or Admin)
router.get(
    '/',
    protect,
    authorize('Teacher', 'SchoolAdmin', 'SuperAdmin', 'Student', 'Parent'),
    schemeController.getSchemes
);

// Single scheme detail with weekly breakdown
router.get(
    '/:id',
    protect,
    authorize('Teacher', 'SchoolAdmin', 'SuperAdmin', 'Student', 'Parent'),
    schemeController.getSchemeById
);

// Create scheme (Teacher or Admin)
router.post(
    '/',
    protect,
    authorize('Teacher', 'SchoolAdmin', 'SuperAdmin'),
    schemeController.createScheme
);

// Update scheme
router.put(
    '/:id',
    protect,
    authorize('Teacher', 'SchoolAdmin', 'SuperAdmin'),
    schemeController.updateScheme
);

// Toggle publish / draft
router.patch(
    '/:id/publish',
    protect,
    authorize('Teacher', 'SchoolAdmin', 'SuperAdmin'),
    schemeController.publishScheme
);

// Delete scheme
router.delete(
    '/:id',
    protect,
    authorize('Teacher', 'SchoolAdmin', 'SuperAdmin'),
    schemeController.deleteScheme
);

// EduMan AI Review of Scheme of Work
router.post(
    '/:id/ai-review',
    protect,
    authorize('Teacher', 'SchoolAdmin', 'SuperAdmin'),
    schemeController.reviewSchemeWithAI
);

module.exports = router;
