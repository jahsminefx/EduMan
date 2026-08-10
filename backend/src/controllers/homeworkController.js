const { getDB } = require('../config/database');
const path = require('path');
const { browserSafeVideoUrl, deleteStoredMedia, deleteTempFile, uploadImage, uploadVideo } = require('../utils/cloudinaryImage');

const videoExtensions = new Set(['.mp4', '.mov', '.webm', '.m4v']);

function localUploadPath(file) {
    return file ? `/uploads/${file.filename}` : null;
}

async function storeHomeworkFile(file, req, folder) {
    if (!file) return { filePath: null, filePublicId: null };

    if (file.mimetype?.startsWith('image/')) {
        const image = await uploadImage(file, {
            imageType: 'content',
            folder,
            context: {
                school_id: String(req.user.school_id),
                uploaded_by: String(req.user.id),
                upload_type: 'homework'
            }
        });

        return {
            filePath: image.url,
            filePublicId: image.publicId
        };
    }

    if (file.mimetype?.startsWith('video/')) {
        const video = await uploadVideo(file, {
            folder,
            context: {
                school_id: String(req.user.school_id),
                uploaded_by: String(req.user.id),
                upload_type: 'homework_video'
            }
        });

        return {
            filePath: video.url,
            filePublicId: video.publicId,
            resourceType: video.resourceType
        };
    }

    return {
        filePath: localUploadPath(file),
        filePublicId: null
    };
}

function looksLikeCloudinaryVideo(row) {
    if (!row?.file_public_id || !row?.file_path) return false;
    if (String(row.file_path).includes('/video/upload/')) return true;

    const ext = path.extname(String(row.file_path).split('?')[0]).toLowerCase();
    return videoExtensions.has(ext);
}

function withBrowserSafeVideoUrl(row) {
    if (!looksLikeCloudinaryVideo(row)) return row;
    return {
        ...row,
        file_path: browserSafeVideoUrl(row.file_public_id) || row.file_path
    };
}

// Teacher: Create homework for assigned class/subject
exports.createHomework = async (req, res) => {
    const { class_id, subject_id, title, description, due_date } = req.body;
    let storedFile = { filePath: null, filePublicId: null };

    if (!class_id || !subject_id || !title) {
        deleteTempFile(req.file);
        return res.status(400).json({ error: 'Validation Error', message: 'class_id, subject_id, and title are required.' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Get teacher profile
        const teacher = await db.get('SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2', [req.user.id, school_id]);
        if (!teacher) return res.status(403).json({ error: 'Forbidden', message: 'Teacher profile not found.' });

        // Validate assignment
        const assignment = await db.get(
            'SELECT id FROM teacher_subject_assignments WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3',
            [teacher.id, class_id, subject_id]
        );
        if (!assignment) return res.status(403).json({ error: 'Forbidden', message: 'You are not assigned to this class/subject.' });

        storedFile = await storeHomeworkFile(req.file, req, `schools/${school_id}/homework`);

        const result = await db.run(
            'INSERT INTO homework (school_id, class_id, subject_id, teacher_id, title, description, due_date, file_path, file_public_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [school_id, class_id, subject_id, teacher.id, title, description, due_date, storedFile.filePath, storedFile.filePublicId]
        );

        res.json({ message: 'Homework created successfully', id: result.lastID || result.rows?.[0]?.id });
    } catch (err) {
        await deleteStoredMedia({
            url: storedFile.filePath,
            publicId: storedFile.filePublicId,
            resourceType: storedFile.resourceType
        });
        deleteTempFile(req.file);
        res.status(err.statusCode || 500).json({
            error: err.statusCode ? 'Validation Error' : 'Server Error',
            message: err.message
        });
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
            WHERE h.school_id = $1
        `;
        const params = [school_id];

        if (class_id) {
            query += ' AND h.class_id = $2';
            params.push(class_id);
        }

        query += ' ORDER BY h.due_date DESC';
        const homework = await db.all(query, params);

        res.json({ homework: homework.map(withBrowserSafeVideoUrl) });
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

        const result = await db.run('DELETE FROM homework WHERE id = $1 AND school_id = $2', [id, school_id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Not Found' });

        res.json({ message: 'Homework deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Student: Submit homework
exports.submitHomework = async (req, res) => {
    const { homework_id, text_answer } = req.body;
    let storedFile = { filePath: null, filePublicId: null };

    try {
        const db = getDB();

        // Verify homework exists and student is in the right class
        const hw = await db.get('SELECT class_id, school_id FROM homework WHERE id = $1', [homework_id]);
        if (!hw) return res.status(404).json({ error: 'Not Found', message: 'Homework not found.' });

        const student = await db.get('SELECT id FROM students WHERE user_id = $1 AND school_id = $2 AND class_id = $3',
            [req.user.id, hw.school_id, hw.class_id]);
        if (!student) return res.status(403).json({ error: 'Forbidden', message: 'You are not enrolled in this class.' });

        storedFile = await storeHomeworkFile(req.file, req, `schools/${hw.school_id}/homework-submissions`);

        const result = await db.run(
            'INSERT INTO homework_submissions (homework_id, student_id, text_answer, file_path, file_public_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [homework_id, student.id, text_answer, storedFile.filePath, storedFile.filePublicId]
        );

        res.json({ message: 'Submission received', id: result.lastID || result.rows?.[0]?.id });
    } catch (err) {
        await deleteStoredMedia({
            url: storedFile.filePath,
            publicId: storedFile.filePublicId,
            resourceType: storedFile.resourceType
        });
        deleteTempFile(req.file);
        res.status(err.statusCode || 500).json({
            error: err.statusCode ? 'Validation Error' : 'Server Error',
            message: err.message
        });
    }
};

// Teacher: Get submissions for a homework
exports.getSubmissions = async (req, res) => {
    const { homeworkId } = req.params;

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const hw = await db.get('SELECT id FROM homework WHERE id = $1 AND school_id = $2', [homeworkId, school_id]);
        if (!hw) return res.status(404).json({ error: 'Not Found' });

        const submissions = await db.all(`
            SELECT hs.*, s.first_name, s.last_name, s.admission_number
            FROM homework_submissions hs
            JOIN students s ON hs.student_id = s.id
            WHERE hs.homework_id = $1
            ORDER BY s.last_name ASC
        `, [homeworkId]);

        res.json({ submissions: submissions.map(withBrowserSafeVideoUrl) });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
