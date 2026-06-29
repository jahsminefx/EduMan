const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const announcementController = require('../controllers/announcementController');
const { protect, authorize, requireSchoolScope } = require('../middleware/authMiddleware');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../../uploads');
const allowedExtensions = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf'
]);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `announcement_${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowedExtensions.has(ext));
    }
});

const announcementUpload = upload.fields([
    { name: 'featured_image_file', maxCount: 1 },
    { name: 'attachment_file', maxCount: 1 }
]);

router.get('/', protect, requireSchoolScope, announcementController.listAnnouncements);
router.get('/:id', protect, requireSchoolScope, announcementController.getAnnouncement);
router.post('/', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, announcementUpload, announcementController.createAnnouncement);
router.put('/:id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, announcementUpload, announcementController.updateAnnouncement);
router.delete('/:id', protect, authorize('SchoolAdmin', 'Teacher'), requireSchoolScope, announcementController.deleteAnnouncement);

module.exports = router;
