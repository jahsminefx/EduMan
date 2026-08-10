const { getDB } = require('../config/database');
const { deleteStoredMedia, deleteTempFiles, uploadImage } = require('../utils/cloudinaryImage');

const VALID_STATUSES = ['Draft', 'Published'];

function cleanString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function uploadedPath(file) {
    return file ? `/uploads/${file.filename}` : null;
}

function allUploadedFiles(req) {
    return Object.values(req.files || {}).flat().filter(Boolean);
}

function cleanupRequestUploads(req) {
    deleteTempFiles(allUploadedFiles(req));
}

function getUploadedFile(req, fieldName) {
    return req.files?.[fieldName]?.[0] || null;
}

function attachmentType(file) {
    if (!file) return null;
    return file.mimetype?.startsWith('image/') ? 'image' : 'document';
}

function emptyAttachment() {
    return {
        attachment_path: null,
        attachment_public_id: null,
        attachment_name: null,
        attachment_type: null,
        attachment_mime: null
    };
}

async function buildAttachment(file, req) {
    if (!file) return emptyAttachment();

    if (file.mimetype?.startsWith('image/')) {
        const image = await uploadImage(file, {
            imageType: 'blog',
            folder: `schools/${req.user.school_id}/announcements/attachments`,
            context: {
                school_id: String(req.user.school_id),
                uploaded_by: String(req.user.id),
                upload_type: 'announcement_attachment'
            }
        });

        return {
            attachment_path: image.url,
            attachment_public_id: image.publicId,
            attachment_name: file.originalname,
            attachment_type: 'image',
            attachment_mime: file.mimetype || null
        };
    }

    return {
        attachment_path: uploadedPath(file),
        attachment_public_id: null,
        attachment_name: file.originalname,
        attachment_type: attachmentType(file),
        attachment_mime: file.mimetype || null
    };
}

function buildFeaturedImage(file, req) {
    if (!file) return null;

    return uploadImage(file, {
        imageType: 'blog',
        folder: `schools/${req.user.school_id}/announcements/featured`,
        context: {
            school_id: String(req.user.school_id),
            uploaded_by: String(req.user.id),
            upload_type: 'announcement_featured_image'
        }
    });
}

function mediaReference(url, publicId) {
    if (!url && !publicId) return null;
    return { url, publicId };
}

