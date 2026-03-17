const { getDB } = require('../config/database');

exports.saveGrades = async (req, res) => {
    // Expected: { term_id, class_id, subject_id, type, max_score, records: [{ student_id, score }] }
    const { term_id, class_id, subject_id, type, max_score, records } = req.body;

    if (!term_id || !class_id || !subject_id || !type || !max_score || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Missing required grade fields' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Verify class and subject belong to user's school
        const classObj = await db.get('SELECT id FROM classes WHERE id = ? AND school_id = ?', [class_id, school_id]);
        const subjectObj = await db.get('SELECT id FROM subjects WHERE id = ? AND school_id = ?', [subject_id, school_id]);
        if (!classObj || !subjectObj) {
            return res.status(403).json({ error: 'Forbidden', message: 'Class or Subject does not belong to your school.' });
        }

        // If Teacher, verify they are assigned to this class + subject
        if (req.user.role === 'Teacher') {
            const teacher = await db.get('SELECT id FROM teachers WHERE user_id = ? AND school_id = ?', [req.user.id, school_id]);
            if (!teacher) {
                return res.status(403).json({ error: 'Forbidden', message: 'Teacher profile not found.' });
            }
            const assignment = await db.get(
                'SELECT id FROM teacher_subject_assignments WHERE teacher_id = ? AND class_id = ? AND subject_id = ?',
                [teacher.id, class_id, subject_id]
            );
            if (!assignment) {
                return res.status(403).json({ error: 'Forbidden', message: 'You are not assigned to grade this class/subject combination.' });
            }
        }

        await db.run('BEGIN TRANSACTION');

        for (const record of records) {
            const existing = await db.get(
                `SELECT id FROM assessments 
                 WHERE term_id = ? AND class_id = ? AND subject_id = ? AND student_id = ? AND type = ?`,
                [term_id, class_id, subject_id, record.student_id, type]
            );

            if (existing) {
                await db.run(
                    'UPDATE assessments SET score = ?, max_score = ?, recorded_by = ? WHERE id = ?',
                    [record.score, max_score, req.user.id, existing.id]
                );
            } else {
                await db.run(
                    `INSERT INTO assessments (student_id, class_id, subject_id, term_id, type, score, max_score, recorded_by) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [record.student_id, class_id, subject_id, term_id, type, record.score, max_score, req.user.id]
                );
            }
        }

        await db.run('COMMIT');
        res.json({ message: 'Grades saved successfully' });
    } catch (err) {
        const db = getDB();
        await db.run('ROLLBACK');
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getGrades = async (req, res) => {
    const { term_id, class_id, subject_id, type } = req.query;

    if (!term_id || !class_id || !subject_id || !type) {
        return res.status(400).json({ error: 'Validation Error', message: 'Missing required query parameters' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Verify class belongs to user's school
        const classObj = await db.get('SELECT id FROM classes WHERE id = ? AND school_id = ?', [class_id, school_id]);
        if (!classObj) {
            return res.status(403).json({ error: 'Forbidden', message: 'Class does not belong to your school.' });
        }

        const records = await db.all(`
            SELECT s.id as student_id, s.first_name, s.last_name, s.admission_number, a.score, a.max_score
            FROM students s
            LEFT JOIN assessments a ON s.id = a.student_id 
                AND a.term_id = ? AND a.class_id = ? AND a.subject_id = ? AND a.type = ?
            WHERE s.class_id = ? AND s.school_id = ?
            ORDER BY s.last_name ASC
        `, [term_id, class_id, subject_id, type, class_id, school_id]);

        res.json({ records });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getStudentReport = async (req, res) => {
    const { studentId, termId } = req.params;

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Verify student belongs to user's school (or if Parent, linked via parent_student_links)
        if (req.user.role === 'Parent') {
            const link = await db.get(
                'SELECT id FROM parent_student_links WHERE parent_user_id = ? AND student_id = ?',
                [req.user.id, studentId]
            );
            if (!link) {
                return res.status(403).json({ error: 'Forbidden', message: 'This student is not linked to your account.' });
            }
        } else {
            const student = await db.get('SELECT id FROM students WHERE id = ? AND school_id = ?', [studentId, school_id]);
            if (!student) {
                return res.status(403).json({ error: 'Forbidden', message: 'Student not found in your school.' });
            }
        }

        const records = await db.all(`
            SELECT a.type, a.score, a.max_score, sub.name as subject_name
            FROM assessments a
            JOIN subjects sub ON a.subject_id = sub.id
            WHERE a.student_id = ? AND a.term_id = ?
            ORDER BY sub.name ASC
        `, [studentId, termId]);

        res.json({ report: records });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
