const { getDB } = require('../config/database');
const path = require('path');

// Teacher: Create homework for assigned class/subject
exports.createHomework = async (req, res) => {
    const { class_id, subject_id, title, description, due_date } = req.body;

    if (!class_id || !subject_id || !title) {
        return res.status(400).json({ error: 'Validation Error', message: 'class_id, subject_id, and title are required.' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Get teacher profile
        const teacher = await db.get('SELECT id FROM teachers WHERE user_id = ? AND school_id = ?', [req.user.id, school_id]);
        if (!teacher) return res.status(403).json({ error: 'Forbidden', message: 'Teacher profile not found.' });

        // Validate assignment
        const assignment = await db.get(
            'SELECT id FROM teacher_subject_assignments WHERE teacher_id = ? AND class_id = ? AND subject_id = ?',
            [teacher.id, class_id, subject_id]
        );
        if (!assignment) return res.status(403).json({ error: 'Forbidden', message: 'You are not assigned to this class/subject.' });

        const file_path = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await db.run(
            'INSERT INTO homework (school_id, class_id, subject_id, teacher_id, title, description, due_date, file_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [school_id, class_id, subject_id, teacher.id, title, description, due_date, file_path]
        );

        res.json({ message: 'Homework created successfully', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Teacher/SchoolAdmin: Get homework for a class
exports.getHomework = async (req, res) => {
    const { class_id } = req.query;

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        let query = `
            SELECT h.*, s.name as subject_name, c.name as class_name, t.first_name || ' ' || t.last_name as teacher_name
            FROM homework h
            JOIN subjects s ON h.subject_id = s.id
            JOIN classes c ON h.class_id = c.id
            JOIN teachers t ON h.teacher_id = t.id
            WHERE h.school_id = ?
        `;
        const params = [school_id];

        if (class_id) {
            query += ' AND h.class_id = ?';
            params.push(class_id);
        }

        query += ' ORDER BY h.due_date DESC';
        const homework = await db.all(query, params);

        res.json({ homework });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Teacher: Delete homework
exports.deleteHomework = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const result = await db.run('DELETE FROM homework WHERE id = ? AND school_id = ?', [id, school_id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Not Found' });

        res.json({ message: 'Homework deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Student: Submit homework
exports.submitHomework = async (req, res) => {
    const { homework_id, text_answer } = req.body;

    try {
        const db = getDB();

        // Verify homework exists and student is in the right class
        const hw = await db.get('SELECT class_id, school_id FROM homework WHERE id = ?', [homework_id]);
        if (!hw) return res.status(404).json({ error: 'Not Found', message: 'Homework not found.' });

        const student = await db.get('SELECT id FROM students WHERE user_id = ? AND school_id = ? AND class_id = ?',
            [req.user.id, hw.school_id, hw.class_id]);
        if (!student) return res.status(403).json({ error: 'Forbidden', message: 'You are not enrolled in this class.' });

        const file_path = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await db.run(
            'INSERT INTO homework_submissions (homework_id, student_id, text_answer, file_path) VALUES (?, ?, ?, ?)',
            [homework_id, student.id, text_answer, file_path]
        );

        res.json({ message: 'Submission received', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Teacher: Get submissions for a homework
exports.getSubmissions = async (req, res) => {
    const { homeworkId } = req.params;

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const hw = await db.get('SELECT id FROM homework WHERE id = ? AND school_id = ?', [homeworkId, school_id]);
        if (!hw) return res.status(404).json({ error: 'Not Found' });

        const submissions = await db.all(`
            SELECT hs.*, s.first_name, s.last_name, s.admission_number
            FROM homework_submissions hs
            JOIN students s ON hs.student_id = s.id
            WHERE hs.homework_id = ?
            ORDER BY s.last_name ASC
        `, [homeworkId]);

        res.json({ submissions });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
