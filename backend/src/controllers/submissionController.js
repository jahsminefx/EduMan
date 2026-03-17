const { getDB } = require('../config/database');
const path = require('path');

exports.submitAssignment = async (req, res) => {
    const { assignment_id } = req.body; // assignment_id in request refers to homework.id in DB

    if (!assignment_id) {
        return res.status(400).json({ error: 'Validation Error', message: 'assignment_id is required.' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'Validation Error', message: 'Please upload a file.' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Verify assignment exists and student is in the right class
        const assignment = await db.get('SELECT class_id, school_id FROM homework WHERE id = $1', [assignment_id]);
        if (!assignment) return res.status(404).json({ error: 'Not Found', message: 'Assignment not found.' });

        // Get student record
        const student = await db.get('SELECT id FROM students WHERE user_id = $1 AND school_id = $2 AND class_id = $3',
            [req.user.id, assignment.school_id, assignment.class_id]);
        
        if (!student) return res.status(403).json({ error: 'Forbidden', message: 'You are not enrolled in the class for this assignment.' });

        const file_path = `/uploads/submissions/${req.file.filename}`;
        const file_type = path.extname(req.file.originalname).toLowerCase().replace('.', '');

        const result = await db.run(
            'INSERT INTO assignment_submissions (assignment_id, student_id, file_path, file_type) VALUES ($1, $2, $3, $4) RETURNING id',
            [assignment_id, student.id, file_path, file_type]
        );

        res.json({ 
            message: 'Assignment submitted successfully', 
            id: result.lastID || result.rows?.[0]?.id,
            file_path: file_path
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getSubmissions = async (req, res) => {
    const { assignment_id } = req.params;

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Check if user has access to this assignment (Teacher/Admin)
        const hw = await db.get('SELECT id FROM homework WHERE id = $1 AND school_id = $2', [assignment_id, school_id]);
        if (!hw) return res.status(404).json({ error: 'Not Found' });

        const submissions = await db.all(`
            SELECT asub.*, s.first_name, s.last_name, s.admission_number
            FROM assignment_submissions asub
            JOIN students s ON asub.student_id = s.id
            WHERE asub.assignment_id = $1
            ORDER BY asub.submitted_at DESC
        `, [assignment_id]);

        res.json({ submissions });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getMySubmissions = async (req, res) => {
    try {
        const db = getDB();
        const student = await db.get('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
        if (!student) return res.status(404).json({ error: 'Not Found' });

        const submissions = await db.all(`
            SELECT asub.*, h.title as assignment_title
            FROM assignment_submissions asub
            JOIN homework h ON asub.assignment_id = h.id
            WHERE asub.student_id = $1
            ORDER BY asub.submitted_at DESC
        `, [student.id]);

        res.json({ submissions });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