async function deleteMediaList(mediaList) {
    const seen = new Set();
    for (const media of mediaList.filter(Boolean)) {
        const key = `${media.publicId || ''}:${media.url || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await deleteStoredMedia(media);
    }
}

function normalizeStatus(status) {
    if (!status) return 'Draft';
    const match = VALID_STATUSES.find(value => value.toLowerCase() === String(status).toLowerCase());
    return match || null;
}

function buildAnnouncementResponse(row) {
    return {
        ...row,
        can_edit: row.can_edit === true || row.can_edit === 1 || row.can_edit === '1'
    };
}

async function findScopedAnnouncement(db, id, school_id) {
    return db.get(`
        SELECT a.*, u.name as author_name, u.role as author_role
        FROM announcements a
        JOIN users u ON a.author_id = u.id
        WHERE a.id = $1 AND a.school_id = $2
    `, [id, school_id]);
}

function canReadAnnouncement(user, announcement) {
    if (user.role === 'SchoolAdmin') return true;
    if (user.role === 'Teacher') {
        return announcement.status === 'Published' || announcement.author_id === user.id;
    }
    return announcement.status === 'Published';
}

function canMutateAnnouncement(user, announcement) {
    if (user.role === 'SchoolAdmin') return true;
    if (user.role === 'Teacher') return announcement.author_id === user.id;
    return false;
}

exports.listAnnouncements = async (req, res) => {
    try {
        const db = getDB();
        const { role, school_id, id: user_id } = req.user;
        const requestedStatus = req.query.status ? normalizeStatus(req.query.status) : null;
        const mineOnly = req.query.mine === 'true';

        if (req.query.status && !requestedStatus) {
            return res.status(400).json({ error: 'Validation Error', message: 'status must be Draft or Published.' });
        }

        const conditions = ['a.school_id = $1'];
        const params = [school_id];

        if (role === 'SchoolAdmin') {
            if (requestedStatus) {
                params.push(requestedStatus);
                conditions.push(`a.status = $${params.length}`);
            }
        } else if (role === 'Teacher') {
            if (mineOnly) {
                params.push(user_id);
                conditions.push(`a.author_id = $${params.length}`);
            } else if (requestedStatus) {
                params.push(requestedStatus);
                conditions.push(`a.status = $${params.length}`);
                if (requestedStatus === 'Draft') {
                    params.push(user_id);
                    conditions.push(`a.author_id = $${params.length}`);
                }
            } else {
                params.push(user_id);
                conditions.push(`(a.status = 'Published' OR a.author_id = $${params.length})`);
            }
        } else {
            conditions.push("a.status = 'Published'");
        }

        const announcements = await db.all(`
            SELECT a.*, u.name as author_name, u.role as author_role,
                CASE
                    WHEN $${params.length + 1} = 'SchoolAdmin' THEN 1
                    WHEN $${params.length + 1} = 'Teacher' AND a.author_id = $${params.length + 2} THEN 1
                    ELSE 0
                END as can_edit
            FROM announcements a
            JOIN users u ON a.author_id = u.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY COALESCE(a.published_at, a.updated_at, a.created_at) DESC
        `, [...params, role, user_id]);

        res.json({ announcements: announcements.map(buildAnnouncementResponse) });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.getAnnouncement = async (req, res) => {
    try {
        const db = getDB();
        const announcement = await findScopedAnnouncement(db, req.params.id, req.user.school_id);

        if (!announcement) {
            return res.status(404).json({ error: 'Not Found', message: 'Announcement not found.' });
        }

        if (!canReadAnnouncement(req.user, announcement)) {
            return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this announcement.' });
        }

        res.json({
            announcement: buildAnnouncementResponse({
                ...announcement,
                can_edit: canMutateAnnouncement(req.user, announcement)
            })
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.createAnnouncement = async (req, res) => {
    const { title, content } = req.body;
    const status = normalizeStatus(req.body.status);
    const featuredImageFile = getUploadedFile(req, 'featured_image_file');
    const attachmentFile = getUploadedFile(req, 'attachment_file');
    let featuredUpload = null;
    let attachment = emptyAttachment();

    if (!title || !cleanString(title) || !content || !cleanString(content)) {
        cleanupRequestUploads(req);
        return res.status(400).json({ error: 'Validation Error', message: 'Title and content are required.' });
    }

    if (!status) {
        cleanupRequestUploads(req);
        return res.status(400).json({ error: 'Validation Error', message: 'status must be Draft or Published.' });
    }

    try {
        const db = getDB();
        featuredUpload = await buildFeaturedImage(featuredImageFile, req);
        const featuredImage = featuredUpload?.url || cleanString(req.body.featured_image) || null;
        const featuredImagePublicId = featuredUpload?.publicId || null;
        attachment = await buildAttachment(attachmentFile, req);
        const publishedAt = status === 'Published' ? new Date() : null;
        const result = await db.run(`
            INSERT INTO announcements (
                school_id,
                author_id,
                title,
                content,
                featured_image,
                featured_image_public_id,
                attachment_path,
                attachment_public_id,
                attachment_name,
                attachment_type,
                attachment_mime,
                status,
                published_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
        `, [
            req.user.school_id,
            req.user.id,
            cleanString(title),
            cleanString(content),
            featuredImage,
            featuredImagePublicId,
            attachment.attachment_path,
            attachment.attachment_public_id,
            attachment.attachment_name,
            attachment.attachment_type,
            attachment.attachment_mime,
            status,
            publishedAt
        ]);

        const announcement = await findScopedAnnouncement(db, result.lastID, req.user.school_id);
        res.status(201).json({ message: 'Announcement created successfully.', announcement });
    } catch (err) {
        await deleteMediaList([
            mediaReference(featuredUpload?.url, featuredUpload?.publicId),
            mediaReference(attachment.attachment_path, attachment.attachment_public_id)
        ]);
        cleanupRequestUploads(req);
        res.status(err.statusCode || 500).json({
            error: err.statusCode ? 'Validation Error' : 'Server Error',
            message: err.message
        });
    }
};

exports.updateAnnouncement = async (req, res) => {
    const { title, content } = req.body;
    const status = normalizeStatus(req.body.status);
    const featuredImageFile = getUploadedFile(req, 'featured_image_file');
    const attachmentFile = getUploadedFile(req, 'attachment_file');
    let attachment = null;
    const newMediaToDeleteOnFailure = [];

    if (!title || !cleanString(title) || !content || !cleanString(content)) {
        cleanupRequestUploads(req);
        return res.status(400).json({ error: 'Validation Error', message: 'Title and content are required.' });
    }

    if (!status) {
        cleanupRequestUploads(req);
        return res.status(400).json({ error: 'Validation Error', message: 'status must be Draft or Published.' });
    }

    try {
        const db = getDB();
        const existing = await findScopedAnnouncement(db, req.params.id, req.user.school_id);

        if (!existing) {
            cleanupRequestUploads(req);
            return res.status(404).json({ error: 'Not Found', message: 'Announcement not found.' });
        }

        if (!canMutateAnnouncement(req.user, existing)) {
            cleanupRequestUploads(req);
            return res.status(403).json({ error: 'Forbidden', message: 'You can only manage announcements you authored.' });
        }

        const oldMediaToDelete = [];
        const removeFeaturedImage = req.body.remove_featured_image === 'true';
        let featuredImage = existing.featured_image;
        let featuredImagePublicId = existing.featured_image_public_id;

        if (featuredImageFile) {
            const featuredUpload = await buildFeaturedImage(featuredImageFile, req);
            featuredImage = featuredUpload.url;
            featuredImagePublicId = featuredUpload.publicId;
            newMediaToDeleteOnFailure.push(mediaReference(featuredUpload.url, featuredUpload.publicId));
            oldMediaToDelete.push(mediaReference(existing.featured_image, existing.featured_image_public_id));
        } else if (removeFeaturedImage) {
            featuredImage = null;
            featuredImagePublicId = null;
            oldMediaToDelete.push(mediaReference(existing.featured_image, existing.featured_image_public_id));
        } else if (cleanString(req.body.featured_image) && cleanString(req.body.featured_image) !== existing.featured_image) {
            featuredImage = cleanString(req.body.featured_image);
            featuredImagePublicId = null;
            oldMediaToDelete.push(mediaReference(existing.featured_image, existing.featured_image_public_id));
        }

        const removeAttachment = req.body.remove_attachment === 'true';
        if (attachmentFile) {
            attachment = await buildAttachment(attachmentFile, req);
            newMediaToDeleteOnFailure.push(mediaReference(attachment.attachment_path, attachment.attachment_public_id));
            oldMediaToDelete.push(mediaReference(existing.attachment_path, existing.attachment_public_id));
        } else {
            attachment = {
                attachment_path: removeAttachment ? null : existing.attachment_path,
                attachment_public_id: removeAttachment ? null : existing.attachment_public_id,
                attachment_name: removeAttachment ? null : existing.attachment_name,
                attachment_type: removeAttachment ? null : existing.attachment_type,
                attachment_mime: removeAttachment ? null : existing.attachment_mime
            };

            if (removeAttachment) {
                oldMediaToDelete.push(mediaReference(existing.attachment_path, existing.attachment_public_id));
            }
        }

        const publishedAt = status === 'Published'
            ? (existing.published_at || new Date())
            : null;

        await db.run(`
            UPDATE announcements
            SET title = $1,
                content = $2,
                featured_image = $3,
                featured_image_public_id = $4,
                attachment_path = $5,
                attachment_public_id = $6,
                attachment_name = $7,
                attachment_type = $8,
                attachment_mime = $9,
                status = $10,
                updated_at = CURRENT_TIMESTAMP,
                published_at = $11
            WHERE id = $12 AND school_id = $13
        `, [
            cleanString(title),
            cleanString(content),
            featuredImage,
            featuredImagePublicId,
            attachment.attachment_path,
            attachment.attachment_public_id,
            attachment.attachment_name,
            attachment.attachment_type,
            attachment.attachment_mime,
            status,
            publishedAt,
            req.params.id,
            req.user.school_id
        ]);

        await deleteMediaList(oldMediaToDelete);
        const announcement = await findScopedAnnouncement(db, req.params.id, req.user.school_id);
        res.json({ message: 'Announcement updated successfully.', announcement });
    } catch (err) {
        await deleteMediaList(newMediaToDeleteOnFailure);
        cleanupRequestUploads(req);
        res.status(err.statusCode || 500).json({
            error: err.statusCode ? 'Validation Error' : 'Server Error',
            message: err.message
        });
    }
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        const db = getDB();
        const existing = await findScopedAnnouncement(db, req.params.id, req.user.school_id);

        if (!existing) {
            return res.status(404).json({ error: 'Not Found', message: 'Announcement not found.' });
        }

        if (!canMutateAnnouncement(req.user, existing)) {
            return res.status(403).json({ error: 'Forbidden', message: 'You can only delete announcements you authored.' });
        }

        await db.run('DELETE FROM announcements WHERE id = $1 AND school_id = $2', [req.params.id, req.user.school_id]);
        await deleteMediaList([
            mediaReference(existing.featured_image, existing.featured_image_public_id),
            mediaReference(existing.attachment_path, existing.attachment_public_id)
        ]);
        res.json({ message: 'Announcement deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
