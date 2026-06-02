const { getDB } = require('../config/database');

function normalizeAttendanceStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'present') return 'Present';
    if (value === 'absent') return 'Absent';
    return null;
}

exports.markAttendance = async (req, res) => {
    const { class_id, date, records } = req.body;

    if (!class_id || !date || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Validation Error', message: 'class_id, date, and records array are required.' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Verify that the class belongs to this school
        const classObj = await db.get('SELECT id, form_teacher_id FROM classes WHERE id = $1 AND school_id = $2', [class_id, school_id]);
        if (!classObj) {
            return res.status(403).json({ error: 'Forbidden', message: 'This class does not belong to your school.' });
        }

        // If the user is a Teacher, verify they are the Form Teacher for this class
        if (req.user.role === 'Teacher') {
            const teacher = await db.get('SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2', [req.user.id, school_id]);
            if (!teacher) {
                return res.status(403).json({ error: 'Forbidden', message: 'Teacher profile not found.' });
            }
            if (classObj.form_teacher_id !== teacher.id) {
                return res.status(403).json({ error: 'Forbidden', message: 'Only the Form Teacher of this class can record attendance.' });
            }
        }

        const normalizedRecords = records.map(record => ({
            student_id: Number(record.student_id),
            status: normalizeAttendanceStatus(record.status)
        }));

        if (normalizedRecords.some(record => !record.student_id || !record.status)) {
            return res.status(400).json({ error: 'Validation Error', message: 'Each attendance record must include a valid student_id and present/absent status.' });
        }

        if (normalizedRecords.length > 0) {
            const uniqueStudentIds = [...new Set(normalizedRecords.map(record => record.student_id))];
            const placeholders = uniqueStudentIds.map((_, index) => `$${index + 3}`).join(', ');
            const validStudents = await db.get(`
                SELECT COUNT(*) as count
                FROM students
                WHERE school_id = $1 AND class_id = $2 AND id IN (${placeholders})
            `, [school_id, class_id, ...uniqueStudentIds]);

            if (Number(validStudents.count) !== uniqueStudentIds.length) {
                return res.status(403).json({ error: 'Forbidden', message: 'One or more students do not belong to this class in your school.' });
            }
        }

        await db.transaction(async (client) => {
            for (const record of normalizedRecords) {
                const existing = await client.get(
                    'SELECT id FROM attendance_records WHERE student_id = $1 AND date = $2 AND class_id = $3',
                    [record.student_id, date, class_id]
                );

                if (existing) {
                    await client.run(
                        'UPDATE attendance_records SET status = $1, recorded_by = $2 WHERE id = $3',
                        [record.status, req.user.id, existing.id]
                    );
                } else {
                    await client.run(
                        'INSERT INTO attendance_records (student_id, class_id, date, status, recorded_by) VALUES ($1, $2, $3, $4, $5)',
                        [record.student_id, class_id, date, record.status, req.user.id]
                    );
                }
            }
        });

        res.json({ message: 'Attendance recorded successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getAttendance = async (req, res) => {
    const { class_id, date } = req.query;

    if (!class_id || !date) {
        return res.status(400).json({ error: 'Validation Error', message: 'class_id and date are required query parameters.' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const classObj = await db.get('SELECT id FROM classes WHERE id = $1 AND school_id = $2', [class_id, school_id]);
        if (!classObj) {
            return res.status(403).json({ error: 'Forbidden', message: 'This class does not belong to your school.' });
        }

        if (req.user.role === 'Teacher') {
            const teacher = await db.get('SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2', [req.user.id, school_id]);
            const classAccess = teacher
                ? await db.get('SELECT id FROM classes WHERE id = $1 AND school_id = $2 AND form_teacher_id = $3', [class_id, school_id, teacher.id])
                : null;

            if (!classAccess) {
                return res.status(403).json({ error: 'Forbidden', message: 'Only the Form Teacher of this class can view attendance.' });
            }
        }

        const records = await db.all(`
            SELECT s.id as student_id, s.first_name, s.last_name, s.admission_number, LOWER(a.status) as status, a.id as attendance_id
            FROM students s
            LEFT JOIN attendance_records a ON s.id = a.student_id AND a.date = $1 AND a.class_id = $2
            WHERE s.class_id = $3 AND s.school_id = $4
            ORDER BY s.last_name ASC
        `, [date, class_id, class_id, school_id]);

        res.json({ records });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getStudentAttendanceSummary = async (req, res) => {
    const { studentId } = req.params;

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const student = await db.get('SELECT id FROM students WHERE id = $1 AND school_id = $2', [studentId, school_id]);
        if (!student) {
            return res.status(403).json({ error: 'Forbidden', message: 'Student not found in your school.' });
        }

        const records = await db.all(`
            SELECT LOWER(status) as status, COUNT(*) as count
            FROM attendance_records 
            WHERE student_id = $1 
            GROUP BY LOWER(status)
        `, [studentId]);

        res.json({ summary: records });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
