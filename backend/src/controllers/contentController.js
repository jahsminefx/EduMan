const fs = require('fs');
const path = require('path');
const { getDB } = require('../config/database');
const { ALLOWED_IMAGE_EXTENSIONS, ALLOWED_VIDEO_EXTENSIONS, browserSafeVideoUrl, deleteStoredMedia, uploadImage, uploadVideo } = require('../utils/cloudinaryImage');

const allowedContentTypes = new Set(['image', 'video', 'document', 'pdf']);
const documentExtensions = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf']);
const videoExtensions = ALLOWED_VIDEO_EXTENSIONS;
const imageExtensions = ALLOWED_IMAGE_EXTENSIONS;

function deleteUploadedFile(file) {
    if (!file?.path) return;
    fs.unlink(file.path, () => {});
}

function deleteStoredContentFile(filePath) {
    if (!filePath) return;
    const filename = path.basename(filePath);
    const absolutePath = path.join(__dirname, '../../uploads', filename);
    fs.unlink(absolutePath, err => {
        if (err && err.code !== 'ENOENT') {
            console.error('Failed to delete library file:', err.message);
        }
    });
}

function normalizeContentType(type) {
    return type === 'pdf' ? 'document' : type;
}

function withBrowserSafeVideoUrl(content) {
    if (content.type !== 'video' || !content.file_public_id) return content;
    return {
        ...content,
        file_path: browserSafeVideoUrl(content.file_public_id) || content.file_path
    };
}

function fileMatchesType(file, type) {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype || '';

    if (type === 'image') {
        return mime.startsWith('image/') && imageExtensions.has(ext);
    }

    if (type === 'video') {
        return mime.startsWith('video/') && videoExtensions.has(ext);
    }

    if (type === 'document') {
        return documentExtensions.has(ext);
    }

    return false;
}

// Upload content (ContentManager or Teacher)
exports.uploadContent = async (req, res) => {
    const { title, description, type, class_id, subject_id } = req.body;
    const normalizedType = normalizeContentType(type);
    let uploadedMedia = null;

    if (!title || !type || !req.file) {
        deleteUploadedFile(req.file);
        return res.status(400).json({ error: 'Validation Error', message: 'title, type, and a file are required.' });
    }

    if (!allowedContentTypes.has(type) || !fileMatchesType(req.file, normalizedType)) {
        deleteUploadedFile(req.file);
        return res.status(400).json({
            error: 'Validation Error',
            message: 'Upload an image, video, or document file that matches the selected content type.'
        });
    }

    try {
        const db = getDB();
        const school_id = req.user.role === 'ContentManager' ? null : req.user.school_id;
        let file_path = `/uploads/${req.file.filename}`;
        let file_public_id = null;

        if (normalizedType === 'image') {
            uploadedMedia = await uploadImage(req.file, {
                imageType: 'content',
                folder: school_id ? `schools/${school_id}/content` : 'global/content',
                context: {
                    uploaded_by: String(req.user.id),
                    content_type: 'learning_content'
                }
            });
            file_path = uploadedMedia.url;
            file_public_id = uploadedMedia.publicId;
        } else if (normalizedType === 'video') {
            uploadedMedia = await uploadVideo(req.file, {
                folder: school_id ? `schools/${school_id}/videos` : 'global/videos',
                context: {
                    uploaded_by: String(req.user.id),
                    content_type: 'learning_content_video'
                }
            });
            file_path = uploadedMedia.url;
            file_public_id = uploadedMedia.publicId;
        }

        const result = await db.run(
            'INSERT INTO learning_contents (school_id, class_id, subject_id, title, description, type, file_path, file_public_id, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [school_id, class_id || null, subject_id || null, title, description, normalizedType, file_path, file_public_id, req.user.id]
        );

        res.json({ message: 'Content uploaded successfully', id: result.lastID || result.rows?.[0]?.id });
    } catch (err) {
        if (uploadedMedia?.publicId) {
            await deleteStoredMedia({
                url: uploadedMedia.url,
                publicId: uploadedMedia.publicId,
                resourceType: uploadedMedia.resourceType
            });
        } else {
            deleteUploadedFile(req.file);
        }
        res.status(err.statusCode || 500).json({
            error: err.statusCode ? 'Validation Error' : 'Server Error',
            message: err.message
        });
    }
};

// Browse content (everyone with school scope or global)
exports.getContents = async (req, res) => {
    const { type, class_id, subject_id } = req.query;

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        let query = 'SELECT lc.*, u.name as uploader_name FROM learning_contents lc LEFT JOIN users u ON lc.uploaded_by = u.id WHERE 1=1';
        const params = [];

        // Show global content (school_id IS NULL) + school-specific content
        if (school_id) {
            query += ' AND (lc.school_id IS NULL OR lc.school_id = $1)';
            params.push(school_id);
        }

        if (type === 'document') {
            query += ` AND lc.type IN ($${params.length + 1}, $${params.length + 2})`;
            params.push('document', 'pdf');
        } else if (type) {
            query += ` AND lc.type = $${params.length + 1}`;
            params.push(type);
        }
        if (class_id) { query += ` AND lc.class_id = $${params.length + 1}`; params.push(class_id); }
        if (subject_id) { query += ` AND lc.subject_id = $${params.length + 1}`; params.push(subject_id); }

        query += ' ORDER BY lc.id DESC';
        const contents = await db.all(query, params);

        res.json({ contents: contents.map(withBrowserSafeVideoUrl) });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Delete content
exports.deleteContent = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const content = await db.get(
            'SELECT id, school_id, uploaded_by, file_path, file_public_id FROM learning_contents WHERE id = $1',
            [id]
        );
        if (!content) return res.status(404).json({ error: 'Not Found' });

        if (req.user.role === 'Teacher') {
            const ownsContent = Number(content.uploaded_by) === Number(req.user.id);
            const belongsToSchool = Number(content.school_id) === Number(school_id);
            if (!ownsContent || !belongsToSchool) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Teachers can only delete content they uploaded.'
                });
            }
        } else if (req.user.role === 'SchoolAdmin') {
            if (Number(content.school_id) !== Number(school_id)) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'You can only delete content from your school.'
                });
            }
        }

        await db.run('DELETE FROM learning_contents WHERE id = $1', [id]);
        if (content.file_public_id) {
            await deleteStoredMedia({
                url: content.file_path,
                publicId: content.file_public_id
            });
        } else {
            deleteStoredContentFile(content.file_path);
        }
        res.json({ message: 'Content deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
