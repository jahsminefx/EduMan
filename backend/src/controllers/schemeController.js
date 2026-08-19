const { getDB } = require('../config/database');
const { callOpenRouter, OpenRouterError } = require('../services/openRouterService');

const schemeReviewSchema = {
    type: 'object',
    properties: {
        score: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Overall pedagogical quality and curriculum completeness score from 0 to 100.'
        },
        verdict: {
            type: 'string',
            description: 'A 2-3 sentence executive summary of the scheme quality and classroom readiness.'
        },
        subject_alignment: {
            type: 'boolean',
            description: 'True if all weekly topics strictly belong to the specified subject curriculum.'
        },
        pacing_rating: {
            type: 'string',
            enum: ['Excellent', 'Good', 'Needs Adjustment', 'Rushed'],
            description: 'Evaluation of the weekly progression and workload distribution.'
        },
        strengths: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of 2 to 4 notable strengths of this scheme of work.'
        },
        weaknesses: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of 1 to 3 areas that need refinement.'
        },
        recommendations: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific, actionable suggestions for improving weekly topics, objectives, or activities.'
        }
    },
    required: ['score', 'verdict', 'subject_alignment', 'pacing_rating', 'strengths', 'weaknesses', 'recommendations'],
    additionalProperties: false
};

function cleanString(val, max = 500) {
    if (val === undefined || val === null) return '';
    return String(val).trim().slice(0, max);
}

// ── GET TEACHER OPTIONS (CLASSES, SUBJECTS, SESSIONS, TERMS) ──
exports.getOptions = async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.id;
        const schoolId = req.user.school_id;
        const role = req.user.role;

        let teacher = null;
        if (role === 'Teacher') {
            teacher = await db.get(`SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2`, [userId, schoolId]);
            if (!teacher) {
                return res.status(403).json({ error: 'Forbidden', message: 'Teacher profile not found.' });
            }
        }

        let classes = [];
        let subjects = [];

        if (role === 'Teacher' && teacher) {
            classes = await db.all(
                `SELECT DISTINCT c.id, c.name, c.level 
                 FROM classes c
                 JOIN teacher_subject_assignments tsa ON tsa.class_id = c.id
                 WHERE tsa.teacher_id = $1 AND c.school_id = $2
                 ORDER BY c.name ASC`,
                [teacher.id, schoolId]
            );

            subjects = await db.all(
                `SELECT DISTINCT s.id, s.name, tsa.class_id
                 FROM subjects s
                 JOIN teacher_subject_assignments tsa ON tsa.subject_id = s.id
                 WHERE tsa.teacher_id = $1 AND s.school_id = $2
                 ORDER BY s.name ASC`,
                [teacher.id, schoolId]
            );
        } else {
            // Admin view
            classes = await db.all(`SELECT id, name, level FROM classes WHERE school_id = $1 ORDER BY name ASC`, [schoolId]);
            subjects = await db.all(`SELECT id, name FROM subjects WHERE school_id = $1 ORDER BY name ASC`, [schoolId]);
        }

        const sessions = await db.all(`SELECT id, name, is_current FROM academic_sessions WHERE school_id = $1 ORDER BY id DESC`, [schoolId]);
        const terms = await db.all(`SELECT id, name, session_id, is_active AS is_current FROM academic_terms WHERE school_id = $1 ORDER BY id ASC`, [schoolId]);

        return res.json({ classes, subjects, sessions, terms });
    } catch (err) {
        console.error('Error fetching scheme options:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to load options.' });
    }
};

