const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const submissionController = require('../controllers/submissionController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

// Multer config for assignment submissions
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads/submissions')),
    filename: (req, file, cb) => cb(null, `sub_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`)
});

const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.mp4', '.mov', '.webm', '.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file format. Please upload Video, PDF, or Image.'));
    }
};

const upload = multer({ 
    storage, 
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

router.post('/submit', protect, authorize('Student'), requireSchoolScope, upload.single('file'), submissionController.submitAssignment);
router.get('/my-submissions', protect, authorize('Student'), requireSchoolScope, submissionController.getMySubmissions);
router.get('/assignment/:assignment_id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, submissionController.getSubmissions);

module.exports = router;
