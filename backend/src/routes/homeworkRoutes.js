const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const homeworkController = require('../controllers/homeworkController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

// Multer config for homework file attachments
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `hw_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

router.get('/', protect, authorize('SchoolAdmin', 'Teacher', 'Student', 'Parent'), requireSchoolScope, homeworkController.getHomework);
router.post('/', protect, authorize('Teacher'), requireSchoolScope, upload.single('file'), homeworkController.createHomework);
router.delete('/:id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, homeworkController.deleteHomework);
router.post('/submit', protect, authorize('Student'), requireSchoolScope, upload.single('file'), homeworkController.submitHomework);
router.get('/submissions/:homeworkId', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, homeworkController.getSubmissions);

module.exports = router;
