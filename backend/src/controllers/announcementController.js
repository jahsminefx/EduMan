const { getDB } = require('../config/database');

const VALID_STATUSES = ['Draft', 'Published'];

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
        const requestedStatus = normalizeStatus(req.query.status);
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
    const { title, content, featured_image } = req.body;
    const status = normalizeStatus(req.body.status);

    if (!title || !title.trim() || !content || !content.trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'Title and content are required.' });
    }

    if (!status) {
        return res.status(400).json({ error: 'Validation Error', message: 'status must be Draft or Published.' });
    }

    try {
        const db = getDB();
        const result = await db.run(`
            INSERT INTO announcements (school_id, author_id, title, content, featured_image, status, published_at)
            VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 = 'Published' THEN CURRENT_TIMESTAMP ELSE NULL END)
            RETURNING id
        `, [
            req.user.school_id,
            req.user.id,
            title.trim(),
            content.trim(),
            featured_image ? featured_image.trim() : null,
            status
        ]);

        const announcement = await findScopedAnnouncement(db, result.lastID, req.user.school_id);
        res.status(201).json({ message: 'Announcement created successfully.', announcement });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.updateAnnouncement = async (req, res) => {
    const { title, content, featured_image } = req.body;
    const status = normalizeStatus(req.body.status);

    if (!title || !title.trim() || !content || !content.trim()) {
        return res.status(400).json({ error: 'Validation Error', message: 'Title and content are required.' });
    }

    if (!status) {
        return res.status(400).json({ error: 'Validation Error', message: 'status must be Draft or Published.' });
    }

    try {
        const db = getDB();
        const existing = await findScopedAnnouncement(db, req.params.id, req.user.school_id);

        if (!existing) {
            return res.status(404).json({ error: 'Not Found', message: 'Announcement not found.' });
        }

        if (!canMutateAnnouncement(req.user, existing)) {
            return res.status(403).json({ error: 'Forbidden', message: 'You can only manage announcements you authored.' });
        }

        await db.run(`
            UPDATE announcements
            SET title = $1,
                content = $2,
                featured_image = $3,
                status = $4,
                updated_at = CURRENT_TIMESTAMP,
                published_at = CASE
                    WHEN $4 = 'Published' AND published_at IS NULL THEN CURRENT_TIMESTAMP
                    WHEN $4 = 'Draft' THEN NULL
                    ELSE published_at
                END
            WHERE id = $5 AND school_id = $6
        `, [
            title.trim(),
            content.trim(),
            featured_image ? featured_image.trim() : null,
            status,
            req.params.id,
            req.user.school_id
        ]);

        const announcement = await findScopedAnnouncement(db, req.params.id, req.user.school_id);
        res.json({ message: 'Announcement updated successfully.', announcement });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
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
        res.json({ message: 'Announcement deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
