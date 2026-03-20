const { getDB } = require('../config/database');

exports.getClasses = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const classes = await db.all("SELECT * FROM classes WHERE school_id = $1 ORDER BY level ASC", [school_id]);
        res.json({ classes });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createClass = async (req, res) => {
    const { name, level } = req.body;
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const result = await db.run('INSERT INTO classes (school_id, name, level) VALUES ($1, $2, $3) RETURNING id', [school_id, name, level]);
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
    const { name, level } = req.body;
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        
        await db.run(
            'UPDATE classes SET name = $1, level = $2 WHERE id = $3 AND school_id = $4',
            [name, level, id, school_id]
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
