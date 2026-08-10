const fs = require('fs');
const path = require('path');
const { cloudinary, isCloudinaryConfigured, requireCloudinaryConfig } = require('../config/cloudinary');

const MB = 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v']);
const ALLOWED_VIDEO_MIME_TYPES = new Set([
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v'
]);

const IMAGE_PROFILES = {
    avatar: {
        label: 'Profile photo',
        maxBytes: 2 * MB,
        folder: 'avatars',
        incoming: [{ width: 1000, height: 1000, crop: 'fill', gravity: 'auto' }]
    },
    logo: {
        label: 'Logo',
        maxBytes: 3 * MB,
        folder: 'logos',
        incoming: [{ width: 1200, height: 1200, crop: 'limit' }]
    },
    product: {
        label: 'Product image',
        maxBytes: 5 * MB,
        folder: 'products',
        incoming: [{ width: 1200, height: 1200, crop: 'fill', gravity: 'auto' }]
    },
    blog: {
        label: 'Blog image',
        maxBytes: 5 * MB,
        folder: 'content',
        incoming: [{ width: 1600, height: 900, crop: 'fill', gravity: 'auto' }]
    },
    content: {
        label: 'Content image',
        maxBytes: 5 * MB,
        folder: 'content',
        incoming: [{ width: 1600, height: 900, crop: 'fill', gravity: 'auto' }]
    },
    banner: {
        label: 'Banner image',
        maxBytes: 10 * MB,
        folder: 'banners',
        incoming: [{ width: 1920, height: 800, crop: 'fill', gravity: 'auto' }]
    },
    hero: {
        label: 'Hero image',
        maxBytes: 10 * MB,
        folder: 'heroes',
        incoming: [{ width: 1920, height: 800, crop: 'fill', gravity: 'auto' }]
    },
    gallery: {
        label: 'Gallery image',
        maxBytes: 5 * MB,
        folder: 'gallery',
        incoming: [{ width: 1600, height: 1600, crop: 'limit' }]
    },
    general: {
        label: 'Image',
        maxBytes: 5 * MB,
        folder: 'general',
        incoming: [{ width: 1600, height: 1600, crop: 'limit' }]
    }
};

const THUMBNAIL_PRESETS = {
    small: { width: 80, height: 80, crop: 'fill', gravity: 'auto' },
    avatar: { width: 150, height: 150, crop: 'fill', gravity: 'auto' },
    card: { width: 300, height: 300, crop: 'fill', gravity: 'auto' },
    product: { width: 600, height: 600, crop: 'fill', gravity: 'auto' },
    preview: { width: 800, height: 800, crop: 'limit' },
    banner: { width: 1600, height: 600, crop: 'fill', gravity: 'auto' }
};

const VIDEO_PROFILE = {
    label: 'Video',
    maxBytes: 50 * MB,
    folder: 'videos'
};

const BROWSER_VIDEO_TRANSFORMATION = [
    {
        video_codec: 'h264',
        audio_codec: 'aac',
        quality: 'auto'
    }
];

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function getImageProfile(imageType) {
    return IMAGE_PROFILES[imageType] || IMAGE_PROFILES.general;
}

function formatBytes(bytes) {
    const mb = bytes / MB;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
}

function getExtension(file) {
    return path.extname(file?.originalname || '').toLowerCase();
}

function isSupportedImageFile(file) {
    return Boolean(
        file &&
        ALLOWED_IMAGE_EXTENSIONS.has(getExtension(file)) &&
        ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)
    );
}

function isSupportedVideoFile(file) {
    return Boolean(
        file &&
        ALLOWED_VIDEO_EXTENSIONS.has(getExtension(file)) &&
        ALLOWED_VIDEO_MIME_TYPES.has(file.mimetype)
    );
}

function validateImageFile(file, imageType = 'general') {
    if (!file) {
        throw createHttpError(400, 'Please upload an image file.');
    }

    if (!isSupportedImageFile(file)) {
        throw createHttpError(400, 'Only JPG, JPEG, PNG, and WEBP image uploads are allowed.');
    }

    const profile = getImageProfile(imageType);
    if (file.size > profile.maxBytes) {
        throw createHttpError(400, `${profile.label} uploads must be ${formatBytes(profile.maxBytes)} or smaller.`);
    }
}

function validateVideoFile(file) {
    if (!file) {
        throw createHttpError(400, 'Please upload a video file.');
    }

    if (!isSupportedVideoFile(file)) {
        throw createHttpError(400, 'Only MP4, MOV, WEBM, and M4V video uploads are allowed.');
    }

    if (file.size > VIDEO_PROFILE.maxBytes) {
        throw createHttpError(400, `${VIDEO_PROFILE.label} uploads must be ${formatBytes(VIDEO_PROFILE.maxBytes)} or smaller.`);
    }
}

function addAutoDelivery(transform) {
    return {
        ...transform,
        quality: 'auto',
        fetch_format: 'auto'
    };
}

function buildThumbnailUrls(publicId) {
    return Object.fromEntries(
        Object.entries(THUMBNAIL_PRESETS).map(([key, transform]) => [
            key,
            cloudinary.url(publicId, {
                secure: true,
                resource_type: 'image',
                transformation: [addAutoDelivery(transform)]
            })
        ])
    );
}

function buildEagerTransforms() {
    return Object.values(THUMBNAIL_PRESETS).map(addAutoDelivery);
}

function uploadBuffer(buffer, uploadOptions) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });

        stream.end(buffer);
    });
}