// ── GET SCHEMES LIST (FILTERED BY ROLE, SUBJECT, CLASS) ──
exports.getSchemes = async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.id;
        const schoolId = req.user.school_id;
        const role = req.user.role;
        const { subject_id, class_id, status } = req.query;

        let where = ['s.school_id = $1'];
        let params = [schoolId];
        let pIdx = 2;

        if (role === 'Teacher') {
            const teacher = await db.get(`SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2`, [userId, schoolId]);
            if (!teacher) return res.json([]);
            where.push(`s.teacher_id = $${pIdx++}`);
            params.push(teacher.id);
        } else if (role === 'Student') {
            const student = await db.get(`SELECT class_id FROM students WHERE user_id = $1 AND school_id = $2`, [userId, schoolId]);
            if (!student || !student.class_id) return res.json([]);
            where.push(`s.class_id = $${pIdx++}`);
            params.push(student.class_id);
            where.push(`s.status = 'published'`);
        } else if (role === 'Parent') {
            const { student_id } = req.query;
            let targetClassId = null;
            if (student_id) {
                const child = await db.get(
                    `SELECT s.class_id FROM students s
                     JOIN parent_student_links psl ON psl.student_id = s.id
                     WHERE psl.parent_user_id = $1 AND s.id = $2`,
                    [userId, student_id]
                );
                targetClassId = child?.class_id;
            } else {
                const firstChild = await db.get(
                    `SELECT s.class_id FROM students s
                     JOIN parent_student_links psl ON psl.student_id = s.id
                     WHERE psl.parent_user_id = $1 LIMIT 1`,
                    [userId]
                );
                targetClassId = firstChild?.class_id;
            }

            if (!targetClassId) return res.json([]);
            where.push(`s.class_id = $${pIdx++}`);
            params.push(targetClassId);
            where.push(`s.status = 'published'`);
        }

        if (subject_id) {
            where.push(`s.subject_id = $${pIdx++}`);
            params.push(parseInt(subject_id, 10));
        }

        if (class_id && role !== 'Student' && role !== 'Parent') {
            where.push(`s.class_id = $${pIdx++}`);
            params.push(parseInt(class_id, 10));
        }

        if (status) {
            where.push(`s.status = $${pIdx++}`);
            params.push(status);
        }

        const sql = `
            SELECT s.*, 
                   sub.name AS subject_name,
                   c.name AS class_name,
                   c.level AS class_level,
                   ses.name AS session_name,
                   t.name AS term_name,
                   u.name AS teacher_name,
                   (SELECT COUNT(*) FROM scheme_of_work_weeks w WHERE w.scheme_id = s.id) AS total_weeks
            FROM schemes_of_work s
            JOIN subjects sub ON sub.id = s.subject_id
            JOIN classes c ON c.id = s.class_id
            LEFT JOIN academic_sessions ses ON ses.id = s.academic_session_id
            LEFT JOIN academic_terms t ON t.id = s.term_id
            JOIN teachers tch ON tch.id = s.teacher_id
            JOIN users u ON u.id = tch.user_id
            WHERE ${where.join(' AND ')}
            ORDER BY s.updated_at DESC, s.id DESC
        `;

        const schemes = await db.all(sql, params);
        return res.json(schemes);
    } catch (err) {
        console.error('Error fetching schemes:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve schemes of work.' });
    }
};

// ── GET SINGLE SCHEME BY ID WITH WEEKS ──
exports.getSchemeById = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const schoolId = req.user.school_id;
        const role = req.user.role;
        const userId = req.user.id;

        const scheme = await db.get(
            `SELECT s.*, 
                    sub.name AS subject_name,
                    c.name AS class_name,
                    c.level AS class_level,
                    ses.name AS session_name,
                    t.name AS term_name,
                    u.name AS teacher_name,
                    u.email AS teacher_email
             FROM schemes_of_work s
             JOIN subjects sub ON sub.id = s.subject_id
             JOIN classes c ON c.id = s.class_id
             LEFT JOIN academic_sessions ses ON ses.id = s.academic_session_id
             LEFT JOIN academic_terms t ON t.id = s.term_id
             JOIN teachers tch ON tch.id = s.teacher_id
             JOIN users u ON u.id = tch.user_id
             WHERE s.id = $1 AND s.school_id = $2`,
            [id, schoolId]
        );

        if (!scheme) {
            return res.status(404).json({ error: 'Not Found', message: 'Scheme of Work not found.' });
        }

        // Access check for student/parent
        if (role === 'Student' && scheme.status !== 'published') {
            return res.status(403).json({ error: 'Forbidden', message: 'This scheme of work has not yet been published.' });
        }

        const weeks = await db.all(
            `SELECT * FROM scheme_of_work_weeks WHERE scheme_id = $1 ORDER BY week_number ASC`,
            [scheme.id]
        );

        scheme.weeks = weeks;
        return res.json(scheme);
    } catch (err) {
        console.error('Error fetching scheme details:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to load scheme details.' });
    }
};

