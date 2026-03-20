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
        
        // Check if email exists
        const existingUser = await db.get('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'Duplicate', message: 'Email is already registered.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const school_id = req.user.school_id;

        const result = await db.transaction(async (client) => {
            // 1. Create User account (Role: Teacher)
            const userResult = await client.run(
                'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
                [`${first_name} ${last_name}`, email, passwordHash, 'Teacher']
            );
            const userId = userResult.lastID;

            // 2. Create Teacher Profile
            const teacherResult = await client.run(
                'INSERT INTO teachers (user_id, school_id, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [userId, school_id, first_name, last_name, phone]
            );
            const teacherId = teacherResult.lastID;

            // 3. Assign to Classes
            if (class_ids && Array.isArray(class_ids)) {
                for (let class_id of class_ids) {
                    await client.run(
                        'INSERT INTO teacher_classes (teacher_id, class_id, school_id) VALUES ($1, $2, $3)',
                        [teacherId, class_id, school_id]
                    );
                }
            }

            return { teacherId, userId };
        });

        res.json({ 
            message: 'Teacher created successfully', 
            teacherId: result.teacherId, 
            userId: result.userId 
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.updateTeacher = async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, phone, class_ids } = req.body;
    
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        await db.transaction(async (client) => {
            // Update profile
            await client.run(
                'UPDATE teachers SET first_name = $1, last_name = $2, phone = $3 WHERE id = $4 AND school_id = $5',
                [first_name, last_name, phone, id, school_id]
            );

            // Update user record name
            const teacher = await client.get('SELECT user_id FROM teachers WHERE id = $1', [id]);
            if (teacher) {
                await client.run('UPDATE users SET name = $1 WHERE id = $2', [`${first_name} ${last_name}`, teacher.user_id]);
            }

            // Sync classes
            await client.run('DELETE FROM teacher_classes WHERE teacher_id = $1 AND school_id = $2', [id, school_id]);
            if (class_ids && Array.isArray(class_ids)) {
                for (let class_id of class_ids) {
                    await client.run(
                        'INSERT INTO teacher_classes (teacher_id, class_id, school_id) VALUES ($1, $2, $3)',
                        [id, class_id, school_id]
                    );
                }
            }
        });

        res.json({ message: 'Teacher updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.deleteTeacher = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const teacher = await db.get('SELECT user_id FROM teachers WHERE id = $1 AND school_id = $2', [id, req.user.school_id]);
        
        if (!teacher) return res.status(404).json({ error: 'Not Found', message: 'Teacher not found in your school' });

        // Deleting the user cascades to delete the teacher profile
        await db.run('DELETE FROM users WHERE id = $1', [teacher.user_id]);
        
        res.json({ message: 'Teacher deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
