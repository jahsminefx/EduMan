const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || 'fallback_secret';

const generateToken = (user, school_id = null) => {
    return jwt.sign(
        { id: user.id, role: user.role, email: user.email, school_id },
        SECRET,
        { expiresIn: '7d' } // 7 days offline-first persistence
    );
};

const verifyToken = (token) => {
    return jwt.verify(token, SECRET);
};

module.exports = {
    generateToken,
    verifyToken
};
