const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('CRITICAL: JWT_SECRET environment variable is required in production.');
    }
    console.warn('Warning: JWT_SECRET not set, using fallback secret. Do NOT use in production.');
}
const JWT_KEY = SECRET || 'fallback_secret_dev_only';

const generateToken = (user, school_id = null) => {
    return jwt.sign(
        { id: user.id, role: user.role, email: user.email, school_id },
        JWT_KEY,
        { expiresIn: '7d' }
    );
};

const verifyToken = (token) => {
    return jwt.verify(token, JWT_KEY);
};

module.exports = {
    generateToken,
    verifyToken
};