function deleteTempFile(file) {
    if (!file?.path) return;
    fs.unlink(file.path, err => {
        if (err && err.code !== 'ENOENT') {
            console.error('Failed to delete temporary upload:', err.message);
        }
    });
}

function deleteTempFiles(files) {
    for (const file of files || []) {
        deleteTempFile(file);
    }
}

async function uploadImage(file, options = {}) {
    const imageType = options.imageType || 'general';

    try {
        validateImageFile(file, imageType);
        requireCloudinaryConfig();

        const profile = getImageProfile(imageType);
        const folder = options.folder || profile.folder;
        const uploadOptions = {
            folder: `eduman/${folder}`.replace(/\/+/g, '/'),
            resource_type: 'image',
            use_filename: false,
            unique_filename: true,
            overwrite: false,
            transformation: profile.incoming,
            eager: buildEagerTransforms(),
            context: options.context || undefined
        };

        const result = file.buffer
            ? await uploadBuffer(file.buffer, uploadOptions)
            : await cloudinary.uploader.upload(file.path, uploadOptions);

        return {
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type || 'image',
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            thumbnails: buildThumbnailUrls(result.public_id)
        };
    } catch (err) {
        throw err;
    } finally {
        if (options.removeTempFile !== false) {
            deleteTempFile(file);
        }
    }
}

async function uploadVideo(file, options = {}) {
    try {
        validateVideoFile(file);
        requireCloudinaryConfig();

        const folder = options.folder || VIDEO_PROFILE.folder;
        const uploadOptions = {
            folder: `eduman/${folder}`.replace(/\/+/g, '/'),
            resource_type: 'video',
            use_filename: false,
            unique_filename: true,
            overwrite: false,
            context: options.context || undefined
        };

        const result = file.buffer
            ? await uploadBuffer(file.buffer, uploadOptions)
            : await cloudinary.uploader.upload(file.path, uploadOptions);

        return {
            url: browserSafeVideoUrl(result.public_id),
            originalUrl: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type || 'video',
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            duration: result.duration
        };
    } catch (err) {
        throw err;
    } finally {
        if (options.removeTempFile !== false) {
            deleteTempFile(file);
        }
    }
}

function browserSafeVideoUrl(publicId) {
    if (!publicId) return null;

    return cloudinary.url(publicId, {
        secure: true,
        resource_type: 'video',
        format: 'mp4',
        transformation: BROWSER_VIDEO_TRANSFORMATION
    });
}

function localUploadPath(storedPath) {
    if (!storedPath || /^https?:\/\//i.test(storedPath)) return null;

    const normalized = String(storedPath).replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized.startsWith('uploads/')) return null;

    const uploadsRoot = path.resolve(__dirname, '../../uploads');
    const relativePath = normalized.slice('uploads/'.length);
    const absolutePath = path.resolve(uploadsRoot, relativePath);
    const allowedPrefix = `${uploadsRoot}${path.sep}`;

    if (absolutePath !== uploadsRoot && !absolutePath.startsWith(allowedPrefix)) {
        return null;
    }

    return absolutePath;
}

function inferCloudinaryAsset(url) {
    if (!url || !/^https?:\/\//i.test(url) || !url.includes('/upload/')) return null;

    try {
        const parsed = new URL(url);
        if (!parsed.hostname.includes('cloudinary.com')) return null;

        const parts = parsed.pathname.split('/').filter(Boolean);
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) return null;
        const resourceType = uploadIndex > 0 ? parts[uploadIndex - 1] : 'image';

        let publicParts = parts.slice(uploadIndex + 1);
        const versionIndex = publicParts.findIndex(part => /^v\d+$/.test(part));
        if (versionIndex !== -1) {
            publicParts = publicParts.slice(versionIndex + 1);
        }

        if (publicParts.length === 0) return null;

        const last = publicParts[publicParts.length - 1];
        publicParts[publicParts.length - 1] = last.replace(/\.[^/.]+$/, '');
        return {
            publicId: decodeURIComponent(publicParts.join('/')),
            resourceType: ['image', 'video', 'raw'].includes(resourceType) ? resourceType : 'image'
        };
    } catch (err) {
        return null;
    }
}

async function destroyCloudinaryAsset(publicId, resourceType = 'image') {
    if (!publicId || !isCloudinaryConfigured()) return;
    await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true
    });
}

async function deleteStoredMedia({ url, publicId, resourceType } = {}) {
    const inferredAsset = inferCloudinaryAsset(url);
    const idToDelete = publicId || inferredAsset?.publicId;
    const typeToDelete = resourceType || inferredAsset?.resourceType || 'image';
    if (idToDelete) {
        try {
            await destroyCloudinaryAsset(idToDelete, typeToDelete);
        } catch (err) {
            console.error('Failed to delete Cloudinary media:', err.message);
        }
        return;
    }

    const absolutePath = localUploadPath(url);
    if (!absolutePath) return;

    fs.unlink(absolutePath, err => {
        if (err && err.code !== 'ENOENT') {
            console.error('Failed to delete stored upload:', err.message);
        }
    });
}

module.exports = {
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_VIDEO_EXTENSIONS,
    IMAGE_PROFILES,
    VIDEO_PROFILE,
    deleteStoredMedia,
    deleteTempFile,
    deleteTempFiles,
    isSupportedImageFile,
    isSupportedVideoFile,
    browserSafeVideoUrl,
    uploadImage,
    uploadVideo,
    validateImageFile,
    validateVideoFile
};
