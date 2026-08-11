const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const { deleteStoredMedia, uploadImage } = require('../utils/cloudinaryImage');
const { sendWelcomeEmail } = require('../services/notificationService');

function cleanString(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed || null;
}

function cleanId(value) {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

// SuperAdmin: Get all schools
exports.getAllSchools = async (req, res) => {
    try {
        const db = getDB();
        const schools = await db.all("SELECT * FROM schools ORDER BY id DESC");
        res.json({ schools });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// SuperAdmin: Create a new school and assign a default School Admin
exports.createSchool = async (req, res) => {
    const { name, address, phone, email, admin_name, admin_email, admin_password } = req.body;
    
    if (!name || !admin_name || !admin_email || !admin_password) {
        return res.status(400).json({ error: 'Validation Error', message: 'Missing required fields' });
    }

    try {
        const db = getDB();
        
        // Check if admin email exists
        const existingUser = await db.get('SELECT id FROM users WHERE email = $1', [admin_email]);
        if (existingUser) return res.status(400).json({ error: 'Duplicate', message: 'Admin email is already registered.' });

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(admin_password, salt);

        const result = await db.transaction(async (client) => {
            // 1. Create School
            const schoolResult = await client.run(
                'INSERT INTO schools (name, address, phone, email) VALUES ($1, $2, $3, $4) RETURNING id',
                [name, address, phone, email]
            );
            const schoolId = schoolResult.lastID;

            // 2. Create User account (Role: SchoolAdmin)
            const userResult = await client.run(
                'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
                [admin_name, admin_email, passwordHash, 'SchoolAdmin']
            );
            const userId = userResult.lastID;

            // 3. Assign Admin to School
            await client.run(
                'INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)',
                [userId, schoolId]
            );

            return { schoolId, userId };
        });

        // Send welcome email with credentials
        sendWelcomeEmail({
            email: admin_email,
            name: admin_name,
            role: 'School Admin',
            schoolName: name,
            password: admin_password
        });

        res.json({ message: 'School and Admin created successfully', schoolId: result.schoolId, userId: result.userId });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// SchoolAdmin/Teacher/Student: Get their specific school profile
exports.getMySchool = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        if (!school_id) return res.status(400).json({ error: 'Bad Request', message: 'User has no associated school' });

        const profile = await db.get(`
            SELECT
                s.*,
                acs.name as current_session_name,
                at.name as current_term_name
            FROM schools s
            LEFT JOIN academic_sessions acs ON s.current_session_id = acs.id
            LEFT JOIN academic_terms at ON s.current_term_id = at.id
            WHERE s.id = $1
        `, [school_id]);
        if (!profile) return res.status(404).json({ error: 'Not Found', message: 'School not found' });
        
        res.json({ profile });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// SchoolAdmin: Update their own school profile
exports.updateMySchool = async (req, res) => {
    const {
        name,
        address,
        phone,
        email,
        motto,
        website,
        principal_name,
        school_type,
        city,
        state,
        country,
        current_session_id,
        current_term_id
    } = req.body;
    let uploadedLogo = null;

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const sessionId = cleanId(current_session_id);
        const termId = cleanId(current_term_id);
        const schoolName = cleanString(name);

        if (!schoolName) {
            return res.status(400).json({ error: 'Validation Error', message: 'School name is required.' });
        }

        if (sessionId) {
            const session = await db.get('SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2', [sessionId, school_id]);
            if (!session) {
                return res.status(400).json({ error: 'Validation Error', message: 'Selected academic session does not belong to your school.' });
            }
        }

        if (termId) {
            const term = await db.get(
                'SELECT id, session_id FROM academic_terms WHERE id = $1 AND school_id = $2',
                [termId, school_id]
            );
            if (!term) {
                return res.status(400).json({ error: 'Validation Error', message: 'Selected academic term does not belong to your school.' });
            }
            if (sessionId && Number(term.session_id) !== Number(sessionId)) {
                return res.status(400).json({ error: 'Validation Error', message: 'Selected term must belong to the selected academic session.' });
            }
        }

        const existing = await db.get('SELECT logo_url, logo_public_id FROM schools WHERE id = $1', [school_id]);
        if (req.file) {
            uploadedLogo = await uploadImage(req.file, {
                imageType: 'logo',
                folder: `schools/${school_id}/logos`,
                context: {
                    school_id: String(school_id),
                    uploaded_by: String(req.user.id)
                }
            });
        }

        const submittedLogoUrl = cleanString(req.body.logo_url);
        const logoUrl = uploadedLogo?.url || submittedLogoUrl || existing?.logo_url || null;
        const logoPublicId = uploadedLogo?.publicId || (logoUrl === existing?.logo_url ? existing?.logo_public_id : null);
        const shouldDeleteOldLogo = Boolean(existing?.logo_url && logoUrl !== existing.logo_url);

        await db.transaction(async (client) => {
            await client.run(
                `UPDATE schools
                 SET name=$1, address=$2, phone=$3, email=$4, logo_url=$5, logo_public_id=$6, motto=$7, website=$8,
                     principal_name=$9, school_type=$10, city=$11, state=$12, country=$13,
                     current_session_id=$14, current_term_id=$15
                 WHERE id=$16`,
                [
                    schoolName,
                    cleanString(address),
                    cleanString(phone),
                    cleanString(email),
                    logoUrl,
                    logoPublicId,
                    cleanString(motto),
                    cleanString(website),
                    cleanString(principal_name),
                    cleanString(school_type),
                    cleanString(city),
                    cleanString(state),
                    cleanString(country),
                    sessionId,
                    termId,
                    school_id
                ]
            );

            await client.run('UPDATE academic_sessions SET is_active = CASE WHEN id = $1 THEN 1 ELSE 0 END WHERE school_id = $2', [sessionId, school_id]);
            await client.run('UPDATE academic_terms SET is_active = CASE WHEN id = $1 THEN 1 ELSE 0 END WHERE school_id = $2', [termId, school_id]);
        });

        if (shouldDeleteOldLogo) {
            await deleteStoredMedia({
                url: existing.logo_url,
                publicId: existing.logo_public_id
            });
        }
        
        res.json({ message: 'School profile updated successfully' });
    } catch (err) {
        if (uploadedLogo?.publicId) {
            await deleteStoredMedia({ url: uploadedLogo.url, publicId: uploadedLogo.publicId });
        }
        res.status(err.statusCode || 500).json({
            error: err.statusCode ? 'Validation Error' : 'Server Error',
            message: err.message
        });
    }
};

// Scoped Sessions
exports.getSessions = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const sessions = await db.all("SELECT * FROM academic_sessions WHERE school_id = $1 ORDER BY id DESC", [school_id]);
        res.json({ sessions });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createSession = async (req, res) => {
    const { name, start_date, end_date } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'Session name is required.' });
    }
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        // Convert empty strings to null for PostgreSQL DATE columns
        const safeStartDate = start_date || null;
        const safeEndDate = end_date || null;
        const result = await db.run('INSERT INTO academic_sessions (school_id, name, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING id', [school_id, name.trim(), safeStartDate, safeEndDate]);
        res.json({ message: 'Session created', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getTerms = async (req, res) => {
    const { session_id } = req.query;
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        let query = "SELECT * FROM academic_terms WHERE school_id = $1";
        let params = [school_id];

        if (session_id) {
            query += " AND session_id = $2 ORDER BY id ASC";
            params.push(session_id);
        } else {
            query += " ORDER BY id DESC";
        }

        const terms = await db.all(query, params);
        res.json({ terms });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createTerm = async (req, res) => {
    const { session_id, name } = req.body;
    const sessionId = cleanId(session_id);
    if (!sessionId || !name || !name.trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'Session and term name are required.' });
    }
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const session = await db.get('SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2', [sessionId, school_id]);
        if (!session) {
            return res.status(400).json({ error: 'Validation Error', message: 'Selected academic session does not belong to your school.' });
        }
        const result = await db.run('INSERT INTO academic_terms (school_id, session_id, name) VALUES ($1, $2, $3) RETURNING id', [school_id, sessionId, name.trim()]);
        res.json({ message: 'Term created', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
