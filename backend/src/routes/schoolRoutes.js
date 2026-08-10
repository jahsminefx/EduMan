const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const schoolController = require('../controllers/schoolController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');
const { ALLOWED_IMAGE_EXTENSIONS } = require('../utils/cloudinaryImage');

const logoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const isImage = file.mimetype?.startsWith('image/') && ALLOWED_IMAGE_EXTENSIONS.has(ext);
        cb(null, Boolean(isImage));
    }
});

// SuperAdmin APIs (Global)
router.get('/all', protect, authorize('SuperAdmin'), schoolController.getAllSchools);
router.post('/', protect, authorize('SuperAdmin'), schoolController.createSchool);

// SchoolAdmin/Teacher/Student APIs (Scoped)
router.get('/profile', protect, requireSchoolScope, schoolController.getMySchool);
router.put('/profile', protect, authorize('SchoolAdmin'), requireSchoolScope, logoUpload.single('logo'), schoolController.updateMySchool);

router.get('/sessions', protect, requireSchoolScope, schoolController.getSessions);
router.post('/sessions', protect, authorize('SchoolAdmin'), requireSchoolScope, schoolController.createSession);

router.get('/terms', protect, requireSchoolScope, schoolController.getTerms);
router.post('/terms', protect, authorize('SchoolAdmin'), requireSchoolScope, schoolController.createTerm);

module.exports = router;