// ── CREATE SCHEME OF WORK (TEACHER OR SCHOOL ADMIN) ──
exports.createScheme = async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.id;
        const schoolId = req.user.school_id;
        const role = req.user.role;

        const {
            class_id,
            subject_id,
            academic_session_id,
            term_id,
            title,
            description,
            weeks = []
        } = req.body;

        if (!class_id || !subject_id || !title) {
            return res.status(400).json({ error: 'Bad Request', message: 'Class, Subject, and Title are required.' });
        }

        let teacherId = null;
        if (role === 'Teacher') {
            const teacher = await db.get(`SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2`, [userId, schoolId]);
            if (!teacher) return res.status(403).json({ error: 'Forbidden', message: 'Teacher profile not found.' });
            teacherId = teacher.id;

            // Verify assignment
            const assign = await db.get(
                `SELECT id FROM teacher_subject_assignments WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3`,
                [teacherId, class_id, subject_id]
            );
            if (!assign) {
                return res.status(403).json({ error: 'Forbidden', message: 'You are not assigned to teach this subject in this class.' });
            }
        } else if (['SchoolAdmin', 'SuperAdmin'].includes(role)) {
            // Find a teacher assigned or default
            const assign = await db.get(
                `SELECT teacher_id FROM teacher_subject_assignments WHERE class_id = $1 AND subject_id = $2 LIMIT 1`,
                [class_id, subject_id]
            );
            if (assign) {
                teacherId = assign.teacher_id;
            } else {
                const firstTeacher = await db.get(`SELECT id FROM teachers WHERE school_id = $1 LIMIT 1`, [schoolId]);
                teacherId = firstTeacher ? firstTeacher.id : 1;
            }
        }

        const cleanTitle = cleanString(title, 255);
        const cleanDesc = cleanString(description, 2000);

        const newScheme = await db.run(
            `INSERT INTO schemes_of_work 
                (school_id, teacher_id, class_id, subject_id, academic_session_id, term_id, title, description, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            [schoolId, teacherId, class_id, subject_id, academic_session_id || null, term_id || null, cleanTitle, cleanDesc]
        );

        const schemeId = newScheme.id;

        // Insert initial weeks if provided, or default 12 weeks
        const weeksToInsert = Array.isArray(weeks) && weeks.length > 0 ? weeks : Array.from({ length: 12 }, (_, i) => ({
            week_number: i + 1,
            topic: `Week ${i + 1} Topic`,
            sub_topics: '',
            learning_objectives: '',
            activities_and_resources: ''
        }));

        for (const w of weeksToInsert) {
            await db.run(
                `INSERT INTO scheme_of_work_weeks 
                    (scheme_id, week_number, topic, sub_topics, learning_objectives, activities_and_resources, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    schemeId,
                    Number(w.week_number) || 1,
                    cleanString(w.topic || `Week ${w.week_number} Topic`, 255),
                    cleanString(w.sub_topics || '', 2000),
                    cleanString(w.learning_objectives || '', 2000),
                    cleanString(w.activities_and_resources || '', 2000)
                ]
            );
        }

        const created = await db.get(`SELECT * FROM schemes_of_work WHERE id = $1`, [schemeId]);
        return res.status(201).json({ message: 'Scheme of Work created successfully.', scheme: created });
    } catch (err) {
        console.error('Error creating scheme of work:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to create scheme of work.' });
    }
};

