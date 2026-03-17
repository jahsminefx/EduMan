const { getDB } = require('../config/database');

exports.getClasses = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const classes = await db.all("SELECT * FROM classes WHERE school_id = ? ORDER BY level ASC", [school_id]);
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
        const result = await db.run('INSERT INTO classes (school_id, name, level) VALUES (?, ?, ?)', [school_id, name, level]);
        res.json({ message: 'Class created', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getSubjects = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const subjects = await db.all("SELECT * FROM subjects WHERE school_id = ? ORDER BY name ASC", [school_id]);
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
        const result = await db.run('INSERT INTO subjects (school_id, name, code) VALUES (?, ?, ?)', [school_id, name, code]);
        res.json({ message: 'Subject created', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
