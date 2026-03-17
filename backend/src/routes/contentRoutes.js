const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const contentController = require('../controllers/contentController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

// Multer config for learning content files
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
    filename: (req, file, cb) => cb(null, `content_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB for videos

router.get('/', protect, contentController.getContents);
router.post('/', protect, authorize('ContentManager', 'Teacher', 'SchoolAdmin'), upload.single('file'), contentController.uploadContent);
router.delete('/:id', protect, authorize('ContentManager', 'SchoolAdmin'), contentController.deleteContent);

module.exports = router;
