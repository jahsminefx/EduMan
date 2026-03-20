const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');

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

        const profile = await db.get("SELECT * FROM schools WHERE id = $1", [school_id]);
        if (!profile) return res.status(404).json({ error: 'Not Found', message: 'School not found' });
        
        res.json({ profile });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// SchoolAdmin: Update their own school profile
exports.updateMySchool = async (req, res) => {
    const { name, address, phone, email, current_session_id, current_term_id } = req.body;
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        
        await db.run(
            'UPDATE schools SET name=$1, address=$2, phone=$3, email=$4, current_session_id=$5, current_term_id=$6 WHERE id=$7',
            [name, address, phone, email, current_session_id, current_term_id, school_id]
        );
        
        res.json({ message: 'School profile updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
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
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const result = await db.run('INSERT INTO academic_sessions (school_id, name, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING id', [school_id, name, start_date, end_date]);
        res.json({ message: 'Session created', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
