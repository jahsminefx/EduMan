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

        // Check if student already submitted
        const existing = await db.get(
            'SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2',
            [assignment_id, student.id]
        );
        if (existing) {
            return res.status(400).json({ error: 'Already Submitted', message: 'You have already submitted this assignment.' });
        }

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
        console.error('Submit assignment error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getSubmissions = async (req, res) => {
    const { assignment_id } = req.params;

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        if (!school_id) {
            return res.status(403).json({ error: 'Forbidden', message: 'No school associated with your account.' });
        }

        // Check if user has access to this assignment (Teacher/Admin)
        const hw = await db.get('SELECT id FROM homework WHERE id = $1 AND school_id = $2', [assignment_id, school_id]);
        if (!hw) return res.status(404).json({ error: 'Not Found', message: 'Assignment not found in your school.' });

        const submissions = await db.all(`
            SELECT asub.*, s.first_name, s.last_name, s.admission_number
            FROM assignment_submissions asub
            JOIN students s ON asub.student_id = s.id
            WHERE asub.assignment_id = $1
            ORDER BY asub.submitted_at DESC
        `, [assignment_id]);

        res.json({ submissions });
    } catch (err) {
        console.error('Get submissions error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getMySubmissions = async (req, res) => {
    try {
        const db = getDB();
        const student = await db.get('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
        if (!student) return res.status(404).json({ error: 'Not Found', message: 'Student profile not found.' });

        const submissions = await db.all(`
            SELECT asub.*, h.title as assignment_title
            FROM assignment_submissions asub
            JOIN homework h ON asub.assignment_id = h.id
            WHERE asub.student_id = $1
            ORDER BY asub.submitted_at DESC
        `, [student.id]);

        res.json({ submissions });
    } catch (err) {
        console.error('Get my submissions error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Check if student has submitted a specific assignment
exports.getSubmissionStatus = async (req, res) => {
    const { assignment_id } = req.params;
    try {
        const db = getDB();
        const student = await db.get('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
        if (!student) return res.json({ submitted: false });

        const submission = await db.get(
            'SELECT id, submitted_at FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2',
            [assignment_id, student.id]
        );

        res.json({ submitted: !!submission, submission: submission || null });
    } catch (err) {
        console.error('Get submission status error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Batch check submission status for multiple assignments
exports.getSubmissionStatuses = async (req, res) => {
    const { assignment_ids } = req.query; // comma-separated
    try {
        const db = getDB();
        const student = await db.get('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
        if (!student) return res.json({ statuses: {} });

        const ids = (assignment_ids || '').split(',').filter(id => id.trim());
        if (ids.length === 0) return res.json({ statuses: {} });

        const submissions = await db.all(
            `SELECT assignment_id, id, submitted_at FROM assignment_submissions WHERE student_id = $1 AND assignment_id = ANY($2::int[])`,
            [student.id, ids.map(Number)]
        );

        const statuses = {};
        for (const sub of submissions) {
            statuses[sub.assignment_id] = true;
        }
        res.json({ statuses });
    } catch (err) {
        console.error('Get submission statuses error:', err);
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
