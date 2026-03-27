const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');

// ─── GET /superadmin/stats ───
exports.getGlobalStats = async (req, res) => {
    try {
        const db = getDB();
        const [totalSchools, activeSchools, totalAdmins, activeAdmins, totalTeachers, totalStudents] = await Promise.all([
            db.get("SELECT COUNT(*) as count FROM schools"),
            db.get("SELECT COUNT(*) as count FROM schools WHERE is_active = 1"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role = 'SchoolAdmin'"),
            db.get("SELECT COUNT(*) as count FROM users WHERE role = 'SchoolAdmin' AND is_active = 1"),
            db.get("SELECT COUNT(*) as count FROM teachers"),
            db.get("SELECT COUNT(*) as count FROM students"),
        ]);
        res.json({
            totalSchools: totalSchools.count || 0,
            activeSchools: activeSchools.count || 0,
            totalAdmins: totalAdmins.count || 0,
            activeAdmins: activeAdmins.count || 0,
            totalTeachers: totalTeachers.count || 0,
            totalStudents: totalStudents.count || 0,
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
            SELECT u.id, u.name, u.email, u.is_active, u.created_at
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
            'INSERT INTO schools (name, address, phone, email) VALUES ($1, $2, $3, $4) RETURNING id',
            [name, address || null, phone || null, email || null]
        );
        res.status(201).json({ message: 'School created successfully', schoolId: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── PUT /superadmin/schools/:id ───
exports.updateSchool = async (req, res) => {
    const { name, address, phone, email, is_active } = req.body;
    try {
        const db = getDB();
        const existing = await db.get("SELECT id FROM schools WHERE id = $1", [req.params.id]);
        if (!existing) return res.status(404).json({ error: 'Not Found', message: 'School not found' });

        await db.run(
            'UPDATE schools SET name=$1, address=$2, phone=$3, email=$4, is_active=$5 WHERE id=$6',
            [name, address, phone, email, is_active !== undefined ? is_active : 1, req.params.id]
        );
        res.json({ message: 'School updated successfully' });
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
            SELECT u.id, u.name, u.email, u.is_active, u.created_at,
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
    if (!name || !email || !password || !school_id) {
        return res.status(400).json({ error: 'Validation Error', message: 'name, email, password, and school_id are required' });
    }

    try {
        const db = getDB();

        // Check if email already exists
        const existing = await db.get('SELECT id FROM users WHERE email = $1', [email]);
        if (existing) return res.status(409).json({ error: 'Conflict', message: 'An account with this email already exists' });

        // Check school exists
        const school = await db.get('SELECT id FROM schools WHERE id = $1', [school_id]);
        if (!school) return res.status(404).json({ error: 'Not Found', message: 'School not found' });

        const hash = await bcrypt.hash(password, 10);

        const result = await db.transaction(async (client) => {
            const userRes = await client.run(
                'INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, 1) RETURNING id',
                [name, email, hash, 'SchoolAdmin']
            );
            const userId = userRes.lastID;

            await client.run(
                'INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)',
                [userId, school_id]
            );
            return userId;
        });

        res.status(201).json({ message: 'School Admin created successfully', userId: result });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// ─── PUT /superadmin/admins/:id ───
exports.updateAdmin = async (req, res) => {
    const { name, email, school_id, is_active, password } = req.body;
    const adminId = req.params.id;

    try {
        const db = getDB();
        const user = await db.get("SELECT * FROM users WHERE id = $1 AND role = 'SchoolAdmin'", [adminId]);
        if (!user) return res.status(404).json({ error: 'Not Found', message: 'School Admin not found' });

        // If email changed, check uniqueness
        if (email && email !== user.email) {
            const dup = await db.get('SELECT id FROM users WHERE email = $1 AND id != $2', [email, adminId]);
            if (dup) return res.status(409).json({ error: 'Conflict', message: 'Email already in use by another user' });
        }

        await db.transaction(async (client) => {
            // Update user
            let updateQuery = 'UPDATE users SET name=$1, email=$2, is_active=$3';
            let updateParams = [name || user.name, email || user.email, is_active !== undefined ? is_active : user.is_active];

            if (password) {
                const hash = await bcrypt.hash(password, 10);
                updateQuery += ', password_hash=$4 WHERE id=$5';
                updateParams.push(hash, adminId);
            } else {
                updateQuery += ' WHERE id=$4';
                updateParams.push(adminId);
            }

            await client.run(updateQuery, updateParams);

            // If school_id changed, reassign
            if (school_id !== undefined) {
                const schoolExists = await client.get('SELECT id FROM schools WHERE id = $1', [school_id]);
                if (!schoolExists) throw new Error('Target school does not exist');

                // Remove old assignment(s) and insert new one
                await client.run('DELETE FROM school_admin_assignments WHERE user_id = $1', [adminId]);
                await client.run('INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)', [adminId, school_id]);
            }
        });

        res.json({ message: 'School Admin updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
