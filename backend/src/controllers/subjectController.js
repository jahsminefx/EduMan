const { getDB } = require('../config/database');

exports.getSubjects = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        
        // Get all subjects
        const subjects = await db.all("SELECT * FROM subjects WHERE school_id = ? ORDER BY name ASC", [school_id]);
        
        // For each subject, get assigned classes and teachers
        for (let subject of subjects) {
            const assignedClasses = await db.all(`
                SELECT c.id, c.name, c.level
                FROM classes c
                JOIN class_subjects cs ON c.id = cs.class_id
                WHERE cs.subject_id = ? AND cs.school_id = ?
            `, [subject.id, school_id]);
            subject.classes = assignedClasses;

            const assignedTeachers = await db.all(`
                SELECT t.id, t.first_name, t.last_name, tc.class_id
                FROM teachers t
                JOIN teacher_subject_assignments tsa ON t.id = tsa.teacher_id
                LEFT JOIN teacher_classes tc ON t.id = tc.teacher_id AND tsa.class_id = tc.class_id
                WHERE tsa.subject_id = ? AND t.school_id = ?
            `, [subject.id, school_id]);
            subject.teachers = assignedTeachers;
        }
        
        res.json({ subjects });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.assignTeacher = async (req, res) => {
    const { id: subject_id } = req.params;
    const { teacher_id, class_id } = req.body;

    if (!teacher_id || !class_id) {
        return res.status(400).json({ error: 'Bad Request', message: 'teacher_id and class_id are required' });
    }

    let db;
    try {
        db = getDB();
        const school_id = req.user.school_id;

        // Verify teacher and subject belong to the same school
        const teacher = await db.get("SELECT id FROM teachers WHERE id = ? AND school_id = ?", [teacher_id, school_id]);
        const subject = await db.get("SELECT id FROM subjects WHERE id = ? AND school_id = ?", [subject_id, school_id]);

        if (!teacher || !subject) {
            return res.status(404).json({ error: 'Not Found', message: 'Teacher or Subject not found in your school' });
        }

        await db.run('BEGIN TRANSACTION');

        // 1. Assign teacher to subject in this class
        await db.run(`
            INSERT OR IGNORE INTO teacher_subject_assignments (teacher_id, class_id, subject_id)
            VALUES (?, ?, ?)
        `, [teacher_id, class_id, subject_id]);

        // 2. Ensure teacher is assigned to this class generally if not already
        await db.run(`
            INSERT OR IGNORE INTO teacher_classes (teacher_id, class_id, school_id)
            VALUES (?, ?, ?)
        `, [teacher_id, class_id, school_id]);

        await db.run('COMMIT');
        res.json({ message: 'Teacher assigned to subject successfully' });
    } catch (err) {
        if (db) await db.run('ROLLBACK');
        console.error('Assign teacher error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createSubject = async (req, res) => {
    const { name, code, class_ids } = req.body; // class_ids is an array
    if (!name) return res.status(400).json({ error: 'Bad Request', message: 'Subject name is required' });
    
    let db;
    try {
        db = getDB();
        const school_id = req.user.school_id;
        
        await db.run('BEGIN TRANSACTION');
        
        const result = await db.run('INSERT INTO subjects (school_id, name, code) VALUES (?, ?, ?)', [school_id, name, code]);
        const subject_id = result.lastID;
        
        if (class_ids && Array.isArray(class_ids)) {
            for (let class_id of class_ids) {
                await db.run('INSERT INTO class_subjects (subject_id, class_id, school_id) VALUES (?, ?, ?)', [subject_id, class_id, school_id]);
            }
        }
        
        await db.run('COMMIT');
        res.json({ message: 'Subject created', id: subject_id });
    } catch (err) {
        if (db) await db.run('ROLLBACK');
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.updateSubject = async (req, res) => {
    const { id } = req.params;
    const { name, code, class_ids } = req.body;
    
    let db;
    try {
        db = getDB();
        const school_id = req.user.school_id;
        
        await db.run('BEGIN TRANSACTION');
        
        await db.run('UPDATE subjects SET name = ?, code = ? WHERE id = ? AND school_id = ?', [name, code, id, school_id]);
        
        // Sync class assignments
        await db.run('DELETE FROM class_subjects WHERE subject_id = ? AND school_id = ?', [id, school_id]);
        
        if (class_ids && Array.isArray(class_ids)) {
            for (let class_id of class_ids) {
                await db.run('INSERT INTO class_subjects (subject_id, class_id, school_id) VALUES (?, ?, ?)', [id, class_id, school_id]);
            }
        }
        
        await db.run('COMMIT');
        res.json({ message: 'Subject updated' });
    } catch (err) {
        if (db) await db.run('ROLLBACK');
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.deleteSubject = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        await db.run('DELETE FROM subjects WHERE id = ? AND school_id = ?', [id, school_id]);
        // class_subjects will be deleted via ON DELETE CASCADE if configured, but let's be safe
        await db.run('DELETE FROM class_subjects WHERE subject_id = ? AND school_id = ?', [id, school_id]);
        res.json({ message: 'Subject deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