// ── UPDATE SCHEME OF WORK ──
exports.updateScheme = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const schoolId = req.user.school_id;
        const role = req.user.role;
        const userId = req.user.id;

        const scheme = await db.get(`SELECT * FROM schemes_of_work WHERE id = $1 AND school_id = $2`, [id, schoolId]);
        if (!scheme) return res.status(404).json({ error: 'Not Found', message: 'Scheme of work not found.' });

        if (role === 'Teacher') {
            const teacher = await db.get(`SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2`, [userId, schoolId]);
            if (!teacher || teacher.id !== scheme.teacher_id) {
                return res.status(403).json({ error: 'Forbidden', message: 'You can only update your own schemes of work.' });
            }
        }

        const { title, description, academic_session_id, term_id, status, weeks = [] } = req.body;

        const cleanTitle = cleanString(title || scheme.title, 255);
        const cleanDesc = cleanString(description !== undefined ? description : scheme.description, 2000);
        const newStatus = status === 'published' ? 'published' : (status === 'draft' ? 'draft' : scheme.status);

        await db.run(
            `UPDATE schemes_of_work 
             SET title = $1, description = $2, academic_session_id = $3, term_id = $4, status = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [cleanTitle, cleanDesc, academic_session_id || scheme.academic_session_id, term_id || scheme.term_id, newStatus, scheme.id]
        );

        if (Array.isArray(weeks) && weeks.length > 0) {
            // Delete existing weeks and re-insert updated weeks
            await db.run(`DELETE FROM scheme_of_work_weeks WHERE scheme_id = $1`, [scheme.id]);

            for (const w of weeks) {
                await db.run(
                    `INSERT INTO scheme_of_work_weeks 
                        (scheme_id, week_number, topic, sub_topics, learning_objectives, activities_and_resources, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [
                        scheme.id,
                        Number(w.week_number) || 1,
                        cleanString(w.topic, 255),
                        cleanString(w.sub_topics || '', 2000),
                        cleanString(w.learning_objectives || '', 2000),
                        cleanString(w.activities_and_resources || '', 2000)
                    ]
                );
            }
        }

        const updated = await db.get(`SELECT * FROM schemes_of_work WHERE id = $1`, [scheme.id]);
        return res.json({ message: 'Scheme of Work updated successfully.', scheme: updated });
    } catch (err) {
        console.error('Error updating scheme of work:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to update scheme of work.' });
    }
};

