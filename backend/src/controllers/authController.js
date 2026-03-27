const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/auth');

exports.login = async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Bad Request', message: 'Email and password are required' });
    }

    try {
        const db = getDB();
        const user = await db.get("SELECT * FROM users WHERE email = $1", [email]);

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
        }

        // Block login for disabled accounts
        if (user.is_active === 0) {
            return res.status(403).json({ error: 'Forbidden', message: 'Your account has been deactivated. Please contact the administrator.' });
        }

        let school_id = null;
        let school_name = null;
        if (user.role === 'SchoolAdmin') {
            const assignment = await db.get(`
                SELECT a.school_id, s.name as school_name 
                FROM school_admin_assignments a
                JOIN schools s ON a.school_id = s.id
                WHERE a.user_id = $1
            `, [user.id]);
            if (assignment) {
                school_id = assignment.school_id;
                school_name = assignment.school_name;
            }
        } else if (user.role === 'Teacher') {
            const teacher = await db.get(`
                SELECT t.school_id, s.name as school_name 
                FROM teachers t
                JOIN schools s ON t.school_id = s.id
                WHERE t.user_id = $1
            `, [user.id]);
            if (teacher) {
                school_id = teacher.school_id;
                school_name = teacher.school_name;
            }
        } else if (user.role === 'Student') {
            const student = await db.get(`
                SELECT st.school_id, s.name as school_name 
                FROM students st
                JOIN schools s ON st.school_id = s.id
                WHERE st.user_id = $1
            `, [user.id]);
            if (student) {
                school_id = student.school_id;
                school_name = student.school_name;
            }
        }

        const token = generateToken(user, school_id);

        // Remove password hash from response
        delete user.password_hash;
        user.school_id = school_id;
        user.school_name = school_name;
        
        res.json({
            message: 'Login successful',
            token,
            user
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
};

exports.register = async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Bad Request', message: 'Institution name, email, and password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 6 characters' });
    }

    const db = getDB();
    try {
        const existing = await db.get("SELECT id FROM users WHERE email = $1", [email]);
        if (existing) {
            return res.status(409).json({ error: 'Conflict', message: 'An account with this email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const role = 'SchoolAdmin';

        const result = await db.transaction(async (client) => {
            // 1. Create School
            const schoolResult = await client.run(
                "INSERT INTO schools (name) VALUES ($1) RETURNING id",
                [name]
            );
            const school_id = schoolResult.lastID;

            // 2. Create User
            const userResult = await client.run(
                "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
                ['Admin User', email, password_hash, role]
            );
            const user_id = userResult.lastID;

            // 3. Assign Admin to School
            await client.run(
                "INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)",
                [user_id, school_id]
            );

            return { school_id, user_id };
        });

        const user = { id: result.user_id, name: 'Admin User', email, role };
        const token = generateToken(user, result.school_id);

        res.status(201).json({
            message: 'School and Admin account created successfully',
            token,
            user,
            school_id: result.school_id
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
};

exports.getMe = async (req, res) => {
    try {
        const db = getDB();
        const user = await db.get("SELECT id, name, email, role, created_at FROM users WHERE id = $1", [req.user.id]);
        
        if (!user) {
            return res.status(404).json({ error: 'Not Found', message: 'User not found' });
        }

        let school_id = null;
        let school_name = null;
        if (user.role === 'SchoolAdmin') {
            const assignment = await db.get(`
                SELECT a.school_id, s.name as school_name 
                FROM school_admin_assignments a
                JOIN schools s ON a.school_id = s.id
                WHERE a.user_id = $1
            `, [user.id]);
            if (assignment) {
                school_id = assignment.school_id;
                school_name = assignment.school_name;
            }
        } else if (user.role === 'Teacher') {
            const teacher = await db.get(`
                SELECT t.school_id, s.name as school_name 
                FROM teachers t
                JOIN schools s ON t.school_id = s.id
                WHERE t.user_id = $1
            `, [user.id]);
            if (teacher) {
                school_id = teacher.school_id;
                school_name = teacher.school_name;
            }
        } else if (user.role === 'Student') {
            const student = await db.get(`
                SELECT st.school_id, s.name as school_name 
                FROM students st
                JOIN schools s ON st.school_id = s.id
                WHERE st.user_id = $1
            `, [user.id]);
            if (student) {
                school_id = student.school_id;
                school_name = student.school_name;
            }
        }

        user.school_id = school_id;
        user.school_name = school_name;
        res.json({ user });
    } catch (err) {
        console.error('GetMe error:', err);
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
};
