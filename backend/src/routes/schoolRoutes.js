const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const schoolController = require('../controllers/schoolController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `school_logo_${Date.now()}${path.extname(file.originalname)}`)
});

const logoUpload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const isImage = file.mimetype?.startsWith('image/') && ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
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
