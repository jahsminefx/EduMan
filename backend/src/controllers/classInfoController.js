const { getDB } = require('../config/database');

const VALID_DAYS = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

function cleanString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function cleanId(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
}

function isValidTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(cleanString(value));
}

async function getTeacherProfile(db, req) {
    return db.get(
        'SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2',
        [req.user.id, req.user.school_id]
    );
}

async function getScopedClass(db, req, classId) {
    const classRecord = await db.get(`
        SELECT
            c.*,
            t.id as form_teacher_id,
            t.first_name || ' ' || t.last_name as form_teacher_name,
            t.phone as form_teacher_phone,
            u.email as form_teacher_email
        FROM classes c
        LEFT JOIN teachers t ON c.form_teacher_id = t.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE c.id = $1 AND c.school_id = $2
    `, [classId, req.user.school_id]);

    if (!classRecord) {
        return { allowed: false, status: 404, message: 'Class not found in your school.' };
    }

    if (req.user.role === 'SchoolAdmin') {
        return { allowed: true, classRecord };
    }

    if (req.user.role !== 'Teacher') {
        return { allowed: false, status: 403, message: 'Only School Admins and Form Teachers can manage class information.' };
    }

    const teacher = await getTeacherProfile(db, req);
    if (!teacher) {
        return { allowed: false, status: 403, message: 'Teacher profile not found.' };
    }

    if (Number(classRecord.form_teacher_id) !== Number(teacher.id)) {
        return { allowed: false, status: 403, message: 'You can only manage classes where you are the assigned Form Teacher.' };
    }

    return { allowed: true, classRecord, teacher };
}

async function getSchoolAcademic(db, schoolId) {
    return db.get(`
        SELECT
            s.id,
            s.name,
            s.current_session_id,
            s.current_term_id,
            acs.name as current_session_name,
            at.name as current_term_name
        FROM schools s
        LEFT JOIN academic_sessions acs ON s.current_session_id = acs.id
        LEFT JOIN academic_terms at ON s.current_term_id = at.id
        WHERE s.id = $1
    `, [schoolId]);
}

async function buildClassInfo(db, schoolId, classRecord) {
    const [timetable, announcements, events, school] = await Promise.all([
        db.all(`
            SELECT *
            FROM timetables
            WHERE school_id = $1 AND class_id = $2
            ORDER BY
                CASE day_of_week
                    WHEN 'Monday' THEN 1
                    WHEN 'Tuesday' THEN 2
                    WHEN 'Wednesday' THEN 3
                    WHEN 'Thursday' THEN 4
                    WHEN 'Friday' THEN 5
                    WHEN 'Saturday' THEN 6
                    WHEN 'Sunday' THEN 7
                    ELSE 8
                END,
                start_time ASC
        `, [schoolId, classRecord.id]),
        db.all(`
            SELECT ca.*, u.name as author_name
            FROM class_announcements ca
            LEFT JOIN users u ON ca.created_by = u.id
            WHERE ca.school_id = $1 AND ca.class_id = $2
            ORDER BY ca.created_at DESC
        `, [schoolId, classRecord.id]),
        db.all(`
            SELECT ce.*, u.name as author_name
            FROM class_events ce
            LEFT JOIN users u ON ce.created_by = u.id
            WHERE ce.school_id = $1 AND ce.class_id = $2
            ORDER BY ce.event_date ASC, ce.created_at DESC
        `, [schoolId, classRecord.id]),
        getSchoolAcademic(db, schoolId)
    ]);

    return {
        class: classRecord,
        school,
        timetable,
        announcements,
        events
    };
}

