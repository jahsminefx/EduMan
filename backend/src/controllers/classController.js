const { getDB } = require('../config/database');

exports.getClasses = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const classes = await db.all(`
            SELECT c.*, t.first_name || ' ' || t.last_name as form_teacher_name
            FROM classes c
            LEFT JOIN teachers t ON c.form_teacher_id = t.id
            WHERE c.school_id = $1
            ORDER BY c.level ASC
        `, [school_id]);
        res.json({ classes });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createClass = async (req, res) => {
    const { name, level, form_teacher_id } = req.body;
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Validate form teacher belongs to same school if provided
        if (form_teacher_id) {
            const teacher = await db.get('SELECT id FROM teachers WHERE id = $1 AND school_id = $2', [form_teacher_id, school_id]);
            if (!teacher) {
                return res.status(400).json({ error: 'Validation Error', message: 'Selected form teacher does not belong to your school.' });
            }
        }

        const result = await db.run(
            'INSERT INTO classes (school_id, name, level, form_teacher_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [school_id, name, level, form_teacher_id || null]
        );
        res.json({ message: 'Class created', id: result.lastID || result.rows?.[0]?.id });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getSubjects = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const subjects = await db.all("SELECT * FROM subjects WHERE school_id = $1 ORDER BY name ASC", [school_id]);
        res.json({ subjects });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createSubject = async (req, res) => {
    const { name, code } = req.body;
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const result = await db.run('INSERT INTO subjects (school_id, name, code) VALUES ($1, $2, $3) RETURNING id', [school_id, name, code]);
        res.json({ message: 'Subject created', id: result.lastID || result.rows?.[0]?.id });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.updateClass = async (req, res) => {
    const { id } = req.params;
    const { name, level, form_teacher_id } = req.body;
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Validate form teacher belongs to same school if provided
        if (form_teacher_id) {
            const teacher = await db.get('SELECT id FROM teachers WHERE id = $1 AND school_id = $2', [form_teacher_id, school_id]);
            if (!teacher) {
                return res.status(400).json({ error: 'Validation Error', message: 'Selected form teacher does not belong to your school.' });
            }
        }

        await db.run(
            'UPDATE classes SET name = $1, level = $2, form_teacher_id = $3 WHERE id = $4 AND school_id = $5',
            [name, level, form_teacher_id || null, id, school_id]
        );
        res.json({ message: 'Class updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.deleteClass = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Check if there are active students in the class
        const students = await db.get('SELECT COUNT(*) as count FROM students WHERE class_id = $1 AND school_id = $2', [id, school_id]);
        
        if (students && parseInt(students.count) > 0) {
            return res.status(400).json({ 
                error: 'Bad Request', 
                message: `Cannot delete class. There are currently ${students.count} student(s) enrolled. Reassign them first.` 
            });
        }

        await db.run('DELETE FROM classes WHERE id = $1 AND school_id = $2', [id, school_id]);
        res.json({ message: 'Class deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
