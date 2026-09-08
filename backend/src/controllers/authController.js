const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateToken } = require('../utils/auth');
const { sendWelcomeEmail, sendPasswordResetCodeEmail } = require('../services/notificationService');
const { hashToken, recordInvitationAudit } = require('../utils/tokenUtils');

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
        } else if (user.role === 'Parent') {
            const parentLink = await db.get(`
                SELECT st.school_id, s.name as school_name 
                FROM parent_student_links psl
                JOIN students st ON psl.student_id = st.id
                JOIN schools s ON st.school_id = s.id
                WHERE psl.parent_user_id = $1
                LIMIT 1
            `, [user.id]);
            if (parentLink) {
                school_id = parentLink.school_id;
                school_name = parentLink.school_name;
            }
        } else if (user.role === 'Accountant') {
            // Accountant is school-scoped
            const assignment = await db.get(`
                SELECT a.school_id, s.name as school_name 
                FROM school_admin_assignments a
                JOIN schools s ON a.school_id = s.id
                WHERE a.user_id = $1
            `, [user.id]);
            if (assignment) {
                school_id = assignment.school_id;
                school_name = assignment.school_name;
            } else if (user.school_id) {
                const school = await db.get(`SELECT id, name FROM schools WHERE id = $1`, [user.school_id]);
                if (school) {
                    school_id = school.id;
                    school_name = school.name;
                }
            }
        }

        if (school_id) {
            const schoolObj = await db.get(`SELECT status, is_active FROM schools WHERE id = $1`, [school_id]);
            if (schoolObj && (schoolObj.status === 'SUSPENDED' || schoolObj.status === 'ARCHIVED' || schoolObj.is_active === 0)) {
                return res.status(403).json({ error: 'Forbidden', message: `School account is currently ${schoolObj.status ? schoolObj.status.toLowerCase() : 'suspended'}. Please contact administrator.` });
            }
        }

        const token = generateToken(user, school_id);

        // Update last_login timestamp asynchronously
        db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]).catch(() => {});

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

        // Send welcome email
        sendWelcomeEmail({
            email,
            name: 'Admin User',
            role: 'School Admin',
            schoolName: name,
            password
        });

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

exports.verifySetupToken = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token || !token.trim()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired invitation.' });
        }

        const tokenHash = hashToken(token);
        const db = getDB();
        const user = await db.get(
            `SELECT id, name, email, role, setup_token_expires FROM users WHERE setup_token = $1`,
            [tokenHash]
        );

        if (!user || !user.setup_token_expires || new Date(user.setup_token_expires) <= new Date()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired invitation.' });
        }

        res.json({ 
            valid: true, 
            user: {
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: 'Failed to verify invitation' });
    }
};

exports.setupPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !token.trim() || !password) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired invitation.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 6 characters long' });
        }

        const tokenHash = hashToken(token);
        const db = getDB();
        const user = await db.get(
            `SELECT id, name, email, role, setup_token_expires FROM users WHERE setup_token = $1`,
            [tokenHash]
        );

        if (!user || !user.setup_token_expires || new Date(user.setup_token_expires) <= new Date()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired invitation.' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        
        await db.transaction(async (client) => {
            // Clear setup token (single-use), clear expiration, and activate user
            await client.run(
                `UPDATE users SET password_hash = $1, setup_token = NULL, setup_token_expires = NULL, is_active = 1 WHERE id = $2`,
                [password_hash, user.id]
            );
        });

        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        await recordInvitationAudit({
            actorId: user.id,
            action: 'INVITATION_ACCEPTED',
            targetUserId: user.id,
            role: user.role,
            reason: 'User completed password setup and activated account',
            ipAddress: clientIp
        });

        res.json({ message: 'Password set up successfully. You may now log in.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: 'Failed to set up password' });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.trim()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Email address is required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const db = getDB();
        const user = await db.get(`SELECT id, name, email FROM users WHERE LOWER(email) = $1`, [normalizedEmail]);

        if (!user) {
            // Generic success message to prevent user enumeration
            return res.json({ message: 'If an account exists with this email, a 6-digit verification code has been sent.' });
        }

        // Generate 6-digit verification code
        const code = crypto.randomInt(100000, 999999).toString();

        // Save code and 15-minute expiration
        await db.run(
            `UPDATE users SET reset_code = $1, reset_code_expires = CURRENT_TIMESTAMP + INTERVAL '15 minutes' WHERE id = $2`,
            [code, user.id]
        );

        // Send reset code email
        sendPasswordResetCodeEmail({
            email: user.email,
            name: user.name,
            code
        }).catch(err => console.error('Failed to send reset code email:', err));

        res.json({ message: 'If an account exists with this email, a 6-digit verification code has been sent.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to process password reset request.' });
    }
};

exports.verifyResetCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !email.trim() || !code || !code.trim()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Email and 6-digit verification code are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const cleanCode = code.trim();
        const db = getDB();

        const user = await db.get(
            `SELECT id, name, email, reset_code, reset_code_expires FROM users WHERE LOWER(email) = $1`,
            [normalizedEmail]
        );

        if (!user || user.reset_code !== cleanCode || !user.reset_code_expires || new Date(user.reset_code_expires) <= new Date()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired 6-digit verification code.' });
        }

        res.json({ valid: true, message: 'Verification code confirmed.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: 'Failed to verify reset code.' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !email.trim() || !code || !code.trim() || !newPassword) {
            return res.status(400).json({ error: 'Bad Request', message: 'Email, verification code, and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Bad Request', message: 'New password must be at least 6 characters long.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const cleanCode = code.trim();
        const db = getDB();

        const user = await db.get(
            `SELECT id, name, email, role, reset_code, reset_code_expires FROM users WHERE LOWER(email) = $1`,
            [normalizedEmail]
        );

        if (!user || user.reset_code !== cleanCode || !user.reset_code_expires || new Date(user.reset_code_expires) <= new Date()) {
            return res.status(400).json({ error: 'Bad Request', message: 'Invalid or expired 6-digit verification code.' });
        }

        const password_hash = await bcrypt.hash(newPassword, 10);

        await db.transaction(async (client) => {
            // Update password hash, invalidate active sessions (token_version + 1), and clear reset code
            await client.run(
                `UPDATE users SET password_hash = $1, reset_code = NULL, reset_code_expires = NULL, token_version = token_version + 1 WHERE id = $2`,
                [password_hash, user.id]
            );
        });

        res.json({ message: 'Your password has been changed successfully. You may now log in.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to reset password.' });
    }
};

