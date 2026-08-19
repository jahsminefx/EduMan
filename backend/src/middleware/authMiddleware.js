const { verifyToken } = require('../utils/auth');
const { getDB } = require('../config/database');

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = verifyToken(token);
        const db = getDB();
        const dbUser = await db.get(`SELECT is_active, token_version FROM users WHERE id = $1`, [decoded.id]);

        if (!dbUser || dbUser.is_active === 0) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Account is inactive or disabled' });
        }

        if (decoded.token_version && dbUser.token_version && decoded.token_version !== dbUser.token_version) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Session has been revoked' });
        }

        if (decoded.role !== 'SuperAdmin' && decoded.school_id) {
            const school = await db.get(`SELECT status, is_active FROM schools WHERE id = $1`, [decoded.school_id]);
            if (school && (school.status === 'SUSPENDED' || school.status === 'ARCHIVED' || school.is_active === 0)) {
                return res.status(403).json({ error: 'Forbidden', message: `School account is currently ${school.status || 'suspended'}.` });
            }
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to perform this action' });
        }
        next();
    };
};


const requireSchoolScope = (req, res, next) => {
    // SuperAdmin, ContentManager, and SupportOfficer float globally
    const GLOBAL_ROLES = new Set(['SuperAdmin', 'ContentManager', 'SupportOfficer']);
    if (!GLOBAL_ROLES.has(req.user.role) && !req.user.school_id) {
        return res.status(403).json({ error: 'Forbidden', message: 'Your account is not bound to a valid school.' });
    }
    next();
};

const requireTeacherResourceAccess = async (req, res, next) => {
    if (req.user.role === 'SuperAdmin' || req.user.role === 'SchoolAdmin') {
        return next(); // Admins override teacher limits
    }

    if (req.user.role !== 'Teacher') {
        return res.status(403).json({ error: 'Forbidden', message: 'Only Teachers can perform this action.' });
    }

    const class_id = req.body.class_id || req.query.class_id;
    const subject_id = req.body.subject_id || req.query.subject_id;

    if (!class_id || !subject_id) {
        return res.status(400).json({ error: 'Bad Request', message: 'class_id and subject_id are required to verify teacher access.' });
    }

    try {
        const db = getDB();
        // 1. Get teacher_id for the logged in user
        const teacher = await db.get('SELECT id FROM teachers WHERE user_id = $1', [req.user.id]);
        if (!teacher) return res.status(403).json({ message: 'Teacher record not found.' });

        // 2. Check assignment table
        const assignment = await db.get(
            'SELECT id FROM teacher_subject_assignments WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3',
            [teacher.id, class_id, subject_id]
        );

        if (!assignment) {
            return res.status(403).json({ error: 'Forbidden', message: 'You are not assigned to teach this subject in this class.' });
        }

        req.teacher_id = teacher.id; // Attach for convenience
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Server Error', message: 'Failed to verify assignment scope' });
    }
};

module.exports = { protect, authorize, requireSchoolScope, requireTeacherResourceAccess };
