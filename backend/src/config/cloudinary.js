const { v2: cloudinary } = require('cloudinary');
require('dotenv').config();

function hasNamedCredentials() {
    return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

function isCloudinaryConfigured() {
    return Boolean(process.env.CLOUDINARY_URL || hasNamedCredentials());
}

if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
} else if (hasNamedCredentials()) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
}

function requireCloudinaryConfig() {
    if (isCloudinaryConfigured()) return;

    const error = new Error(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.'
    );
    error.statusCode = 503;
    throw error;
}

module.exports = {
    cloudinary,
    isCloudinaryConfigured,
    requireCloudinaryConfig
};
