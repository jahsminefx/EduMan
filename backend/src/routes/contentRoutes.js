const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const contentController = require('../controllers/contentController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

// Multer config for learning content files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `content_${Date.now()}${path.extname(file.originalname)}`)
});
const allowedExtensions = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.mp4', '.mov', '.webm', '.m4v',
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf'
]);
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowedExtensions.has(ext));
    }
});

router.get('/', protect, contentController.getContents);
router.post('/', protect, authorize('ContentManager', 'Teacher', 'SchoolAdmin'), upload.single('file'), contentController.uploadContent);
router.delete('/:id', protect, authorize('ContentManager', 'SchoolAdmin'), contentController.deleteContent);

module.exports = router;