exports.getFormTeacherClasses = async (req, res) => {
    try {
        const db = getDB();
        const teacher = await getTeacherProfile(db, req);
        if (!teacher) {
            return res.status(404).json({ error: 'Not Found', message: 'Teacher profile not found.' });
        }

        const classes = await db.all(`
            SELECT id, name, level, form_teacher_id
            FROM classes
            WHERE school_id = $1 AND form_teacher_id = $2
            ORDER BY level ASC, name ASC
        `, [req.user.school_id, teacher.id]);

        res.json({ classes });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getClassInfo = async (req, res) => {
    const classId = cleanId(req.params.classId);
    if (!classId) {
        return res.status(400).json({ error: 'Validation Error', message: 'A valid class is required.' });
    }

    try {
        const db = getDB();
        const access = await getScopedClass(db, req, classId);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.status === 404 ? 'Not Found' : 'Forbidden', message: access.message });
        }

        const payload = await buildClassInfo(db, req.user.school_id, access.classRecord);
        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getMyClassInfo = async (req, res) => {
    try {
        const db = getDB();
        const student = await db.get(`
            SELECT s.id, s.class_id, c.name as class_name, c.level as class_level
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.user_id = $1 AND s.school_id = $2
        `, [req.user.id, req.user.school_id]);

        if (!student || !student.class_id) {
            return res.status(404).json({ error: 'Not Found', message: 'Student class information was not found.' });
        }

        const classRecord = await db.get(`
            SELECT
                c.*,
                t.id as form_teacher_id,
                t.first_name || ' ' || t.last_name as form_teacher_name,
                t.phone as form_teacher_phone,
                u.email as form_teacher_email
            FROM classes c
            LEFT JOIN teachers t ON c.form_teacher_id = t.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE c.id = $1 AND c.school_id = $2
        `, [student.class_id, req.user.school_id]);

        if (!classRecord) {
            return res.status(404).json({ error: 'Not Found', message: 'Class not found.' });
        }

        const payload = await buildClassInfo(db, req.user.school_id, classRecord);
        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createTimetableEntry = async (req, res) => {
    const classId = cleanId(req.body.class_id);
    const day = cleanString(req.body.day_of_week);
    const startTime = cleanString(req.body.start_time);
    const endTime = cleanString(req.body.end_time);
    const subject = cleanString(req.body.subject);

    if (!classId || !VALID_DAYS.has(day) || !isValidTime(startTime) || !isValidTime(endTime) || !subject) {
        return res.status(400).json({
            error: 'Validation Error',
            message: 'Class, day, start time, end time, and subject are required.'
        });
    }

    try {
        const db = getDB();
        const access = await getScopedClass(db, req, classId);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.status === 404 ? 'Not Found' : 'Forbidden', message: access.message });
        }

        const result = await db.run(`
            INSERT INTO timetables (school_id, class_id, day_of_week, start_time, end_time, subject, room, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `, [
            req.user.school_id,
            classId,
            day,
            startTime,
            endTime,
            subject,
            cleanString(req.body.room) || null,
            cleanString(req.body.notes) || null,
            req.user.id
        ]);

        res.json({ message: 'Timetable entry added successfully.', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.updateTimetableEntry = async (req, res) => {
    const id = cleanId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Validation Error', message: 'A valid timetable entry is required.' });

    try {
        const db = getDB();
        const entry = await db.get('SELECT * FROM timetables WHERE id = $1 AND school_id = $2', [id, req.user.school_id]);
        if (!entry) return res.status(404).json({ error: 'Not Found', message: 'Timetable entry not found.' });

        const access = await getScopedClass(db, req, entry.class_id);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.status === 404 ? 'Not Found' : 'Forbidden', message: access.message });
        }

        const day = cleanString(req.body.day_of_week);
        const startTime = cleanString(req.body.start_time);
        const endTime = cleanString(req.body.end_time);
        const subject = cleanString(req.body.subject);
        if (!VALID_DAYS.has(day) || !isValidTime(startTime) || !isValidTime(endTime) || !subject) {
            return res.status(400).json({ error: 'Validation Error', message: 'Day, start time, end time, and subject are required.' });
        }

        await db.run(`
            UPDATE timetables
            SET day_of_week = $1, start_time = $2, end_time = $3, subject = $4, room = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7 AND school_id = $8
        `, [day, startTime, endTime, subject, cleanString(req.body.room) || null, cleanString(req.body.notes) || null, id, req.user.school_id]);

        res.json({ message: 'Timetable entry updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.deleteTimetableEntry = async (req, res) => {
    const id = cleanId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Validation Error', message: 'A valid timetable entry is required.' });

    try {
        const db = getDB();
        const entry = await db.get('SELECT * FROM timetables WHERE id = $1 AND school_id = $2', [id, req.user.school_id]);
        if (!entry) return res.status(404).json({ error: 'Not Found', message: 'Timetable entry not found.' });

        const access = await getScopedClass(db, req, entry.class_id);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.status === 404 ? 'Not Found' : 'Forbidden', message: access.message });
        }

        await db.run('DELETE FROM timetables WHERE id = $1 AND school_id = $2', [id, req.user.school_id]);
        res.json({ message: 'Timetable entry deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createAnnouncement = async (req, res) => {
    const classId = cleanId(req.body.class_id);
    const title = cleanString(req.body.title);
    const message = cleanString(req.body.message);

    if (!classId || !title || !message) {
        return res.status(400).json({ error: 'Validation Error', message: 'Class, title, and message are required.' });
    }

    try {
        const db = getDB();
        const access = await getScopedClass(db, req, classId);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.status === 404 ? 'Not Found' : 'Forbidden', message: access.message });
        }

        const result = await db.run(`
            INSERT INTO class_announcements (school_id, class_id, title, message, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [req.user.school_id, classId, title, message, req.user.id]);

        res.json({ message: 'Class announcement posted successfully.', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.deleteAnnouncement = async (req, res) => {
    const id = cleanId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Validation Error', message: 'A valid announcement is required.' });

    try {
        const db = getDB();
        const item = await db.get('SELECT * FROM class_announcements WHERE id = $1 AND school_id = $2', [id, req.user.school_id]);
        if (!item) return res.status(404).json({ error: 'Not Found', message: 'Announcement not found.' });

        const access = await getScopedClass(db, req, item.class_id);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.status === 404 ? 'Not Found' : 'Forbidden', message: access.message });
        }

        await db.run('DELETE FROM class_announcements WHERE id = $1 AND school_id = $2', [id, req.user.school_id]);
        res.json({ message: 'Class announcement deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createEvent = async (req, res) => {
    const classId = cleanId(req.body.class_id);
    const title = cleanString(req.body.title);
    const eventDate = cleanString(req.body.event_date);

    if (!classId || !title || !eventDate) {
        return res.status(400).json({ error: 'Validation Error', message: 'Class, title, and date are required.' });
    }

    try {
        const db = getDB();
        const access = await getScopedClass(db, req, classId);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.status === 404 ? 'Not Found' : 'Forbidden', message: access.message });
        }

        const result = await db.run(`
            INSERT INTO class_events (school_id, class_id, title, event_date, description, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [req.user.school_id, classId, title, eventDate, cleanString(req.body.description) || null, req.user.id]);

        res.json({ message: 'Class event added successfully.', id: result.lastID });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.deleteEvent = async (req, res) => {
    const id = cleanId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Validation Error', message: 'A valid class event is required.' });

    try {
        const db = getDB();
        const item = await db.get('SELECT * FROM class_events WHERE id = $1 AND school_id = $2', [id, req.user.school_id]);
        if (!item) return res.status(404).json({ error: 'Not Found', message: 'Class event not found.' });

        const access = await getScopedClass(db, req, item.class_id);
        if (!access.allowed) {
            return res.status(access.status).json({ error: access.status === 404 ? 'Not Found' : 'Forbidden', message: access.message });
        }

        await db.run('DELETE FROM class_events WHERE id = $1 AND school_id = $2', [id, req.user.school_id]);
        res.json({ message: 'Class event deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
