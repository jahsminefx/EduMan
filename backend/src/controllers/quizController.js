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

        const quizId = await db.transaction(async (client) => {
            const quizResult = await client.run(
                'INSERT INTO quizzes (school_id, class_id, subject_id, teacher_id, title, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [school_id, class_id, subject_id, teacher.id, title, duration_minutes || 30]
            );
            const id = quizResult.lastID;

            for (const q of questions) {
                await client.run(
                    'INSERT INTO quiz_questions (quiz_id, question_text, options, correct_option_index) VALUES ($1, $2, $3, $4)',
                    [id, q.question_text, JSON.stringify(q.options), q.correct_option_index]
                );
            }

            return id;
        });

        res.json({ message: 'Quiz created successfully', id: quizId });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Get quizzes for a class
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

        // If student, check which quizzes they've already attempted
        if (req.user.role === 'Student') {
            const student = await db.get('SELECT id FROM students WHERE user_id = $1 AND school_id = $2', [req.user.id, school_id]);
            if (student) {
                const attempts = await db.all('SELECT quiz_id, id as attempt_id, score FROM quiz_attempts WHERE student_id = $1', [student.id]);
                const attemptMap = {};
                for (const a of attempts) { attemptMap[a.quiz_id] = { attempt_id: a.attempt_id, score: a.score }; }
                for (const q of quizzes) {
                    q.attempted = !!attemptMap[q.id];
                    q.attempt_id = attemptMap[q.id]?.attempt_id || null;
                    q.score = attemptMap[q.id]?.score || null;
                }
            }
        }

        res.json({ quizzes });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Get quiz details with questions
exports.getQuizDetails = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const quiz = await db.get('SELECT * FROM quizzes WHERE id = $1 AND school_id = $2', [id, school_id]);
        if (!quiz) return res.status(404).json({ error: 'Not Found' });

        const questions = await db.all('SELECT id, question_text, options FROM quiz_questions WHERE quiz_id = $1', [id]);
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
    const { quiz_id, answers } = req.body;

    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const quiz = await db.get('SELECT * FROM quizzes WHERE id = $1 AND school_id = $2', [quiz_id, school_id]);
        if (!quiz) return res.status(404).json({ error: 'Not Found' });

        const student = await db.get('SELECT id FROM students WHERE user_id = $1 AND school_id = $2 AND class_id = $3',
            [req.user.id, school_id, quiz.class_id]);
        if (!student) return res.status(403).json({ error: 'Forbidden', message: 'You are not enrolled in this class.' });

        const existing = await db.get('SELECT id FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2', [quiz_id, student.id]);
        if (existing) return res.status(400).json({ error: 'Already Submitted', message: 'You have already attempted this quiz.' });

        // Score the quiz
        const questions = await db.all('SELECT id, correct_option_index FROM quiz_questions WHERE quiz_id = $1', [quiz_id]);
        let correct = 0;
        for (const q of questions) {
            if (answers[q.id] === q.correct_option_index) correct++;
        }
        const score = questions.length > 0 ? (correct / questions.length) * 100 : 0;

        const attemptId = await db.transaction(async (client) => {
            const result = await client.run(
                'INSERT INTO quiz_attempts (quiz_id, student_id, score, completed_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id',
                [quiz_id, student.id, score]
            );
            const attempt_id = result.lastID;

            // Save individual answers for review
            for (const q of questions) {
                const selectedOption = answers[q.id] !== undefined ? answers[q.id] : null;
                await client.run(
                    'INSERT INTO quiz_attempt_answers (attempt_id, question_id, selected_option_index) VALUES ($1, $2, $3)',
                    [attempt_id, q.id, selectedOption]
                );
            }

            return attempt_id;
        });

        res.json({ message: 'Quiz submitted', score, total: questions.length, correct, attemptId });
    } catch (err) {
        res.status(500).json({ error: 'Server Error', message: err.message });
    }
};

// Student: Review quiz attempt
exports.reviewQuiz = async (req, res) => {
    const { id } = req.params; // quiz id
    try {
        const db = getDB();
        const school_id = req.user.school_id;

        const quiz = await db.get('SELECT * FROM quizzes WHERE id = $1 AND school_id = $2', [id, school_id]);
        if (!quiz) return res.status(404).json({ error: 'Not Found', message: 'Quiz not found.' });

        const student = await db.get('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
        if (!student) return res.status(403).json({ error: 'Forbidden', message: 'Student profile not found.' });

        const attempt = await db.get('SELECT * FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2', [id, student.id]);
        if (!attempt) return res.status(404).json({ error: 'Not Found', message: 'You have not attempted this quiz.' });

        // Get questions with correct answers and student's answers
        const questions = await db.all(`
            SELECT qq.id, qq.question_text, qq.options, qq.correct_option_index,
                   qaa.selected_option_index
            FROM quiz_questions qq
            LEFT JOIN quiz_attempt_answers qaa ON qq.id = qaa.question_id AND qaa.attempt_id = $1
            WHERE qq.quiz_id = $2
            ORDER BY qq.id ASC
        `, [attempt.id, id]);

        const review = questions.map(q => ({
            id: q.id,
            question_text: q.question_text,
            options: JSON.parse(q.options),
            correct_option_index: q.correct_option_index,
            selected_option_index: q.selected_option_index,
            is_correct: q.selected_option_index === q.correct_option_index
        }));

        res.json({
            quiz: { id: quiz.id, title: quiz.title },
            attempt: { id: attempt.id, score: attempt.score, completed_at: attempt.completed_at },
            total: questions.length,
            correct: review.filter(r => r.is_correct).length,
            questions: review
        });
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
