const { getDB } = require('../config/database');

async function verifyGradeContext(db, req, { term_id, class_id, subject_id, records = null }) {
    const school_id = req.user.school_id;

    const term = await db.get('SELECT id FROM academic_terms WHERE id = $1 AND school_id = $2', [term_id, school_id]);
    const classObj = await db.get('SELECT id FROM classes WHERE id = $1 AND school_id = $2', [class_id, school_id]);
    const subjectObj = await db.get('SELECT id FROM subjects WHERE id = $1 AND school_id = $2', [subject_id, school_id]);

    if (!term || !classObj || !subjectObj) {
        return {
            allowed: false,
            status: 403,
            message: 'Term, class, or subject does not belong to your school.'
        };
    }

    if (req.user.role === 'Teacher') {
        const teacher = await db.get('SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2', [req.user.id, school_id]);
        if (!teacher) {
            return {
                allowed: false,
                status: 403,
                message: 'Teacher profile not found.'
            };
        }

        const assignment = await db.get(`
            SELECT tsa.id
            FROM teacher_subject_assignments tsa
            JOIN classes c ON tsa.class_id = c.id
            JOIN subjects s ON tsa.subject_id = s.id
            WHERE tsa.teacher_id = $1
                AND tsa.class_id = $2
                AND tsa.subject_id = $3
                AND c.school_id = $4
                AND s.school_id = $4
        `, [teacher.id, class_id, subject_id, school_id]);

        if (!assignment) {
            return {
                allowed: false,
                status: 403,
                message: 'You are not assigned to grade this class/subject combination.'
            };
        }
    }

    if (Array.isArray(records) && records.length > 0) {
        const uniqueStudentIds = [...new Set(records.map(record => Number(record.student_id)).filter(Boolean))];
        if (uniqueStudentIds.length !== records.length) {
            return {
                allowed: false,
                status: 400,
                message: 'Every grade record must include a valid student_id.'
            };
        }

        const placeholders = uniqueStudentIds.map((_, index) => `$${index + 3}`).join(', ');
        const validStudents = await db.get(`
            SELECT COUNT(*) as count
            FROM students
            WHERE school_id = $1 AND class_id = $2 AND id IN (${placeholders})
        `, [school_id, class_id, ...uniqueStudentIds]);

        if (Number(validStudents.count) !== uniqueStudentIds.length) {
            return {
                allowed: false,
                status: 403,
                message: 'One or more students do not belong to this class in your school.'
            };
        }
    }

    return { allowed: true };
}

exports.saveGrades = async (req, res) => {
    const { term_id, class_id, subject_id, type, max_score, records } = req.body;

    if (!term_id || !class_id || !subject_id || !type || !max_score || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Missing required grade fields' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const access = await verifyGradeContext(db, req, { term_id, class_id, subject_id, records });
        if (!access.allowed) {
            return res.status(access.status).json({
                error: access.status === 400 ? 'Validation Error' : 'Forbidden',
                message: access.message
            });
        }

        await db.transaction(async (client) => {
            for (const record of records) {
                const existing = await client.get(
                    `SELECT id FROM assessments 
                     WHERE term_id = $1 AND class_id = $2 AND subject_id = $3 AND student_id = $4 AND type = $5`,
                    [term_id, class_id, subject_id, record.student_id, type]
                );

                if (existing) {
                    await client.run(
                        'UPDATE assessments SET score = $1, max_score = $2, recorded_by = $3 WHERE id = $4',
                        [record.score, max_score, req.user.id, existing.id]
                    );
                } else {
                    await client.run(
                        `INSERT INTO assessments (student_id, class_id, subject_id, term_id, type, score, max_score, recorded_by) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [record.student_id, class_id, subject_id, term_id, type, record.score, max_score, req.user.id]
                    );
                }
            }
        });

        res.json({ message: 'Grades saved successfully' });
    } catch (err) {
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

        const access = await verifyGradeContext(db, req, { term_id, class_id, subject_id });
        if (!access.allowed) {
            return res.status(access.status).json({
                error: access.status === 400 ? 'Validation Error' : 'Forbidden',
                message: access.message
            });
        }

        const records = await db.all(`
            SELECT s.id as student_id, s.first_name, s.last_name, s.admission_number, a.score, a.max_score
            FROM students s
            LEFT JOIN assessments a ON s.id = a.student_id 
                AND a.term_id = $1 AND a.class_id = $2 AND a.subject_id = $3 AND a.type = $4
            WHERE s.class_id = $5 AND s.school_id = $6
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
        let studentInfo = null;

        if (req.user.role === 'Parent') {
            const link = await db.get(
                'SELECT id FROM parent_student_links WHERE parent_user_id = $1 AND student_id = $2',
                [req.user.id, studentId]
            );
            if (!link) {
                return res.status(403).json({ error: 'Forbidden', message: 'This student is not linked to your account.' });
            }
            studentInfo = await db.get(`
                SELECT s.id, s.admission_number, s.first_name, s.last_name, s.gender, s.class_id, c.name as class_name
                FROM students s
                LEFT JOIN classes c ON s.class_id = c.id
                WHERE s.id = $1
            `, [studentId]);
        } else if (req.user.role === 'Student') {
            const student = await db.get(`
                SELECT s.id, s.admission_number, s.first_name, s.last_name, s.gender, s.class_id, c.name as class_name
                FROM students s
                LEFT JOIN classes c ON s.class_id = c.id
                WHERE s.user_id = $1 AND s.school_id = $2
            `, [req.user.id, school_id]);

            if (!student || Number(student.id) !== Number(studentId)) {
                return res.status(403).json({ error: 'Forbidden', message: 'Students can only access their own report card.' });
            }
            studentInfo = student;
        } else {
            const student = await db.get(`
                SELECT s.id, s.admission_number, s.first_name, s.last_name, s.gender, s.class_id, c.name as class_name
                FROM students s
                LEFT JOIN classes c ON s.class_id = c.id
                WHERE s.id = $1 AND s.school_id = $2
            `, [studentId, school_id]);
            if (!student) {
                return res.status(403).json({ error: 'Forbidden', message: 'Student not found in your school.' });
            }
            studentInfo = student;
        }

        const records = await db.all(`
            SELECT a.type, a.score, a.max_score, sub.name as subject_name
            FROM assessments a
            JOIN subjects sub ON a.subject_id = sub.id
            JOIN academic_terms at ON a.term_id = at.id
            WHERE a.student_id = $1 AND a.term_id = $2 AND at.school_id = $3
            ORDER BY sub.name ASC
        `, [studentId, termId, school_id]);

        res.json({ report: records, student: studentInfo });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
