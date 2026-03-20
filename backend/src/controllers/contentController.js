const { getDB } = require('../config/database');

// Upload content (ContentManager or Teacher)
exports.uploadContent = async (req, res) => {
    const { title, description, type, class_id, subject_id } = req.body;

    if (!title || !type || !req.file) {
        return res.status(400).json({ error: 'Validation Error', message: 'title, type, and a file are required.' });
    }

    try {
        const db = getDB();
        const school_id = req.user.role === 'ContentManager' ? null : req.user.school_id;
        const file_path = `/uploads/${req.file.filename}`;

        const result = await db.run(
            'INSERT INTO learning_contents (school_id, class_id, subject_id, title, description, type, file_path, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
            [school_id, class_id || null, subject_id || null, title, description, type, file_path, req.user.id]
        );

        res.json({ message: 'Content uploaded successfully', id: result.lastID || result.rows?.[0]?.id });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
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

        if (type) { query += ` AND lc.type = $${params.length + 1}`; params.push(type); }
        if (class_id) { query += ` AND lc.class_id = $${params.length + 1}`; params.push(class_id); }
        if (subject_id) { query += ` AND lc.subject_id = $${params.length + 1}`; params.push(subject_id); }

        query += ' ORDER BY lc.id DESC';
        const contents = await db.all(query, params);

        res.json({ contents });
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

        // Verify the content belongs to the user's school (or is global and user is ContentManager)
        const content = await db.get('SELECT id, school_id FROM learning_contents WHERE id = $1', [id]);
        if (!content) return res.status(404).json({ error: 'Not Found' });

        if (content.school_id && content.school_id !== school_id) {
            return res.status(403).json({ error: 'Forbidden', message: 'You cannot delete content from another school.' });
        }

        await db.run('DELETE FROM learning_contents WHERE id = $1', [id]);
        res.json({ message: 'Content deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
