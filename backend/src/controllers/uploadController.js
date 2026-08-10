const { uploadImage, uploadVideo } = require('../utils/cloudinaryImage');

function uploadedImageFile(req) {
    return req.files?.image?.[0] || req.files?.file?.[0] || null;
}

exports.uploadImage = async (req, res) => {
    const file = uploadedImageFile(req);
    const imageType = req.body.image_type || req.body.type || 'general';

    if (!file) {
        return res.status(400).json({
            error: 'Validation Error',
            message: 'Please upload an image file.'
        });
    }

    try {
        const image = await uploadImage(file, {
            imageType,
            folder: `users/${req.user.id}`,
            context: {
                uploaded_by: String(req.user.id),
                role: req.user.role || 'User'
            }
        });

        res.status(201).json({
            message: 'Image uploaded successfully.',
            image
        });
    } catch (err) {
        res.status(err.statusCode || 500).json({
            error: err.statusCode ? 'Validation Error' : 'Server Error',
            message: err.message
        });
    }
};

function uploadedVideoFile(req) {
    return req.files?.video?.[0] || req.files?.file?.[0] || null;
}

exports.uploadVideo = async (req, res) => {
    const file = uploadedVideoFile(req);

    if (!file) {
        return res.status(400).json({
            error: 'Validation Error',
            message: 'Please upload a video file.'
        });
    }

    try {
        const video = await uploadVideo(file, {
            folder: `users/${req.user.id}/videos`,
            context: {
                uploaded_by: String(req.user.id),
                role: req.user.role || 'User'
            }
        });

        res.status(201).json({
            message: 'Video uploaded successfully.',
            video
        });
    } catch (err) {
        res.status(err.statusCode || 500).json({
            error: err.statusCode ? 'Validation Error' : 'Server Error',
            message: err.message
        });
    }
};
