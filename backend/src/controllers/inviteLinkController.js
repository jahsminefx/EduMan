const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateToken } = require('../utils/auth');
const { hashToken } = require('../utils/tokenUtils');

// Helper to generate readable short code (e.g., GRN-STU-98X2A)
function generateDisplayCode(prefix = 'EDU', role = 'STU') {
    const roleTag = role.substring(0, 3).toUpperCase();
    const randomChars = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix.substring(0, 3).toUpperCase()}-${roleTag}-${randomChars}`;
}

// SchoolAdmin: Create a new invite link
exports.createInviteLink = async (req, res) => {
    const school_id = req.user.school_id;
    const created_by = req.user.id;
    const { role, class_id, max_uses, expires_in_days } = req.body;

    if (!school_id) {
        return res.status(400).json({ error: 'Bad Request', message: 'User is not assigned to a school' });
    }

    if (!role || !['Student', 'Teacher', 'Parent'].includes(role)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Role must be Student, Teacher, or Parent' });
    }

    try {
        const db = getDB();

        // Optional class verification
        let targetClassId = null;
        if (class_id) {
            const classRow = await db.get('SELECT id FROM classes WHERE id = $1 AND school_id = $2', [class_id, school_id]);
            if (!classRow) {
                return res.status(400).json({ error: 'Validation Error', message: 'Invalid class ID for this school' });
            }
            targetClassId = classRow.id;
        }

        // Fetch school prefix if available
        const schoolRow = await db.get('SELECT name FROM schools WHERE id = $1', [school_id]);
        const schoolName = schoolRow ? schoolRow.name : 'EDU';
        const prefix = schoolName.replace(/[^a-zA-Z]/g, '').substring(0, 3) || 'EDU';

        const display_code = generateDisplayCode(prefix, role);
        const code_hash = hashToken(display_code);

        // Compute expires_at
        let expires_at = null;
        if (expires_in_days && Number(expires_in_days) > 0) {
            const date = new Date();
            date.setDate(date.getDate() + Number(expires_in_days));
            expires_at = date.toISOString();
        }

        const maxUsesCount = max_uses && Number(max_uses) > 0 ? Number(max_uses) : 0;

        const result = await db.run(`
            INSERT INTO school_invite_links (
                school_id, code_hash, display_code, role, class_id, max_uses, used_count, expires_at, is_active, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 1, $8)
            RETURNING id
        `, [school_id, code_hash, display_code, role, targetClassId, maxUsesCount, expires_at, created_by]);

        const linkId = result.lastID;

        const createdLink = await db.get(`
            SELECT sil.*, c.name as class_name
            FROM school_invite_links sil
            LEFT JOIN classes c ON sil.class_id = c.id
            WHERE sil.id = $1
        `, [linkId]);

        res.status(201).json({
            message: 'Invite link created successfully',
            inviteLink: createdLink
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// SchoolAdmin: Get all invite links for their school
exports.getInviteLinks = async (req, res) => {
    const school_id = req.user.school_id;

    if (!school_id) {
        return res.status(400).json({ error: 'Bad Request', message: 'User is not assigned to a school' });
    }

    try {
        const db = getDB();
        const links = await db.all(`
            SELECT 
                sil.*, 
                c.name as class_name,
                u.name as creator_name
            FROM school_invite_links sil
            LEFT JOIN classes c ON sil.class_id = c.id
            LEFT JOIN users u ON sil.created_by = u.id
            WHERE sil.school_id = $1
            ORDER BY sil.created_at DESC
        `, [school_id]);

        const now = new Date();
        const formattedLinks = links.map(link => {
            let status = 'ACTIVE';
            if (link.is_active === 0) {
                status = 'REVOKED';
            } else if (link.expires_at && new Date(link.expires_at) < now) {
                status = 'EXPIRED';
            } else if (link.max_uses > 0 && link.used_count >= link.max_uses) {
                status = 'EXHAUSTED';
            }

            return {
                ...link,
                status
            };
        });

        res.json({ inviteLinks: formattedLinks });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// SchoolAdmin: Revoke an invite link
exports.revokeInviteLink = async (req, res) => {
    const school_id = req.user.school_id;
    const { id } = req.params;

    try {
        const db = getDB();
        const link = await db.get('SELECT * FROM school_invite_links WHERE id = $1 AND school_id = $2', [id, school_id]);

        if (!link) {
            return res.status(404).json({ error: 'Not Found', message: 'Invite link not found' });
        }

        await db.run('UPDATE school_invite_links SET is_active = 0 WHERE id = $1', [id]);

        res.json({ message: 'Invite link revoked successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Public API: Get invite info by code (for frontend join page)
exports.getInviteInfo = async (req, res) => {
    const { code } = req.params;

    if (!code) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invite code is required' });
    }

    try {
        const db = getDB();
        const cleanCode = String(code).trim();
        const codeHash = hashToken(cleanCode);

        const link = await db.get(`
            SELECT 
                sil.*, 
                s.name as school_name, 
                s.logo_url, 
                s.motto, 
                s.address, 
                s.city, 
                s.state,
                c.name as class_name
            FROM school_invite_links sil
            JOIN schools s ON sil.school_id = s.id
            LEFT JOIN classes c ON sil.class_id = c.id
            WHERE sil.code_hash = $1 OR sil.display_code = $2
        `, [codeHash, cleanCode.toUpperCase()]);

        if (!link) {
            return res.status(404).json({ valid: false, message: 'Invalid or non-existent invitation link' });
        }

        const now = new Date();
        if (link.is_active === 0) {
            return res.status(400).json({ valid: false, message: 'This invitation link has been revoked by the school administrator.' });
        }

        if (link.expires_at && new Date(link.expires_at) < now) {
            return res.status(400).json({ valid: false, message: 'This invitation link has expired.' });
        }

        if (link.max_uses > 0 && link.used_count >= link.max_uses) {
            return res.status(400).json({ valid: false, message: 'This invitation link has reached its maximum registration limit.' });
        }

        res.json({
            valid: true,
            invite: {
                display_code: link.display_code,
                role: link.role,
                school_id: link.school_id,
                school_name: link.school_name,
                logo_url: link.logo_url,
                motto: link.motto,
                city: link.city,
                state: link.state,
                class_id: link.class_id,
                class_name: link.class_name
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Public API: Register via invite link
exports.registerViaInvite = async (req, res) => {
    const { code, first_name, last_name, email, password, gender, admission_number, phone, parent_name, parent_phone } = req.body;

    if (!code || !first_name || !last_name || !email || !password) {
        return res.status(400).json({ error: 'Validation Error', message: 'First name, last name, email, password, and invite code are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Invalid email address format.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Validation Error', message: 'Password must be at least 6 characters.' });
    }

    try {
        const db = getDB();
        const cleanCode = String(code).trim();
        const codeHash = hashToken(cleanCode);

        // Fetch link
        const link = await db.get(`
            SELECT sil.*, s.name as school_name
            FROM school_invite_links sil
            JOIN schools s ON sil.school_id = s.id
            WHERE sil.code_hash = $1 OR sil.display_code = $2
        `, [codeHash, cleanCode.toUpperCase()]);

        if (!link) {
            return res.status(404).json({ error: 'Invalid Link', message: 'Invalid invitation link.' });
        }

        const now = new Date();
        if (link.is_active === 0) {
            return res.status(400).json({ error: 'Link Revoked', message: 'This invitation link has been revoked.' });
        }

        if (link.expires_at && new Date(link.expires_at) < now) {
            return res.status(400).json({ error: 'Link Expired', message: 'This invitation link has expired.' });
        }

        if (link.max_uses > 0 && link.used_count >= link.max_uses) {
            return res.status(400).json({ error: 'Link Exhausted', message: 'This invitation link has reached maximum usage limit.' });
        }

        // Check if email already exists
        const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
        if (existingUser) {
            return res.status(400).json({ error: 'Duplicate Email', message: 'An account with this email address already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const fullName = `${first_name.trim()} ${last_name.trim()}`;
        const targetRole = link.role;

        const registrationResult = await db.transaction(async (client) => {
            // 1. Create User
            const userResult = await client.run(
                'INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, 1) RETURNING id',
                [fullName, cleanEmail, passwordHash, targetRole]
            );
            const userId = userResult.lastID;

            // 2. Role-specific creation
            if (targetRole === 'Student') {
                const admNo = admission_number ? admission_number.trim() : `ADM-${Date.now().toString().slice(-6)}`;
                await client.run(`
                    INSERT INTO students (user_id, school_id, admission_number, first_name, last_name, gender, class_id, parent_name, parent_phone)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    userId,
                    link.school_id,
                    admNo,
                    first_name.trim(),
                    last_name.trim(),
                    gender || 'Other',
                    link.class_id || null,
                    parent_name ? parent_name.trim() : null,
                    parent_phone ? parent_phone.trim() : null
                ]);
            } else if (targetRole === 'Teacher') {
                const teacherResult = await client.run(`
                    INSERT INTO teachers (user_id, school_id, first_name, last_name, gender, phone)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `, [
                    userId,
                    link.school_id,
                    first_name.trim(),
                    last_name.trim(),
                    gender || 'Other',
                    phone ? phone.trim() : null
                ]);

                if (link.class_id) {
                    await client.run(`
                        INSERT INTO teacher_classes (teacher_id, class_id, school_id)
                        VALUES ($1, $2, $3)
                    `, [teacherResult.lastID, link.class_id, link.school_id]);
                }
            }

            // 3. Increment used_count
            await client.run('UPDATE school_invite_links SET used_count = used_count + 1 WHERE id = $1', [link.id]);

            return { userId };
        });

        // 4. Generate JWT auth token
        const createdUser = {
            id: registrationResult.userId,
            name: fullName,
            email: cleanEmail,
            role: targetRole
        };
        const token = generateToken(createdUser, link.school_id);

        res.status(201).json({
            message: `Account created successfully! Welcome to ${link.school_name}.`,
            token,
            user: {
                id: createdUser.id,
                name: createdUser.name,
                email: createdUser.email,
                role: createdUser.role,
                school_id: link.school_id,
                school_name: link.school_name
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
