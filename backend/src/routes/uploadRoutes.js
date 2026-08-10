const express = require('express');
const multer = require('multer');
const path = require('path');
const uploadController = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');
const { ALLOWED_IMAGE_EXTENSIONS, ALLOWED_VIDEO_EXTENSIONS } = require('../utils/cloudinaryImage');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowed = file.mimetype?.startsWith('image/') && ALLOWED_IMAGE_EXTENSIONS.has(ext);
        cb(null, Boolean(allowed));
    }
});

const videoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowed = file.mimetype?.startsWith('video/') && ALLOWED_VIDEO_EXTENSIONS.has(ext);
        cb(null, Boolean(allowed));
    }
});

function imageUpload(req, res, next) {
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'file', maxCount: 1 }
    ])(req, res, err => {
        if (!err) return next();

        if (err instanceof multer.MulterError) {
            return res.status(400).json({
                error: 'Validation Error',
                message: err.code === 'LIMIT_FILE_SIZE'
                    ? 'Image uploads must be 10MB or smaller.'
                    : err.message
            });
        }

        return res.status(400).json({
            error: 'Validation Error',
            message: err.message
        });
    });
}

router.post('/image', protect, imageUpload, uploadController.uploadImage);

function videoUploadMiddleware(req, res, next) {
    videoUpload.fields([
        { name: 'video', maxCount: 1 },
        { name: 'file', maxCount: 1 }
    ])(req, res, err => {
        if (!err) return next();

        if (err instanceof multer.MulterError) {
            return res.status(400).json({
                error: 'Validation Error',
                message: err.code === 'LIMIT_FILE_SIZE'
                    ? 'Video uploads must be 50MB or smaller.'
                    : err.message
            });
        }

        return res.status(400).json({
            error: 'Validation Error',
            message: err.message
        });
    });
}

router.post('/video', protect, videoUploadMiddleware, uploadController.uploadVideo);

module.exports = router;