// ── TOGGLE PUBLISH STATUS ──
exports.publishScheme = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const schoolId = req.user.school_id;
        const role = req.user.role;
        const userId = req.user.id;

        const scheme = await db.get(`SELECT * FROM schemes_of_work WHERE id = $1 AND school_id = $2`, [id, schoolId]);
        if (!scheme) return res.status(404).json({ error: 'Not Found', message: 'Scheme of work not found.' });

        if (role === 'Teacher') {
            const teacher = await db.get(`SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2`, [userId, schoolId]);
            if (!teacher || teacher.id !== scheme.teacher_id) {
                return res.status(403).json({ error: 'Forbidden', message: 'You can only publish your own schemes of work.' });
            }
        }

        const newStatus = scheme.status === 'published' ? 'draft' : 'published';
        await db.run(`UPDATE schemes_of_work SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newStatus, scheme.id]);

        return res.json({ message: `Scheme of Work ${newStatus === 'published' ? 'published to students' : 'reverted to draft'}.`, status: newStatus });
    } catch (err) {
        console.error('Error publishing scheme:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to update publication status.' });
    }
};

// ── DELETE SCHEME ──
exports.deleteScheme = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const schoolId = req.user.school_id;
        const role = req.user.role;
        const userId = req.user.id;

        const scheme = await db.get(`SELECT * FROM schemes_of_work WHERE id = $1 AND school_id = $2`, [id, schoolId]);
        if (!scheme) return res.status(404).json({ error: 'Not Found', message: 'Scheme of work not found.' });

        if (role === 'Teacher') {
            const teacher = await db.get(`SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2`, [userId, schoolId]);
            if (!teacher || teacher.id !== scheme.teacher_id) {
                return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own schemes of work.' });
            }
        }

        await db.run(`DELETE FROM schemes_of_work WHERE id = $1`, [scheme.id]);
        return res.json({ message: 'Scheme of Work deleted successfully.' });
    } catch (err) {
        console.error('Error deleting scheme:', err);
        return res.status(500).json({ error: 'Server Error', message: 'Failed to delete scheme.' });
    }
};

// ── EDUMAN AI REVIEW SCHEME OF WORK ──
exports.reviewSchemeWithAI = async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const schoolId = req.user.school_id;
        const userId = req.user.id;
        const role = req.user.role;

        const scheme = await db.get(
            `SELECT s.*, 
                    sub.name AS subject_name,
                    c.name AS class_name,
                    c.level AS class_level,
                    ses.name AS session_name,
                    t.name AS term_name
             FROM schemes_of_work s
             JOIN subjects sub ON sub.id = s.subject_id
             JOIN classes c ON c.id = s.class_id
             LEFT JOIN academic_sessions ses ON ses.id = s.academic_session_id
             LEFT JOIN academic_terms t ON t.id = s.term_id
             WHERE s.id = $1 AND s.school_id = $2`,
            [id, schoolId]
        );

        if (!scheme) return res.status(404).json({ error: 'Not Found', message: 'Scheme of work not found.' });

        let teacherId = scheme.teacher_id;
        if (role === 'Teacher') {
            const teacher = await db.get(`SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2`, [userId, schoolId]);
            if (!teacher || teacher.id !== scheme.teacher_id) {
                return res.status(403).json({ error: 'Forbidden', message: 'You can only review your own schemes of work.' });
            }
            teacherId = teacher.id;
        }

        const weeks = await db.all(
            `SELECT week_number, topic, sub_topics, learning_objectives, activities_and_resources 
             FROM scheme_of_work_weeks 
             WHERE scheme_id = $1 
             ORDER BY week_number ASC`,
            [scheme.id]
        );

        if (weeks.length === 0) {
            return res.status(400).json({ error: 'Bad Request', message: 'Add weekly topics to your scheme before requesting AI review.' });
        }

        // Format weekly syllabus for the AI prompt
        const weeksSummary = weeks.map(w => (
            `Week ${w.week_number}:
- Topic: ${w.topic || 'Not specified'}
- Sub-Topics: ${w.sub_topics || 'None provided'}
- Learning Objectives: ${w.learning_objectives || 'None provided'}
- Activities & Resources: ${w.activities_and_resources || 'None provided'}`
        )).join('\n\n');

        const prompt = [
            'You are EduMan AI, an expert school curriculum evaluator and instructional director.',
            `Subject: ${scheme.subject_name}`,
            `Class: ${scheme.class_name} (Level ${scheme.class_level || 'standard'})`,
            `Academic Session: ${scheme.session_name || 'Current'}, Term: ${scheme.term_name || 'Current'}`,
            `Title: ${scheme.title}`,
            `Total Weeks: ${weeks.length}`,
            '',
            'WEEKLY SCHEME OF WORK CONTENT:',
            weeksSummary,
            '',
            'CRITICAL EVALUATION GUIDELINES:',
            `1. Subject Relevance: Verify that EVERY weekly topic authentically belongs to the standard school curriculum for "${scheme.subject_name}". If topics from other subjects appear (e.g. biology in mathematics or literature in chemistry), set subject_alignment to false and note the offending weeks in weaknesses.`,
            '2. Pedagogical Progression: Check if foundational concepts come before complex topics. Is the order logical and progressive?',
            '3. Learning Objectives: Are objectives clear, measurable, and age-appropriate for this class level?',
            '4. Pacing & Assessment: Check if revision weeks, mid-term break/test, or examination weeks are properly placed.',
            '5. Practical Actionable Recommendations: Provide 2 to 4 concrete suggestions the teacher can implement right away.'
        ].join('\n');

        // Fetch AI settings
        const settings = await db.get(`SELECT model FROM ai_settings WHERE school_id = $1`, [schoolId]) || { model: 'google/gemini-2.5-flash' };

        const result = await callOpenRouter({
            model: settings.model || 'google/gemini-2.5-flash',
            messages: [
                {
                    role: 'system',
                    content: 'You are EduMan AI, an expert school curriculum evaluator. Provide rigorous, constructive, teacher-friendly pedagogical reviews.'
                },
                { role: 'user', content: prompt }
            ],
            responseSchema: schemeReviewSchema,
            schemaName: 'eduman_scheme_review',
            maxTokens: 5000
        });

        const reviewData = {
            ...result.data,
            reviewed_at: new Date().toISOString(),
            model: settings.model
        };

        // Save AI review in scheme
        await db.run(
            `UPDATE schemes_of_work SET ai_review = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [JSON.stringify(reviewData), scheme.id]
        );

        return res.json({
            message: 'EduMan AI completed the scheme of work review.',
            review: reviewData
        });
    } catch (err) {
        console.error('Error reviewing scheme of work with AI:', err);
        if (err instanceof OpenRouterError) {
            return res.status(err.status || 502).json({ error: 'AI Error', message: err.message });
        }
        return res.status(500).json({ error: 'Server Error', message: err.message || 'Failed to review scheme of work.' });
    }
};
