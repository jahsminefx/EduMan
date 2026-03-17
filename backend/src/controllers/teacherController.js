const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');

exports.getTeachers = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const teachers = await db.all(`
            SELECT t.id, t.user_id, t.first_name, t.last_name, t.phone, u.email 
            FROM teachers t
            JOIN users u ON t.user_id = u.id
            WHERE t.school_id = $1
            ORDER BY t.last_name ASC
        `, [school_id]);

        // Fetch class assignments for each teacher
        for (let teacher of teachers) {
            const assignedClasses = await db.all(`
                SELECT c.id, c.name, c.level
                FROM classes c
                JOIN teacher_classes tc ON c.id = tc.class_id
                WHERE tc.teacher_id = $1 AND tc.school_id = $2
            `, [teacher.id, school_id]);
            teacher.classes = assignedClasses;
        }

        res.json({ teachers });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createTeacher = async (req, res) => {
        const { first_name, last_name, email, password, phone, class_ids } = req.body;
        
        if (!first_name || !last_name || !email || !password) {
            return res.status(400).json({ error: 'Validation Error', message: 'Missing required fields' });
        }
    
        try {
            const db = getDB();
            
            // 1. Check if email exists
            const existingUser = await db.get('SELECT id FROM users WHERE email = $1', [email]);
            if (existingUser) {
                return res.status(400).json({ error: 'Duplicate', message: 'Email is already registered.' });
            }
    
            // 2. Hash password
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
    
            await db.run('BEGIN TRANSACTION');
    
            // 3. Create User account automatically (Role: Teacher)
            const userResult = await db.run(
                'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
                [`${first_name} ${last_name}`, email, passwordHash, 'Teacher']
            );
            const userId = userResult.lastID || userResult.rows?.[0]?.id;
    
            const school_id = req.user.school_id;
    
            // 4. Create Teacher Profile
            const teacherResult = await db.run(
                'INSERT INTO teachers (user_id, school_id, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [userId, school_id, first_name, last_name, phone]
            );
            const teacherId = teacherResult.lastID || teacherResult.rows?.[0]?.id;
    
            // 5. Assign to Classes
            if (class_ids && Array.isArray(class_ids)) {
                for (let class_id of class_ids) {
                    await db.run(
                        'INSERT INTO teacher_classes (teacher_id, class_id, school_id) VALUES ($1, $2, $3)',
                        [teacherId, class_id, school_id]
                    );
                }
            }
    
            await db.run('COMMIT');
    
            res.json({ 
                message: 'Teacher created successfully', 
                teacherId: teacherId, 
                userId: userId 
            });
    } catch (err) {
        const db = getDB();
        if (db) await db.run('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.updateTeacher = async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, phone, class_ids } = req.body;
    
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        await db.run('BEGIN TRANSACTION');

        // Update profile
        await db.run(
            'UPDATE teachers SET first_name = $1, last_name = $2, phone = $3 WHERE id = $4 AND school_id = $5',
            [first_name, last_name, phone, id, school_id]
        );

        // Update user record name
        const teacher = await db.get('SELECT user_id FROM teachers WHERE id = $1', [id]);
        if (teacher) {
            await db.run('UPDATE users SET name = $1 WHERE id = $2', [`${first_name} ${last_name}`, teacher.user_id]);
        }

        // Sync classes
        await db.run('DELETE FROM teacher_classes WHERE teacher_id = $1 AND school_id = $2', [id, school_id]);
        if (class_ids && Array.isArray(class_ids)) {
            for (let class_id of class_ids) {
                await db.run(
                    'INSERT INTO teacher_classes (teacher_id, class_id, school_id) VALUES ($1, $2, $3)',
                    [id, class_id, school_id]
                );
            }
        }

        await db.run('COMMIT');
        res.json({ message: 'Teacher updated successfully' });
    } catch (err) {
        const db = getDB();
        if (db) await db.run('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.deleteTeacher = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        // Since sqlite is dealing with cascaded deletes, deleting the user will delete the teacher profile.
        // First get the user_id for the teacher
        const teacher = await db.get('SELECT user_id FROM teachers WHERE id = $1 AND school_id = $2', [id, req.user.school_id]);
        
        if (!teacher) return res.status(404).json({ error: 'Not Found', message: 'Teacher not found in your school' });

        await db.run('DELETE FROM users WHERE id = $1', [teacher.user_id]);
        
        res.json({ message: 'Teacher deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
