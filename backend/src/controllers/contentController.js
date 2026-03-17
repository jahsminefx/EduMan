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
            'INSERT INTO learning_contents (school_id, class_id, subject_id, title, description, type, file_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [school_id, class_id || null, subject_id || null, title, description, type, file_path, req.user.id]
        );

        res.json({ message: 'Content uploaded successfully', id: result.lastID });
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
            query += ' AND (lc.school_id IS NULL OR lc.school_id = ?)';
            params.push(school_id);
        }

        if (type) { query += ' AND lc.type = ?'; params.push(type); }
        if (class_id) { query += ' AND lc.class_id = ?'; params.push(class_id); }
        if (subject_id) { query += ' AND lc.subject_id = ?'; params.push(subject_id); }

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
        const result = await db.run('DELETE FROM learning_contents WHERE id = ?', [id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Not Found' });
        res.json({ message: 'Content deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
