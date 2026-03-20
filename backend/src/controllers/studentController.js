const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');

exports.getStudents = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const students = await db.all(`
            SELECT s.*, c.name as class_name, c.level as class_level
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.school_id = $1
            ORDER BY s.last_name ASC
        `, [school_id]);
        res.json({ students });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createStudent = async (req, res) => {
    const { admission_number, first_name, last_name, gender, dob, class_id, parent_name, parent_phone, email, password } = req.body;
    
    try {
        const db = getDB();
        
        if (!admission_number || !first_name || !last_name || !email || !password) {
            return res.status(400).json({ error: 'Validation Error', message: 'Missing required fields (admission_number, name, email, password)' });
        }

        const school_id = req.user.school_id;

        const result = await db.transaction(async (client) => {
            // 1. Create User record for login
            const password_hash = await bcrypt.hash(password, 10);
            const userResult = await client.run(
                `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
                [`${first_name} ${last_name}`, email, password_hash, 'Student']
            );
            const user_id = userResult.lastID;

            // 2. Create Student record linked to User
            const studentResult = await client.run(
                `INSERT INTO students (user_id, school_id, admission_number, first_name, last_name, gender, dob, class_id, parent_name, parent_phone) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
                [user_id, school_id, admission_number, first_name, last_name, gender, dob, class_id, parent_name, parent_phone]
            );

            return { student_id: studentResult.lastID, user_id };
        });

        res.json({ 
            message: 'Student and login account created successfully', 
            id: result.student_id,
            user_id: result.user_id
        });
    } catch (err) {
        // PostgreSQL unique violation error code
        if (err.code === '23505') {
            const field = err.detail && err.detail.includes('email') ? 'Email' : 'Admission number';
            return res.status(400).json({ error: 'Duplicate', message: `${field} already exists.` });
        }
        console.error('Create student error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.updateStudent = async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, gender, dob, class_id, parent_name, parent_phone } = req.body;
    
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        await db.run(
            `UPDATE students 
             SET first_name=$1, last_name=$2, gender=$3, dob=$4, class_id=$5, parent_name=$6, parent_phone=$7 
             WHERE id=$8 AND school_id=$9`,
            [first_name, last_name, gender, dob, class_id, parent_name, parent_phone, id, school_id]
        );
        res.json({ message: 'Student updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.deleteStudent = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const result = await db.run(`DELETE FROM students WHERE id=$1 AND school_id=$2`, [id, school_id]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Student not found in your school' });
        }
        
        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
