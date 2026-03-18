const { getDB } = require('../config/database');

// Teacher: Create a quiz
exports.createQuiz = async (req, res) => {
    const { class_id, subject_id, title, duration_minutes, questions } = req.body;

    if (!class_id || !subject_id || !title || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'class_id, subject_id, title, and questions array are required.' });
    }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const teacher = await db.get('SELECT id FROM teachers WHERE user_id = $1 AND school_id = $2', [req.user.id, school_id]);
        if (!teacher) return res.status(403).json({ error: 'Forbidden', message: 'Teacher profile not found.' });

        const assignment = await db.get(
            'SELECT id FROM teacher_subject_assignments WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3',
            [teacher.id, class_id, subject_id]
        );
        if (!assignment) return res.status(403).json({ error: 'Forbidden', message: 'You are not assigned to this class/subject.' });

        await db.run('BEGIN TRANSACTION');

        const quizResult = await db.run(
            'INSERT INTO quizzes (school_id, class_id, subject_id, teacher_id, title, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [school_id, class_id, subject_id, teacher.id, title, duration_minutes || 30]
        );
        const quizId = quizResult.lastID || quizResult.rows?.[0]?.id;

        for (const q of questions) {
            await db.run(
                'INSERT INTO quiz_questions (quiz_id, question_text, options, correct_option_index) VALUES ($1, $2, $3, $4)',
                [quizId, q.question_text, JSON.stringify(q.options), q.correct_option_index]
            );
        }

        await db.run('COMMIT');
        res.json({ message: 'Quiz created successfully', id: quizId });
    } catch (err) {
        const db = getDB();
        await db.run('ROLLBACK');
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Get quizzes for a class (Teacher sees all, Student sees their class)
exports.getQuizzes = async (req, res) => {
    const { class_id } = req.query;
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        let query = `
            SELECT q.*, s.name as subject_name, c.name as class_name
            FROM quizzes q
            JOIN subjects s ON q.subject_id = s.id
            JOIN classes c ON q.class_id = c.id
            WHERE q.school_id = $1
        `;
        const params = [school_id];
        if (class_id) { query += ' AND q.class_id = $2'; params.push(class_id); }

        query += ' ORDER BY q.id DESC';
        const quizzes = await db.all(query, params);
        res.json({ quizzes });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Get quiz details with questions (for taking a quiz)
exports.getQuizDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const quiz = await db.get('SELECT * FROM quizzes WHERE id = $1 AND school_id = $2', [id, school_id]);
        if (!quiz) return res.status(404).json({ error: 'Not Found' });

        const questions = await db.all('SELECT id, question_text, options FROM quiz_questions WHERE quiz_id = $1', [id]);
        // Parse options JSON and strip correct answer for students
        const parsed = questions.map(q => ({
            ...q,
            options: JSON.parse(q.options)
        }));

        res.json({ quiz, questions: parsed });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Student: Submit quiz attempt
exports.submitQuiz = async (req, res) => {
    const { quiz_id, answers } = req.body; // answers: { questionId: selectedIndex }

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const quiz = await db.get('SELECT * FROM quizzes WHERE id = $1 AND school_id = $2', [quiz_id, school_id]);
        if (!quiz) return res.status(404).json({ error: 'Not Found' });

        const student = await db.get('SELECT id FROM students WHERE user_id = $1 AND school_id = $2 AND class_id = $3',
            [req.user.id, school_id, quiz.class_id]);
        if (!student) return res.status(403).json({ error: 'Forbidden', message: 'You are not enrolled in this class.' });

        // Check for existing attempt
        const existing = await db.get('SELECT id FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2', [quiz_id, student.id]);
        if (existing) return res.status(400).json({ error: 'Already Submitted', message: 'You have already attempted this quiz.' });

        // Score the quiz
        const questions = await db.all('SELECT id, correct_option_index FROM quiz_questions WHERE quiz_id = $1', [quiz_id]);
        let correct = 0;
        for (const q of questions) {
            if (answers[q.id] === q.correct_option_index) correct++;
        }
        const score = questions.length > 0 ? (correct / questions.length) * 100 : 0;

        const result = await db.run(
            'INSERT INTO quiz_attempts (quiz_id, student_id, score, completed_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id',
            [quiz_id, student.id, score]
        );

        res.json({ message: 'Quiz submitted', score, total: questions.length, correct, attemptId: result.lastID || result.rows?.[0]?.id });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Delete quiz
exports.deleteQuiz = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const school_id = req.user.school_id;
        const result = await db.run('DELETE FROM quizzes WHERE id = $1 AND school_id = $2', [id, school_id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Not Found' });
        res.json({ message: 'Quiz deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};
