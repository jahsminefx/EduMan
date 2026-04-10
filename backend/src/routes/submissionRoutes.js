const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const submissionController = require('../controllers/submissionController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

// Multer config for assignment submissions
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads/submissions');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
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

router.post('/submit', protect, authorize('Student'), requireSchoolScope, (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File Too Large', message: 'File size exceeds 50MB limit.' });
            }
            return res.status(400).json({ error: 'Upload Error', message: err.message });
        } else if (err) {
            return res.status(400).json({ error: 'Upload Error', message: err.message });
        }
        next();
    });
}, submissionController.submitAssignment);

router.get('/my-submissions', protect, authorize('Student'), requireSchoolScope, submissionController.getMySubmissions);
router.get('/status/:assignment_id', protect, authorize('Student'), requireSchoolScope, submissionController.getSubmissionStatus);
router.get('/statuses', protect, authorize('Student'), requireSchoolScope, submissionController.getSubmissionStatuses);
router.get('/assignment/:assignment_id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, submissionController.getSubmissions);

module.exports = router;
