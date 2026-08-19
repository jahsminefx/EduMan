const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendInvitationEmail } = require('../services/notificationService');
const { generateSetupToken, recordInvitationAudit } = require('../utils/tokenUtils');

const GLOBAL_STAFF_ROLES = new Set(['ContentManager', 'SupportOfficer']);

// Append-only audit logger
async function logSuperAdminAudit(req, action, targetType, targetId, details, reason) {
    try {
        const db = getDB();
        const userId = req.user?.id;
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        if (!userId) return;

        await db.run(`
            INSERT INTO superadmin_audit_logs (user_id, action, target_type, target_id, details, reason, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [userId, action, targetType, targetId || null, details || null, reason || null, String(ip)]);
    } catch (err) {
        console.error('Failed to log SuperAdmin audit record:', err);
    }
}

// ─── GET /superadmin/stats ───
exports.getGlobalStats = async (req, res) => {
    try {
        const db = getDB();
        const [totalSchools, activeSchools, suspendedSchools, totalAdmins, activeAdmins, totalTeachers, totalStudents, totalParents, totalAccountants, totalGlobalStaff] = await Promise.all([
            db.get("SELECT COUNT(*) as count FROM schools"),
            db.get("SELECT COUNT(*) as count FROM schools WHERE status = 'ACTIVE' OR (status IS NULL AND is_active = 1)"),
            db.get("SELECT COUNT(*) as count FROM schools WHERE status = 'SUSPENDED' OR is_active = 0"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role = 'SchoolAdmin'"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role = 'SchoolAdmin' AND is_active = 1"),
            db.get("SELECT COUNT(*) as count FROM teachers"),
            db.get("SELECT COUNT(*) as count FROM students"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role = 'Parent'"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role = 'Accountant'"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role IN ('SuperAdmin', 'ContentManager', 'SupportOfficer')"),
        ]);
        res.json({
            totalSchools: parseInt(totalSchools.count || 0, 10),
            activeSchools: parseInt(activeSchools.count || 0, 10),
            suspendedSchools: parseInt(suspendedSchools.count || 0, 10),
            totalAdmins: parseInt(totalAdmins.count || 0, 10),
            activeAdmins: parseInt(activeAdmins.count || 0, 10),
            totalTeachers: parseInt(totalTeachers.count || 0, 10),
            totalStudents: parseInt(totalStudents.count || 0, 10),
            totalParents: parseInt(totalParents.count || 0, 10),
            totalAccountants: parseInt(totalAccountants.count || 0, 10),
            totalGlobalStaff: parseInt(totalGlobalStaff.count || 0, 10),
        });
    } catch (err) {
        console.error('SuperAdmin stats error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── GET /superadmin/schools ───
exports.getSchools = async (req, res) => {
    try {
        const db = getDB();
        const { search } = req.query;
        let query = `
            SELECT s.*,
                   COALESCE(s.status, CASE WHEN s.is_active = 1 THEN 'ACTIVE' ELSE 'SUSPENDED' END) as status,
                   (SELECT COUNT(*) FROM school_admin_assignments saa WHERE saa.school_id = s.id) as admin_count,
                   (SELECT COUNT(*) FROM teachers t WHERE t.school_id = s.id) as teacher_count,
                   (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id) as student_count
            FROM schools s
        `;
        const params = [];

        if (search) {
            query += ` WHERE LOWER(s.name) LIKE $1 OR LOWER(s.email) LIKE $1`;
            params.push(`%${search.toLowerCase()}%`);
        }

        query += ` ORDER BY s.id DESC`;
        const schools = await db.all(query, params);
        res.json({ schools });
    } catch (err) {
        console.error('SuperAdmin getSchools error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── GET /superadmin/schools/:id ───
exports.getSchoolById = async (req, res) => {
    try {
        const db = getDB();
        const school = await db.get("SELECT * FROM schools WHERE id = $1", [req.params.id]);
        if (!school) return res.status(404).json({ error: 'Not Found', message: 'School not found' });

        const admins = await db.all(`
            SELECT u.id, u.name, u.email, u.is_active, u.created_at, u.last_login
            FROM users u
            JOIN school_admin_assignments saa ON u.id = saa.user_id
            WHERE saa.school_id = $1
        `, [req.params.id]);

        res.json({ school, admins });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── POST /superadmin/schools ───
exports.createSchool = async (req, res) => {
    const { name, address, phone, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Validation Error', message: 'School name is required' });

    try {
        const db = getDB();
        const result = await db.run(
            'INSERT INTO schools (name, address, phone, email, status, is_active) VALUES ($1, $2, $3, $4, \'ACTIVE\', 1) RETURNING id',
            [name, address || null, phone || null, email || null]
        );
        await logSuperAdminAudit(req, 'CREATE_SCHOOL', 'School', result.lastID, `Created school ${name}`);
        res.status(201).json({ message: 'School created successfully', schoolId: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── PUT /superadmin/schools/:id ───
exports.updateSchool = async (req, res) => {
    const { name, address, phone, email } = req.body;
    try {
        const db = getDB();
        const existing = await db.get("SELECT id, name FROM schools WHERE id = $1", [req.params.id]);
        if (!existing) return res.status(404).json({ error: 'Not Found', message: 'School not found' });

        await db.run(
            'UPDATE schools SET name=$1, address=$2, phone=$3, email=$4 WHERE id=$5',
            [name || existing.name, address, phone, email, req.params.id]
        );
        await logSuperAdminAudit(req, 'UPDATE_SCHOOL', 'School', req.params.id, `Updated school ${name || existing.name}`);
        res.json({ message: 'School updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── PUT /superadmin/schools/:id/suspend ───
exports.suspendSchool = async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'Suspension reason is required' });
    }

    try {
        const db = getDB();
        const school = await db.get("SELECT id, name FROM schools WHERE id = $1", [req.params.id]);
        if (!school) return res.status(404).json({ error: 'Not Found', message: 'School not found' });

        await db.run(
            `UPDATE schools SET status = 'SUSPENDED', is_active = 0, suspension_reason = $1, suspended_at = CURRENT_TIMESTAMP, suspended_by = $2 WHERE id = $3`,
            [reason.trim(), req.user.id, req.params.id]
        );

        // Revoke active sessions for all users belonging to this school
        await db.run(`
            UPDATE users SET token_version = token_version + 1
            WHERE id IN (
                SELECT user_id FROM students WHERE school_id = $1
                UNION
                SELECT user_id FROM teachers WHERE school_id = $1
                UNION
                SELECT user_id FROM school_admin_assignments WHERE school_id = $1
            )
        `, [req.params.id]);

        await logSuperAdminAudit(req, 'SUSPEND_SCHOOL', 'School', req.params.id, `Suspended school ${school.name}`, reason.trim());
        res.json({ message: `School ${school.name} suspended successfully.` });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── PUT /superadmin/schools/:id/reactivate ───
exports.reactivateSchool = async (req, res) => {
    const { reason } = req.body;
    try {
        const db = getDB();
        const school = await db.get("SELECT id, name FROM schools WHERE id = $1", [req.params.id]);
        if (!school) return res.status(404).json({ error: 'Not Found', message: 'School not found' });

        await db.run(
            `UPDATE schools SET status = 'ACTIVE', is_active = 1, suspension_reason = NULL, suspended_at = NULL, suspended_by = NULL WHERE id = $1`,
            [req.params.id]
        );

        await logSuperAdminAudit(req, 'REACTIVATE_SCHOOL', 'School', req.params.id, `Reactivated school ${school.name}`, reason || null);
        res.json({ message: `School ${school.name} reactivated successfully.` });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── PUT /superadmin/schools/:id/archive ───
exports.archiveSchool = async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'Archiving reason is required' });
    }

    try {
        const db = getDB();
        const school = await db.get("SELECT id, name FROM schools WHERE id = $1", [req.params.id]);
        if (!school) return res.status(404).json({ error: 'Not Found', message: 'School not found' });

        await db.run(
            `UPDATE schools SET status = 'ARCHIVED', is_active = 0, suspension_reason = $1, suspended_at = CURRENT_TIMESTAMP, suspended_by = $2 WHERE id = $3`,
            [reason.trim(), req.user.id, req.params.id]
        );

        // Revoke sessions
        await db.run(`
            UPDATE users SET token_version = token_version + 1
            WHERE id IN (
                SELECT user_id FROM students WHERE school_id = $1
                UNION
                SELECT user_id FROM teachers WHERE school_id = $1
                UNION
                SELECT user_id FROM school_admin_assignments WHERE school_id = $1
            )
        `, [req.params.id]);

        await logSuperAdminAudit(req, 'ARCHIVE_SCHOOL', 'School', req.params.id, `Archived school ${school.name}`, reason.trim());
        res.json({ message: `School ${school.name} archived successfully.` });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── GET /superadmin/admins ───
exports.getAdmins = async (req, res) => {
    try {
        const db = getDB();
        const { search } = req.query;
        let query = `
            SELECT u.id, u.name, u.email, u.is_active, u.created_at, u.last_login,
                   saa.school_id,
                   s.name as school_name
            FROM users u
            LEFT JOIN school_admin_assignments saa ON u.id = saa.user_id
            LEFT JOIN schools s ON saa.school_id = s.id
            WHERE u.role = 'SchoolAdmin'
        `;
        const params = [];

        if (search) {
            query += ` AND (LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1 OR LOWER(s.name) LIKE $1)`;
            params.push(`%${search.toLowerCase()}%`);
        }

        query += ` ORDER BY u.id DESC`;
        const admins = await db.all(query, params);
        res.json({ admins });
    } catch (err) {
        console.error('SuperAdmin getAdmins error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── POST /superadmin/admins ───
exports.createAdmin = async (req, res) => {
    const { name, email, password, school_id } = req.body;
    if (!name || !email || !school_id) {
        return res.status(400).json({ error: 'Validation Error', message: 'name, email, and school_id are required' });
    }

    try {
        const db = getDB();

        const existing = await db.get('SELECT id FROM users WHERE email = $1', [email]);
        if (existing) return res.status(409).json({ error: 'Conflict', message: 'An account with this email already exists' });

        const school = await db.get('SELECT id, name FROM schools WHERE id = $1', [school_id]);
        if (!school) return res.status(404).json({ error: 'Not Found', message: 'School not found' });

        const setupToken = crypto.randomBytes(32).toString('hex');
        const initialPass = password || crypto.randomBytes(16).toString('hex');
        const hash = await bcrypt.hash(initialPass, 10);

        const result = await db.transaction(async (client) => {
            const userRes = await client.run(
                'INSERT INTO users (name, email, password_hash, role, is_active, setup_token, setup_token_expires) VALUES ($1, $2, $3, $4, 1, $5, CURRENT_TIMESTAMP + INTERVAL \'7 days\') RETURNING id',
                [name, email, hash, 'SchoolAdmin', setupToken]
            );
            const userId = userRes.lastID;

            await client.run(
                'INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)',
                [userId, school_id]
            );
            return userId;
        });

        sendInvitationEmail({
            email,
            name,
            role: 'School Admin',
            schoolName: school.name,
            token: setupToken
        });

        await logSuperAdminAudit(req, 'CREATE_SCHOOL_ADMIN', 'User', result, `Created SchoolAdmin for ${school.name}`);
        res.status(201).json({ message: 'School Admin created successfully. Invitation link sent.', userId: result });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── PUT /superadmin/admins/:id ───
exports.updateAdmin = async (req, res) => {
    const { name, email, school_id, is_active } = req.body;
    const adminId = req.params.id;

    try {
        const db = getDB();
        const user = await db.get("SELECT * FROM users WHERE id = $1 AND role = 'SchoolAdmin'", [adminId]);
        if (!user) return res.status(404).json({ error: 'Not Found', message: 'School Admin not found' });

        if (email && email !== user.email) {
            const dup = await db.get('SELECT id FROM users WHERE email = $1 AND id != $2', [email, adminId]);
            if (dup) return res.status(409).json({ error: 'Conflict', message: 'Email already in use by another user' });
        }

        await db.transaction(async (client) => {
            await client.run(
                'UPDATE users SET name=$1, email=$2, is_active=$3 WHERE id=$4',
                [name || user.name, email || user.email, is_active !== undefined ? is_active : user.is_active, adminId]
            );

            if (school_id !== undefined) {
                const schoolExists = await client.get('SELECT id FROM schools WHERE id = $1', [school_id]);
                if (!schoolExists) throw new Error('Target school does not exist');

                await client.run('DELETE FROM school_admin_assignments WHERE user_id = $1', [adminId]);
                await client.run('INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)', [adminId, school_id]);
            }
        });

        await logSuperAdminAudit(req, 'UPDATE_SCHOOL_ADMIN', 'User', adminId, `Updated SchoolAdmin ${email || user.email}`);
        res.json({ message: 'School Admin updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── 2. GLOBAL PLATFORM STAFF MANAGEMENT ───

// GET /api/superadmin/platform-staff
exports.getPlatformStaff = async (req, res) => {
    try {
        const db = getDB();
        const { role, status } = req.query;

        let query = `
            SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.last_login, u.setup_token,
                   (CASE WHEN u.setup_token IS NOT NULL THEN 'INVITED' ELSE 'ACTIVE' END) as setup_status,
                   (SELECT COUNT(*) FROM learning_contents lc WHERE lc.created_by = u.id) as content_published_count,
                   (SELECT COUNT(*) FROM support_messages sm WHERE sm.sender_id = u.id) as tickets_handled_count
            FROM users u
            WHERE u.role IN ('ContentManager', 'SupportOfficer')
        `;
        const params = [];

        if (role && GLOBAL_STAFF_ROLES.has(role)) {
            query += ` AND u.role = $${params.length + 1}`;
            params.push(role);
        }
        if (status !== undefined) {
            query += ` AND u.is_active = $${params.length + 1}`;
            params.push(parseInt(status, 10));
        }

        query += ` ORDER BY u.id DESC`;
        const staff = await db.all(query, params);
        res.json({ staff });
    } catch (err) {
        console.error('Error fetching platform staff:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve platform staff' });
    }
};

// POST /api/superadmin/platform-staff
exports.createPlatformStaff = async (req, res) => {
    try {
        const { name, email, role } = req.body;

        if (!name || !email || !role) {
            return res.status(400).json({ error: 'Validation Error', message: 'Name, email, and role are required.' });
        }

        // Strict role whitelist verification
        if (!GLOBAL_STAFF_ROLES.has(role)) {
            return res.status(400).json({ error: 'Bad Request', message: 'Only ContentManager and SupportOfficer can be created via Platform Staff management.' });
        }

        const db = getDB();
        const existing = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
        if (existing) {
            return res.status(409).json({ error: 'Conflict', message: 'An account with this email already exists.' });
        }

        const { rawToken, tokenHash } = generateSetupToken();
        const initialPass = crypto.randomBytes(16).toString('hex');
        const hash = await bcrypt.hash(initialPass, 10);

        // Create user with global role (no school association)
        const userRes = await db.get(`
            INSERT INTO users (name, email, password_hash, role, is_active, setup_token, setup_token_expires)
            VALUES ($1, $2, $3, $4, 1, $5, CURRENT_TIMESTAMP + INTERVAL '7 days') RETURNING id, name, email, role, created_at
        `, [name.trim(), email.trim().toLowerCase(), hash, role, tokenHash]);

        sendInvitationEmail({
            email: userRes.email,
            name: userRes.name,
            role: userRes.role,
            schoolName: 'EduMan Global Platform',
            token: rawToken
        }).catch(() => {});

        await logSuperAdminAudit(req, 'CREATE_PLATFORM_STAFF', 'User', userRes.id, `Created ${role} account for ${name} (${email})`);
        await recordInvitationAudit({
            actorId: req.user?.id,
            action: 'INVITATION_CREATED',
            targetUserId: userRes.id,
            role: userRes.role,
            reason: `Created ${role} account for ${name}`,
            ipAddress: req.ip
        });

        res.status(201).json({ message: `${role} account created successfully. Invitation link sent.`, staff: userRes });
    } catch (err) {
        console.error('Error creating platform staff:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to create platform staff' });
    }
};

// GET /api/superadmin/platform-staff/:id
exports.getPlatformStaffById = async (req, res) => {
    try {
        const db = getDB();
        const staff = await db.get(`
            SELECT id, name, email, role, is_active, created_at, last_login, setup_token,
                   (CASE WHEN setup_token IS NOT NULL THEN 'INVITED' ELSE 'ACTIVE' END) as setup_status
            FROM users WHERE id = $1 AND role IN ('ContentManager', 'SupportOfficer')
        `, [req.params.id]);

        if (!staff) {
            return res.status(404).json({ error: 'Not Found', message: 'Platform staff user not found.' });
        }

        res.json({ staff });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// PUT /api/superadmin/platform-staff/:id
exports.updatePlatformStaff = async (req, res) => {
    try {
        const { name, email } = req.body;
        const db = getDB();
        const staff = await db.get("SELECT id, name, email, role FROM users WHERE id = $1 AND role IN ('ContentManager', 'SupportOfficer')", [req.params.id]);
        if (!staff) return res.status(404).json({ error: 'Not Found', message: 'Platform staff user not found.' });

        if (email && email.toLowerCase() !== staff.email.toLowerCase()) {
            const dup = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2', [email, req.params.id]);
            if (dup) return res.status(409).json({ error: 'Conflict', message: 'Email already in use.' });
        }

        await db.run(`UPDATE users SET name = $1, email = $2 WHERE id = $3`, [name || staff.name, email ? email.toLowerCase() : staff.email, req.params.id]);
        await logSuperAdminAudit(req, 'UPDATE_PLATFORM_STAFF', 'User', req.params.id, `Updated ${staff.role} ${email || staff.email}`);
        res.json({ message: 'Platform staff details updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// PUT /api/superadmin/platform-staff/:id/status
exports.updatePlatformStaffStatus = async (req, res) => {
    try {
        const { is_active, confirmation } = req.body;
        const staffId = parseInt(req.params.id, 10);
        const db = getDB();

        const user = await db.get("SELECT id, name, email, role, is_active FROM users WHERE id = $1", [staffId]);
        if (!user) return res.status(404).json({ error: 'Not Found', message: 'User not found.' });

        // Protect last active SuperAdmin from deactivation/role change
        if (user.role === 'SuperAdmin' && is_active === 0) {
            const activeSuperAdmins = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'SuperAdmin' AND is_active = 1");
            if (parseInt(activeSuperAdmins.count, 10) <= 1) {
                return res.status(400).json({ error: 'Forbidden', message: 'Cannot deactivate the last active SuperAdmin account.' });
            }
        }

        const newStatus = is_active ? 1 : 0;
        await db.transaction(async (client) => {
            await client.run("UPDATE users SET is_active = $1 WHERE id = $2", [newStatus, staffId]);
            if (newStatus === 0) {
                // Deactivation automatically revokes active sessions
                await client.run("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [staffId]);
            }
        });

        await logSuperAdminAudit(req, newStatus === 1 ? 'ACTIVATE_STAFF' : 'DEACTIVATE_STAFF', 'User', staffId, `${newStatus === 1 ? 'Activated' : 'Deactivated'} ${user.role} ${user.email}`);
        res.json({ message: `Staff member ${newStatus === 1 ? 'activated' : 'deactivated'} successfully.` });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// POST /api/superadmin/platform-staff/:id/resend-invitation
exports.resendStaffInvitation = async (req, res) => {
    try {
        const staffId = req.params.id;
        const db = getDB();
        const staff = await db.get("SELECT id, name, email, role FROM users WHERE id = $1 AND role IN ('ContentManager', 'SupportOfficer', 'SchoolAdmin')", [staffId]);
        if (!staff) return res.status(404).json({ error: 'Not Found', message: 'Staff user not found.' });

        const { rawToken: rawNewToken, tokenHash: newTokenHash } = generateSetupToken();
        await db.run(
            "UPDATE users SET setup_token = $1, setup_token_expires = CURRENT_TIMESTAMP + INTERVAL '7 days' WHERE id = $2",
            [newTokenHash, staffId]
        );

        sendInvitationEmail({
            email: staff.email,
            name: staff.name,
            role: staff.role,
            schoolName: 'EduMan Global Platform',
            token: rawNewToken
        }).catch(() => {});

        await logSuperAdminAudit(req, 'RESEND_INVITATION', 'User', staffId, `Resent invitation to ${staff.role} ${staff.email}`);
        await recordInvitationAudit({
            actorId: req.user?.id,
            action: 'INVITATION_RESENT',
            targetUserId: staff.id,
            role: staff.role,
            reason: `Resent invitation setup link`,
            ipAddress: req.ip
        });

        res.json({ message: `Invitation setup link resent to ${staff.email}.` });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// POST /api/superadmin/platform-staff/:id/reset-access
exports.resetStaffAccess = async (req, res) => {
    try {
        const staffId = req.params.id;
        const db = getDB();
        const staff = await db.get("SELECT id, name, email, role FROM users WHERE id = $1", [staffId]);
        if (!staff) return res.status(404).json({ error: 'Not Found', message: 'User not found.' });

        const { rawToken: rawNewToken, tokenHash: newTokenHash } = generateSetupToken();

        await db.transaction(async (client) => {
            // Revoke active sessions + invalidate password + generate new setup token
            await client.run(`
                UPDATE users 
                SET token_version = token_version + 1, setup_token = $1, setup_token_expires = CURRENT_TIMESTAMP + INTERVAL '7 days' 
                WHERE id = $2
            `, [newTokenHash, staffId]);
        });

        sendInvitationEmail({
            email: staff.email,
            name: staff.name,
            role: staff.role,
            schoolName: 'EduMan Global Platform',
            token: rawNewToken
        }).catch(() => {});

        await logSuperAdminAudit(req, 'RESET_ACCESS', 'User', staffId, `Reset access & issued setup token for ${staff.email}`);
        await recordInvitationAudit({
            actorId: req.user?.id,
            action: 'INVITATION_REVOKED',
            targetUserId: staff.id,
            role: staff.role,
            reason: `Reset access and invalidated previous sessions and tokens`,
            ipAddress: req.ip
        });
        await recordInvitationAudit({
            actorId: req.user?.id,
            action: 'INVITATION_RESENT',
            targetUserId: staff.id,
            role: staff.role,
            reason: `Generated new setup token upon access reset`,
            ipAddress: req.ip
        });

        res.json({ message: `Access reset successfully. 1-click password setup link sent to ${staff.email}.` });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// POST /api/superadmin/platform-staff/:id/revoke-sessions
exports.revokeStaffSessions = async (req, res) => {
    try {
        const staffId = req.params.id;
        const db = getDB();
        const staff = await db.get("SELECT id, email, role FROM users WHERE id = $1", [staffId]);
        if (!staff) return res.status(404).json({ error: 'Not Found', message: 'User not found.' });

        await db.run("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [staffId]);
        await logSuperAdminAudit(req, 'REVOKE_SESSIONS', 'User', staffId, `Revoked active JWT sessions for ${staff.email}`);
        res.json({ message: `Active sessions for ${staff.email} revoked successfully.` });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── 3. COMMAND CENTER DASHBOARD ───
exports.getCommandCenter = async (req, res) => {
    try {
        const db = getDB();
        const [
            totalSchools, activeSchools, suspendedSchools, archivedSchools,
            totalStudents, totalTeachers, totalParents, totalAccountants, totalAdmins, totalGlobalStaff,
            openTickets, urgentTickets, slaBreachedTickets, unassignedTickets, newInquiries, pendingContent
        ] = await Promise.all([
            db.get("SELECT COUNT(*) as count FROM schools"),
            db.get("SELECT COUNT(*) as count FROM schools WHERE status = 'ACTIVE' OR (status IS NULL AND is_active = 1)"),
            db.get("SELECT COUNT(*) as count FROM schools WHERE status = 'SUSPENDED'"),
            db.get("SELECT COUNT(*) as count FROM schools WHERE status = 'ARCHIVED'"),
            db.get("SELECT COUNT(*) as count FROM students"),
            db.get("SELECT COUNT(*) as count FROM teachers"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role = 'Parent'"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role = 'Accountant'"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role = 'SchoolAdmin'"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role IN ('SuperAdmin', 'ContentManager', 'SupportOfficer')"),
            db.get("SELECT COUNT(*) as count FROM support_threads WHERE status IN ('NEW', 'OPEN', 'IN_PROGRESS')"),
            db.get("SELECT COUNT(*) as count FROM support_threads WHERE priority = 'URGENT' AND status != 'RESOLVED'"),
            db.get("SELECT COUNT(*) as count FROM support_threads WHERE is_sla_breached = 1 AND status != 'RESOLVED'"),
            db.get("SELECT COUNT(*) as count FROM support_threads WHERE assigned_user_id IS NULL AND status != 'RESOLVED'"),
            db.get("SELECT COUNT(*) as count FROM contact_inquiries WHERE status = 'NEW'"),
            db.get("SELECT COUNT(*) as count FROM learning_contents WHERE status = 'DRAFT'")
        ]);

        res.json({
            platform: {
                totalSchools: parseInt(totalSchools.count || 0, 10),
                activeSchools: parseInt(activeSchools.count || 0, 10),
                suspendedSchools: parseInt(suspendedSchools.count || 0, 10),
                archivedSchools: parseInt(archivedSchools.count || 0, 10),
                totalStudents: parseInt(totalStudents.count || 0, 10),
                totalTeachers: parseInt(totalTeachers.count || 0, 10),
                totalParents: parseInt(totalParents.count || 0, 10),
                totalAccountants: parseInt(totalAccountants.count || 0, 10),
                totalAdmins: parseInt(totalAdmins.count || 0, 10),
                totalGlobalStaff: parseInt(totalGlobalStaff.count || 0, 10),
            },
            operations: {
                openTickets: parseInt(openTickets.count || 0, 10),
                urgentTickets: parseInt(urgentTickets.count || 0, 10),
                slaBreachedTickets: parseInt(slaBreachedTickets.count || 0, 10),
                unassignedTickets: parseInt(unassignedTickets.count || 0, 10),
                newInquiries: parseInt(newInquiries.count || 0, 10),
                pendingContent: parseInt(pendingContent.count || 0, 10)
            },
            systemHealth: {
                smtpStatus: process.env.SMTP_USER ? 'CONFIGURED' : 'DEV_MODE',
                databaseStatus: 'HEALTHY',
                lastCheckedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Command center error:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to generate command center metrics' });
    }
};

// ─── 4. GLOBAL USER SEARCH ───
exports.searchUsers = async (req, res) => {
    try {
        const { q, role, status } = req.query;
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ error: 'Bad Request', message: 'Search query must be at least 2 characters.' });
        }

        const db = getDB();
        const term = `%${q.trim().toLowerCase()}%`;

        let query = `
            SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.last_login,
                   s.name as school_name, s.id as school_id
            FROM users u
            LEFT JOIN students st ON u.id = st.user_id
            LEFT JOIN school_admin_assignments saa ON u.id = saa.user_id
            LEFT JOIN teachers t ON u.id = t.user_id
            LEFT JOIN schools s ON COALESCE(st.school_id, saa.school_id, t.school_id, u.school_id) = s.id
            WHERE (LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1 OR LOWER(s.name) LIKE $1)
        `;
        const params = [term];

        if (role) {
            query += ` AND u.role = $${params.length + 1}`;
            params.push(role);
        }
        if (status !== undefined) {
            query += ` AND u.is_active = $${params.length + 1}`;
            params.push(parseInt(status, 10));
        }

        query += ` ORDER BY u.id DESC LIMIT 50`;
        const users = await db.all(query, params);

        // Sanitize output (strictly exclude password_hash, tokens, keys)
        const sanitized = users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            is_active: u.is_active,
            school_id: u.school_id,
            school_name: u.school_name || 'N/A (Global Role)',
            last_login: u.last_login,
            created_at: u.created_at
        }));

        res.json({ users: sanitized });
    } catch (err) {
        console.error('Global user search error:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to search users' });
    }
};

// ─── 5. SUPERADMIN AUDIT LOGS ───
exports.getAuditLogs = async (req, res) => {
    try {
        const db = getDB();
        const auditLogs = await db.all(`
            SELECT sal.*, u.name as actor_name, u.email as actor_email, u.role as actor_role
            FROM superadmin_audit_logs sal
            JOIN users u ON sal.user_id = u.id
            ORDER BY sal.created_at DESC
            LIMIT 200
        `);
        res.json({ auditLogs });
    } catch (err) {
        console.error('Error fetching SuperAdmin audit logs:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve audit logs' });
    }
};

// ─── 6. SUPPORT ESCALATIONS QUEUE ───
exports.getEscalations = async (req, res) => {
    try {
        const db = getDB();
        const escalations = await db.all(`
            SELECT st.*, u.name as creator_name, u.email as creator_email, u.role as creator_role,
                   assigned.name as assigned_name
            FROM support_threads st
            JOIN users u ON st.user_id = u.id
            LEFT JOIN users assigned ON st.assigned_user_id = assigned.id
            WHERE st.priority = 'URGENT' OR st.is_sla_breached = 1 OR st.status = 'ESCALATED' OR st.assigned_user_id IS NULL
            ORDER BY st.updated_at DESC
        `);
        res.json({ escalations });
    } catch (err) {
        console.error('Error fetching support escalations:', err);
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve escalation queue' });
    }
};

// ─── 7. PLATFORM SETTINGS ───
const ALLOWED_SETTING_KEYS = new Set([
    'platform_name', 'support_email', 'contact_email', 'timezone',
    'maintenance_mode', 'registration_open', 'max_upload_size_mb'
]);

exports.getSettings = async (req, res) => {
    try {
        const db = getDB();
        const settings = await db.all("SELECT setting_key, setting_value, description, updated_at FROM platform_settings");
        res.json({ settings });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve platform settings' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Bad Request', message: 'Settings object is required.' });
        }

        const db = getDB();
        await db.transaction(async (client) => {
            for (const [key, value] of Object.entries(settings)) {
                if (!ALLOWED_SETTING_KEYS.has(key)) continue;

                // Server-side validation
                let strVal = String(value).trim();
                if (key === 'support_email' || key === 'contact_email') {
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) throw new Error(`Invalid email format for ${key}`);
                } else if (key === 'max_upload_size_mb') {
                    const num = parseInt(strVal, 10);
                    if (isNaN(num) || num < 1 || num > 500) throw new Error('Upload size must be between 1 and 500 MB');
                } else if (key === 'maintenance_mode' || key === 'registration_open') {
                    strVal = strVal === 'true' || strVal === '1' ? 'true' : 'false';
                }

                await client.run(`
                    INSERT INTO platform_settings (setting_key, setting_value, updated_by, updated_at)
                    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                    ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
                `, [key, strVal, req.user.id]);
            }
        });

        await logSuperAdminAudit(req, 'UPDATE_PLATFORM_SETTINGS', 'Settings', null, `Updated platform settings`);
        res.json({ message: 'Platform settings updated successfully.' });
    } catch (err) {
        res.status(400).json({ error: 'Validation Error', message: err.message });
    }
};
