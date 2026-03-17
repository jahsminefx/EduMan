const { getDB } = require('../config/database');

exports.getAssignments = async (req, res) => {
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        
        const assignments = await db.all(`
            SELECT tsa.id, t.first_name, t.last_name, c.name as class_name, s.name as subject_name
            FROM teacher_subject_assignments tsa
            JOIN teachers t ON tsa.teacher_id = t.id
            JOIN classes c ON tsa.class_id = c.id
            JOIN subjects s ON tsa.subject_id = s.id
            WHERE t.school_id = $1
        `, [school_id]);
        
        res.json({ assignments });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.assignTeacher = async (req, res) => {
    const { teacher_id, class_id, subject_id } = req.body;
    
    if (!teacher_id || !class_id || !subject_id) {
        return res.status(400).json({ error: 'Validation Error', message: 'Missing required fields' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Verify that the requested teacher, class, and subject actually belong to this school
        const teacher = await db.get('SELECT id FROM teachers WHERE id = $1 AND school_id = $2', [teacher_id, school_id]);
        const classObj = await db.get('SELECT id FROM classes WHERE id = $1 AND school_id = $2', [class_id, school_id]);
        const subject = await db.get('SELECT id FROM subjects WHERE id = $1 AND school_id = $2', [subject_id, school_id]);

        if (!teacher || !classObj || !subject) {
            return res.status(403).json({ error: 'Forbidden', message: 'You cannot map resources outside your school boundaries.' });
        }

        // Check duplicate
        const existing = await db.get(
            'SELECT id FROM teacher_subject_assignments WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3',
            [teacher_id, class_id, subject_id]
        );
        
        if (existing) {
            return res.status(400).json({ error: 'Duplicate', message: 'This teacher is already assigned to this class and subject.' });
        }

        const result = await db.run(
            'INSERT INTO teacher_subject_assignments (teacher_id, class_id, subject_id) VALUES ($1, $2, $3) RETURNING id',
            [teacher_id, class_id, subject_id]
        );

        res.json({ message: 'Teacher assigned successfully', id: result.lastID || result.rows?.[0]?.id });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

exports.removeAssignment = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        // Verify the assignment belongs to a teacher in this school
        const assignment = await db.get(`
            SELECT tsa.id 
            FROM teacher_subject_assignments tsa
            JOIN teachers t ON tsa.teacher_id = t.id
            WHERE tsa.id = $1 AND t.school_id = $2
        `, [id, school_id]);

        if (!assignment) {
            return res.status(404).json({ error: 'Not Found', message: 'Assignment not found in your school' });
        }

        await db.run('DELETE FROM teacher_subject_assignments WHERE id = $1', [id]);
        res.json({ message: 'Assignment removed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
