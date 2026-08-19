const { getDB } = require('../config/database');
const { callOpenRouter, OpenRouterError } = require('../services/openRouterService');
const { sendPdf, sendDocx } = require('../utils/documentExport');

const QUIZ_TYPES = new Set(['multiple_choice', 'true_false', 'mixed']);
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const CONTENT_TYPES = new Set([
    'lesson_note',
    'study_guide',
    'class_summary',
    'assignment',
    'revision_note',
    'exam_preparation_note'
]);
const CONTENT_LENGTHS = new Set(['short', 'medium', 'long']);
const CONTENT_TONES = new Set(['professional', 'friendly', 'simple', 'exam_focused']);

const quizResponseSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', description: 'A concise classroom-ready quiz title.' },
        subject_match: {
            type: 'boolean',
            description: 'Set to true if the topic legitimately belongs to the curriculum of the specified subject. Set to false if the topic belongs to an entirely different subject (e.g. Photosynthesis under Mathematics).'
        },
        mismatch_reason: {
            type: 'string',
            description: 'If subject_match is false, explain why the topic does not belong to this subject and specify which subject it belongs to.'
        },
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    question_text: { type: 'string' },
                    question_type: { type: 'string', enum: ['multiple_choice', 'true_false'] },
                    options: {
                        type: 'array',
                        items: { type: 'string' },
                        minItems: 2,
                        maxItems: 4
                    },
                    correct_option_index: { type: 'integer', minimum: 0, maximum: 3 },
                    explanation: { type: 'string' }
                },
                required: ['question_text', 'question_type', 'options', 'correct_option_index', 'explanation'],
                additionalProperties: false
            }
        }
    },
    required: ['title', 'subject_match', 'questions'],
    additionalProperties: false
};

const contentResponseSchema = {
    type: 'object',
    properties: {
        title: { type: 'string', description: 'A concise title suitable for a school learning library.' },
        subject_match: {
            type: 'boolean',
            description: 'Set to true if the topic legitimately belongs to the curriculum of the specified subject. Set to false if the topic belongs to an entirely different subject (e.g. Photosynthesis under Mathematics).'
        },
        mismatch_reason: {
            type: 'string',
            description: 'If subject_match is false, explain why the topic does not belong to this subject and specify which subject it belongs to.'
        },
        body: {
            type: 'string',
            description: 'Complete document in readable Markdown with headings, paragraphs, and lists.'
        }
    },
    required: ['title', 'subject_match', 'body'],
    additionalProperties: false
};

function cleanString(value, maxLength = 500) {
    if (value === undefined || value === null) return '';
    return String(value).trim().slice(0, maxLength);
}

function sanitizeAiBody(raw) {
    if (!raw) return '';
    let text = String(raw).trim();

    // 1. Remove wrapping ```markdown ... ``` or ``` ... ``` code fences
    text = text.replace(/^```(?:markdown|text|md)?\r?\n([\s\S]*?)\r?\n```$/i, '$1');

    // 2. Normalize escaped line breaks, tabs, and quotes
    text = text.replace(/\\n/g, '\n').replace(/\\t/g, '  ').replace(/\\"/g, '"');

    // 3. Remove raw JSON wrapping if the LLM outputted raw JSON string
    if (text.startsWith('{') && text.endsWith('}')) {
        try {
            const parsed = JSON.parse(text);
            if (parsed.body) text = parsed.body;
            else if (parsed.content) text = parsed.content;
        } catch {
            // keep as-is
        }
    }

    // 4. Clean up redundant repeating hash marks (e.g. #######) or multiple duplicate horizontal rules
    text = text.replace(/#{4,}/g, '###');
    text = text.replace(/(?:---|\*\*\*)\s*(?:---|\*\*\*)+/g, '---');

    return text.trim();
}

function positiveId(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function asBoolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function safeJson(value) {
    try {
        return JSON.stringify(value);
    } catch {
        return '{}';
    }
}

function parseOptions(value) {
    if (Array.isArray(value)) return value;
    try {
        return JSON.parse(value);
    } catch {
        return [];
    }
}

function normalizeQuestions(questions) {
    if (!Array.isArray(questions) || questions.length === 0 || questions.length > 50) {
        throw new Error('A quiz must contain between 1 and 50 questions.');
    }

    return questions.map((question, index) => {
        const questionText = cleanString(question.question_text || question.question, 3000);
        const questionType = question.question_type === 'true_false' ? 'true_false' : 'multiple_choice';
        const options = (Array.isArray(question.options) ? question.options : [])
            .map(option => cleanString(option, 1000))
            .filter(Boolean);
        const correctIndex = Number(question.correct_option_index);
        const explanation = cleanString(question.explanation, 5000);

        if (!questionText) throw new Error(`Question ${index + 1} is empty.`);
        if (options.length < 2 || options.length > 4) {
            throw new Error(`Question ${index + 1} must have between 2 and 4 options.`);
        }
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
            throw new Error(`Question ${index + 1} has an invalid correct answer.`);
        }

        return {
            question_text: questionText,
            question_type: questionType,
            options,
            correct_option_index: correctIndex,
            explanation
        };
    });
}

async function getTeacher(req) {
    const db = getDB();
    const teacher = await db.get(
        'SELECT id, school_id, first_name, last_name FROM teachers WHERE user_id = $1 AND school_id = $2',
        [req.user.id, req.user.school_id]
    );
    if (!teacher) {
        const error = new Error('Teacher profile not found.');
        error.status = 403;
        throw error;
    }
    return teacher;
}

async function getAiSettings(schoolId) {
    const db = getDB();
    const settings = await db.get('SELECT * FROM ai_settings WHERE school_id = $1', [schoolId]);
    return {
        model: settings?.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o',
        daily_teacher_limit: Number(settings?.daily_teacher_limit || process.env.OPENROUTER_DAILY_LIMIT || 10),
        is_enabled: settings ? settings.is_enabled !== 0 : true
    };
}

async function getUsage(teacherId) {
    const db = getDB();
    const result = await db.get(
        `SELECT COUNT(*) AS count
         FROM ai_generations
         WHERE teacher_id = $1
           AND created_at >= CURRENT_DATE
           AND status IN ('pending', 'completed')`,
        [teacherId]
    );
    return Number(result?.count || 0);
}

async function enforceUsageLimit(teacherId, schoolId) {
    const settings = await getAiSettings(schoolId);
    if (!settings.is_enabled) {
        const error = new Error('EduMan AI generation is currently disabled by your school administrator.');
        error.status = 403;
        throw error;
    }
    const used = await getUsage(teacherId);
    if (used >= settings.daily_teacher_limit) {
        const error = new Error(`You have reached your daily EduMan AI generation limit of ${settings.daily_teacher_limit}.`);
        error.status = 429;
        throw error;
    }
    return { settings, used };
}

async function resolveAcademicContext(schoolId, classId, subjectId, sessionId, termId) {
    const db = getDB();
    const context = await db.get(
        `SELECT
            c.id AS class_id,
            c.name AS class_name,
            c.level AS class_level,
            s.id AS subject_id,
            s.name AS subject_name,
            acs.id AS session_id,
            acs.name AS academic_session,
            at.id AS term_id,
            at.name AS term
         FROM classes c
         JOIN subjects s ON s.id = $2 AND s.school_id = c.school_id
         JOIN academic_sessions acs ON acs.id = $3 AND acs.school_id = c.school_id
         JOIN academic_terms at ON at.id = $4 AND at.school_id = c.school_id AND at.session_id = acs.id
         WHERE c.id = $1 AND c.school_id = $5`,
        [classId, subjectId, sessionId, termId, schoolId]
    );
    if (!context) {
        const error = new Error('The selected class, subject, academic session, or term is invalid.');
        error.status = 400;
        throw error;
    }
    return context;
}

async function ensureTeacherAssignment(teacherId, classId, subjectId) {
    const db = getDB();
    const assignment = await db.get(
        `SELECT id FROM teacher_subject_assignments
         WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3`,
        [teacherId, classId, subjectId]
    );
    if (!assignment) {
        const error = new Error('You are not assigned to teach this subject in this class.');
        error.status = 403;
        throw error;
    }
}

async function createAudit({
    teacherId,
    schoolId,
    classId,
    subjectId,
    generationType,
    prompt,
    model,
    academicSession,
    term,
    metadata
}) {
    const db = getDB();
    const result = await db.run(
        `INSERT INTO ai_generations
            (teacher_id, school_id, class_id, subject_id, generation_type, prompt, status, model,
             academic_session, term, request_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10)
         RETURNING id`,
        [
            teacherId,
            schoolId,
            classId,
            subjectId,
            generationType,
            prompt,
            model,
            academicSession,
            term,
            safeJson(metadata)
        ]
    );
    return result.lastID;
}

async function completeAudit(generationId, result) {
    const db = getDB();
    await db.run(
        `UPDATE ai_generations
         SET response = $1, status = 'completed', model = $2, prompt_tokens = $3,
             completion_tokens = $4, total_tokens = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [
            safeJson(result.raw),
            result.model,
            Number(result.usage?.prompt_tokens || 0),
            Number(result.usage?.completion_tokens || 0),
            Number(result.usage?.total_tokens || 0),
            generationId
        ]
    );
}

async function failAudit(generationId, error) {
    if (!generationId) return;
    const db = getDB();
    await db.run(
        `UPDATE ai_generations
         SET status = 'failed', error_message = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [cleanString(error.message, 2000), generationId]
    ).catch(() => {});
}

function handleControllerError(res, error, label) {
    console.error(`${label}:`, error);
    if (error instanceof OpenRouterError) {
        return res.status(error.status || 502).json({
            error: 'EduMan AI Generation Error',
            message: error.message,
            code: error.code,
            retry_after: error.retryAfter
        });
    }
    return res.status(error.status || 500).json({
        error: error.status && error.status < 500 ? 'Request Error' : 'Server Error',
        message: error.message || 'Something went wrong.'
    });
}

function buildQuizPrompt(context, input) {
    const typeInstructions = input.question_type === 'true_false'
        ? 'Every question must be true/false with exactly two options: True and False.'
        : input.question_type === 'mixed'
            ? 'Use a balanced mix of multiple-choice and true/false questions.'
            : 'Every question must be multiple-choice with exactly four plausible options.';

    return [
        'You are creating a curriculum-aligned school assessment quiz for a teacher to review.',
        `Target Subject: ${context.subject_name}`,
        `Target Class: ${context.class_name} (Level ${context.class_level || 'standard'})`,
        `Requested Topic: ${input.topic}`,
        `Difficulty: ${input.difficulty}`,
        `Number of questions: ${input.number_of_questions}`,
        `Academic session: ${context.academic_session}, Term: ${context.term}`,
        typeInstructions,
        'CRITICAL SUBJECT ALIGNMENT RULES:',
        `- Verify that "${input.topic}" authentically belongs to the standard school curriculum for "${context.subject_name}".`,
        `- If "${input.topic}" belongs to an entirely DIFFERENT subject (e.g. Photosynthesis requested under Mathematics, or Quadratic Equations requested under Literature, or World War II requested under Chemistry), set "subject_match": false and provide a clear "mismatch_reason" stating which subject this topic actually belongs to.`,
        '- Never fabricate awkward or artificial cross-subject questions (e.g. do NOT create math problems about photosynthesis or chemistry problems about Shakespeare).',
        '- When subject_match is true, ensure all questions strictly test authentic concepts within the domain of ' + context.subject_name + '.',
        '- Avoid ambiguous trick questions.',
        '- Provide concise, helpful explanations for every answer option.'
    ].join('\n');
}

function buildContentPrompt(context, input) {
    const contentLabel = input.content_type.replace(/_/g, ' ');
    const toneLabel = input.tone.replace(/_/g, ' ');
    return [
        `You are creating a comprehensive, curriculum-aligned ${contentLabel} for classroom instruction.`,
        `Target Subject: ${context.subject_name}`,
        `Target Class: ${context.class_name} (Level ${context.class_level || 'standard'})`,
        `Requested Topic: ${input.topic}`,
        `Length: ${input.length}`,
        `Tone: ${toneLabel}`,
        `Include examples: ${input.include_examples ? 'yes' : 'no'}`,
        `Include assessment questions: ${input.include_assessment ? 'yes' : 'no'}`,
        `Academic session: ${context.academic_session}, Term: ${context.term}`,
        'CRITICAL SUBJECT ALIGNMENT RULES:',
        `- Verify that "${input.topic}" authentically belongs to the standard school curriculum for "${context.subject_name}".`,
        `- If "${input.topic}" belongs to an entirely DIFFERENT subject (e.g. Photosynthesis requested under Mathematics, or Newton\'s Laws requested under History, or Accounting principles requested under Biology), set "subject_match": false and provide a clear "mismatch_reason" explaining which subject this topic actually belongs to.`,
        '- Never invent artificial cross-discipline topics (e.g. do NOT write "Mathematics notes on Photosynthesis" or "English Grammar notes on Balancing Chemical Equations").',
        '- When subject_match is true, write clean, structured, high-quality learning content strictly within the domain of ' + context.subject_name + '.',
        '- Include clear learning objectives, structured core explanations, and a concise summary.',
        input.include_examples ? '- Include practical, subject-appropriate worked examples.' : '- Do not add a dedicated examples section.',
        input.include_assessment
            ? '- End with assessment questions and a teacher answer guide.'
            : '- Do not include assessment questions.',
        '- Do not include code block wrappers (like ```markdown) or robotic conversational filler.'
    ].join('\n');
}

async function generateQuizData(req, teacher, context, input) {
    await ensureTeacherAssignment(teacher.id, context.class_id, context.subject_id);
    const { settings } = await enforceUsageLimit(teacher.id, teacher.school_id);
    const prompt = buildQuizPrompt(context, input);
    let generationId;
    try {
        generationId = await createAudit({
            teacherId: teacher.id,
            schoolId: teacher.school_id,
            classId: context.class_id,
            subjectId: context.subject_id,
            generationType: 'quiz',
            prompt,
            model: settings.model,
            academicSession: context.academic_session,
            term: context.term,
            metadata: input
        });

        const result = await callOpenRouter({
            model: settings.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are EduMan AI, an expert school assessment designer. Strictly enforce academic subject boundaries and curriculum alignment.'
                },
                { role: 'user', content: prompt }
            ],
            responseSchema: quizResponseSchema,
            schemaName: 'eduman_quiz',
            maxTokens: Math.min(12000, Math.max(2500, input.number_of_questions * 500))
        });

        if (result.data.subject_match === false) {
            const reason = result.data.mismatch_reason || `The topic "${input.topic}" does not belong to the ${context.subject_name} curriculum. Please select the correct subject to generate materials for this topic.`;
            throw Object.assign(new Error(reason), { status: 400 });
        }

        const questions = normalizeQuestions(result.data.questions);
        if (questions.length !== input.number_of_questions) {
            throw new Error(`EduMan AI returned ${questions.length} questions instead of ${input.number_of_questions}. Please regenerate.`);
        }
        await completeAudit(generationId, result);
        return {
            generationId,
            title: cleanString(result.data.title, 300) || `${context.subject_name}: ${input.topic}`,
            questions
        };
    } catch (error) {
        await failAudit(generationId, error);
        throw error;
    }
}

async function generateContentData(req, teacher, context, input) {
    await ensureTeacherAssignment(teacher.id, context.class_id, context.subject_id);
    const { settings } = await enforceUsageLimit(teacher.id, teacher.school_id);
    const prompt = buildContentPrompt(context, input);
    let generationId;
    try {
        generationId = await createAudit({
            teacherId: teacher.id,
            schoolId: teacher.school_id,
            classId: context.class_id,
            subjectId: context.subject_id,
            generationType: 'learning_content',
            prompt,
            model: settings.model,
            academicSession: context.academic_session,
            term: context.term,
            metadata: input
        });

        const result = await callOpenRouter({
            model: settings.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are EduMan AI, an expert instructional designer. Strictly enforce academic subject boundaries and curriculum alignment.'
                },
                { role: 'user', content: prompt }
            ],
            responseSchema: contentResponseSchema,
            schemaName: 'eduman_learning_content',
            maxTokens: input.length === 'long' ? 10000 : input.length === 'short' ? 3500 : 6500
        });

        if (result.data.subject_match === false) {
            const reason = result.data.mismatch_reason || `The topic "${input.topic}" does not belong to the ${context.subject_name} curriculum. Please select the correct subject to generate materials for this topic.`;
            throw Object.assign(new Error(reason), { status: 400 });
        }

        const title = cleanString(result.data.title, 300);
        const body = sanitizeAiBody(cleanString(result.data.body, 100000));
        if (!title || body.length < 100) {
            throw new Error('EduMan AI returned incomplete learning content. Please regenerate.');
        }
        await completeAudit(generationId, result);
        return { generationId, title, body };
    } catch (error) {
        await failAudit(generationId, error);
        throw error;
    }
}

async function getQuizWithQuestions(quizId) {
    const db = getDB();
    const quiz = await db.get(
        `SELECT q.*, c.name AS class_name, c.level AS class_level, s.name AS subject_name
         FROM quizzes q
         JOIN classes c ON c.id = q.class_id
         JOIN subjects s ON s.id = q.subject_id
         WHERE q.id = $1`,
        [quizId]
    );
    if (!quiz) return null;
    const rows = await db.all(
        `SELECT id, question_text, options, correct_option_index, explanation, question_type
         FROM quiz_questions WHERE quiz_id = $1 ORDER BY id ASC`,
        [quizId]
    );
    quiz.questions = rows.map(row => ({ ...row, options: parseOptions(row.options) }));
    return quiz;
}

async function getResource(resourceId) {
    const db = getDB();
    return db.get(
        `SELECT lr.*, c.name AS class_name, c.level AS class_level, s.name AS subject_name,
                u.name AS teacher_name
         FROM library_resources lr
         JOIN classes c ON c.id = lr.class_id
         JOIN subjects s ON s.id = lr.subject_id
         JOIN teachers t ON t.id = lr.teacher_id
         JOIN users u ON u.id = t.user_id
         WHERE lr.id = $1`,
        [resourceId]
    );
}

async function assertTeacherOwnsQuiz(req, id) {
    const teacher = await getTeacher(req);
    const quiz = await getQuizWithQuestions(id);
    if (!quiz || quiz.school_id !== teacher.school_id || quiz.teacher_id !== teacher.id || !quiz.generation_id) {
        const error = new Error('EduMan AI quiz draft not found.');
        error.status = 404;
        throw error;
    }
    return { teacher, quiz };
}

async function assertTeacherOwnsResource(req, id) {
    const teacher = await getTeacher(req);
    const resource = await getResource(id);
    if (!resource || resource.school_id !== teacher.school_id || resource.teacher_id !== teacher.id) {
        const error = new Error('EduMan AI learning resource not found.');
        error.status = 404;
        throw error;
    }
    return { teacher, resource };
}

exports.getOptions = async (req, res) => {
    try {
        const db = getDB();
        const teacher = await getTeacher(req);
        const [assignments, sessions, terms, settings, used] = await Promise.all([
            db.all(
                `SELECT tsa.id, c.id AS class_id, c.name AS class_name, c.level AS class_level,
                        s.id AS subject_id, s.name AS subject_name, s.code AS subject_code
                 FROM teacher_subject_assignments tsa
                 JOIN classes c ON c.id = tsa.class_id AND c.school_id = $2
                 JOIN subjects s ON s.id = tsa.subject_id AND s.school_id = $2
                 WHERE tsa.teacher_id = $1
                 ORDER BY c.level, c.name, s.name`,
                [teacher.id, teacher.school_id]
            ),
            db.all('SELECT id, name, is_active FROM academic_sessions WHERE school_id = $1 ORDER BY id DESC', [teacher.school_id]),
            db.all('SELECT id, session_id, name, is_active FROM academic_terms WHERE school_id = $1 ORDER BY id DESC', [teacher.school_id]),
            getAiSettings(teacher.school_id),
            getUsage(teacher.id)
        ]);

        res.json({
            assignments,
            sessions,
            terms,
            usage: {
                used,
                limit: settings.daily_teacher_limit,
                remaining: Math.max(0, settings.daily_teacher_limit - used)
            },
            ai_enabled: settings.is_enabled,
            model: settings.model
        });
    } catch (error) {
        handleControllerError(res, error, 'AI options error');
    }
};

exports.generateQuiz = async (req, res) => {
    try {
        const classId = positiveId(req.body.class_id);
        const subjectId = positiveId(req.body.subject_id);
        const sessionId = positiveId(req.body.academic_session_id);
        const termId = positiveId(req.body.term_id);
        const topic = cleanString(req.body.topic, 500);
        const difficulty = cleanString(req.body.difficulty, 30).toLowerCase();
        const questionType = cleanString(req.body.question_type, 30).toLowerCase();
        const numberOfQuestions = Number(req.body.number_of_questions);
        const durationMinutes = Math.min(240, Math.max(1, Number(req.body.duration_minutes) || 30));

        if (!classId || !subjectId || !sessionId || !termId || !topic) {
            return res.status(400).json({ error: 'Validation Error', message: 'Class, subject, topic, academic session, and term are required.' });
        }
        if (!DIFFICULTIES.has(difficulty) || !QUIZ_TYPES.has(questionType)) {
            return res.status(400).json({ error: 'Validation Error', message: 'Select a valid difficulty and question type.' });
        }
        if (!Number.isInteger(numberOfQuestions) || numberOfQuestions < 1 || numberOfQuestions > 30) {
            return res.status(400).json({ error: 'Validation Error', message: 'Number of questions must be between 1 and 30.' });
        }

        const teacher = await getTeacher(req);
        const context = await resolveAcademicContext(teacher.school_id, classId, subjectId, sessionId, termId);
        const input = {
            topic,
            difficulty,
            question_type: questionType,
            number_of_questions: numberOfQuestions,
            duration_minutes: durationMinutes
        };
        const generated = await generateQuizData(req, teacher, context, input);
        const db = getDB();
        const quizId = await db.transaction(async client => {
            const result = await client.run(
                `INSERT INTO quizzes
                    (school_id, class_id, subject_id, teacher_id, generation_id, title, topic, difficulty,
                     question_type, academic_session, term, status, duration_minutes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12)
                 RETURNING id`,
                [
                    teacher.school_id,
                    classId,
                    subjectId,
                    teacher.id,
                    generated.generationId,
                    generated.title,
                    topic,
                    difficulty,
                    questionType,
                    context.academic_session,
                    context.term,
                    durationMinutes
                ]
            );
            for (const question of generated.questions) {
                await client.run(
                    `INSERT INTO quiz_questions
                        (quiz_id, question_text, options, correct_option_index, explanation, question_type)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        result.lastID,
                        question.question_text,
                        JSON.stringify(question.options),
                        question.correct_option_index,
                        question.explanation,
                        question.question_type
                    ]
                );
            }
            return result.lastID;
        });

        res.status(201).json({
            message: 'Quiz generated as a draft. Review it before publishing.',
            quiz: await getQuizWithQuestions(quizId)
        });
    } catch (error) {
        handleControllerError(res, error, 'Generate AI quiz error');
    }
};

exports.regenerateQuiz = async (req, res) => {
    try {
        const { teacher, quiz } = await assertTeacherOwnsQuiz(req, positiveId(req.params.id));
        const db = getDB();
        const session = await db.get('SELECT id FROM academic_sessions WHERE school_id = $1 AND name = $2', [teacher.school_id, quiz.academic_session]);
        const term = await db.get('SELECT id FROM academic_terms WHERE school_id = $1 AND name = $2 AND session_id = $3', [teacher.school_id, quiz.term, session?.id]);
        if (!session || !term) {
            return res.status(400).json({ error: 'Validation Error', message: 'The quiz academic period no longer exists.' });
        }
        const context = await resolveAcademicContext(teacher.school_id, quiz.class_id, quiz.subject_id, session.id, term.id);
        const generated = await generateQuizData(req, teacher, context, {
            topic: quiz.topic,
            difficulty: quiz.difficulty || 'medium',
            question_type: quiz.question_type || 'multiple_choice',
            number_of_questions: quiz.questions.length,
            duration_minutes: quiz.duration_minutes || 30
        });

        await db.transaction(async client => {
            await client.run(
                `UPDATE quizzes
                 SET generation_id = $1, title = $2, status = 'draft', published_at = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [generated.generationId, generated.title, quiz.id]
            );
            await client.run('DELETE FROM quiz_questions WHERE quiz_id = $1', [quiz.id]);
            for (const question of generated.questions) {
                await client.run(
                    `INSERT INTO quiz_questions
                        (quiz_id, question_text, options, correct_option_index, explanation, question_type)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [quiz.id, question.question_text, JSON.stringify(question.options), question.correct_option_index, question.explanation, question.question_type]
                );
            }
        });

        res.json({ message: 'Quiz regenerated. Review the new draft.', quiz: await getQuizWithQuestions(quiz.id) });
    } catch (error) {
        handleControllerError(res, error, 'Regenerate AI quiz error');
    }
};

exports.getQuizDraft = async (req, res) => {
    try {
        const { quiz } = await assertTeacherOwnsQuiz(req, positiveId(req.params.id));
        res.json({ quiz });
    } catch (error) {
        handleControllerError(res, error, 'Get AI quiz error');
    }
};

exports.updateQuizDraft = async (req, res) => {
    try {
        const { quiz } = await assertTeacherOwnsQuiz(req, positiveId(req.params.id));
        const title = cleanString(req.body.title, 300);
        const topic = cleanString(req.body.topic, 500);
        const difficulty = cleanString(req.body.difficulty, 30).toLowerCase();
        const duration = Math.min(240, Math.max(1, Number(req.body.duration_minutes) || 30));
        const questions = normalizeQuestions(req.body.questions);
        if (!title || !topic || !DIFFICULTIES.has(difficulty)) {
            return res.status(400).json({ error: 'Validation Error', message: 'Title, topic, and valid difficulty are required.' });
        }

        const db = getDB();
        await db.transaction(async client => {
            await client.run(
                `UPDATE quizzes
                 SET title = $1, topic = $2, difficulty = $3, duration_minutes = $4,
                     status = 'draft', published_at = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5`,
                [title, topic, difficulty, duration, quiz.id]
            );
            await client.run('DELETE FROM quiz_questions WHERE quiz_id = $1', [quiz.id]);
            for (const question of questions) {
                await client.run(
                    `INSERT INTO quiz_questions
                        (quiz_id, question_text, options, correct_option_index, explanation, question_type)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [quiz.id, question.question_text, JSON.stringify(question.options), question.correct_option_index, question.explanation, question.question_type]
                );
            }
        });
        res.json({ message: 'Quiz draft saved.', quiz: await getQuizWithQuestions(quiz.id) });
    } catch (error) {
        handleControllerError(res, error, 'Update AI quiz error');
    }
};

exports.publishQuiz = async (req, res) => {
    try {
        const { quiz } = await assertTeacherOwnsQuiz(req, positiveId(req.params.id));
        if (!quiz.questions.length) {
            return res.status(400).json({ error: 'Validation Error', message: 'Add at least one question before publishing.' });
        }
        const db = getDB();
        await db.run(
            `UPDATE quizzes
             SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [quiz.id]
        );
        res.json({ message: 'Quiz published to students.', quiz: await getQuizWithQuestions(quiz.id) });
    } catch (error) {
        handleControllerError(res, error, 'Publish AI quiz error');
    }
};

exports.generateContent = async (req, res) => {
    try {
        const classId = positiveId(req.body.class_id);
        const subjectId = positiveId(req.body.subject_id);
        const sessionId = positiveId(req.body.academic_session_id);
        const termId = positiveId(req.body.term_id);
        const topic = cleanString(req.body.topic, 500);
        const contentType = cleanString(req.body.content_type, 50).toLowerCase();
        const length = cleanString(req.body.length, 20).toLowerCase();
        const tone = cleanString(req.body.tone, 30).toLowerCase();
        if (!classId || !subjectId || !sessionId || !termId || !topic) {
            return res.status(400).json({ error: 'Validation Error', message: 'Class, subject, topic, academic session, and term are required.' });
        }
        if (!CONTENT_TYPES.has(contentType) || !CONTENT_LENGTHS.has(length) || !CONTENT_TONES.has(tone)) {
            return res.status(400).json({ error: 'Validation Error', message: 'Select a valid content type, length, and tone.' });
        }

        const teacher = await getTeacher(req);
        const context = await resolveAcademicContext(teacher.school_id, classId, subjectId, sessionId, termId);
        const input = {
            topic,
            content_type: contentType,
            length,
            tone,
            include_examples: asBoolean(req.body.include_examples),
            include_assessment: asBoolean(req.body.include_assessment)
        };
        const generated = await generateContentData(req, teacher, context, input);
        const db = getDB();
        const result = await db.run(
            `INSERT INTO library_resources
                (teacher_id, school_id, class_id, subject_id, generation_id, title, content_type, body,
                 academic_session, term, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
             RETURNING id`,
            [
                teacher.id,
                teacher.school_id,
                classId,
                subjectId,
                generated.generationId,
                generated.title,
                contentType,
                generated.body,
                context.academic_session,
                context.term
            ]
        );
        res.status(201).json({
            message: 'Learning content generated as a draft. Review it before publishing.',
            resource: await getResource(result.lastID)
        });
    } catch (error) {
        handleControllerError(res, error, 'Generate AI learning content error');
    }
};

exports.regenerateContent = async (req, res) => {
    try {
        const { teacher, resource } = await assertTeacherOwnsResource(req, positiveId(req.params.id));
        const db = getDB();
        const metadataRow = await db.get('SELECT request_metadata FROM ai_generations WHERE id = $1', [resource.generation_id]);
        const metadata = metadataRow?.request_metadata ? JSON.parse(metadataRow.request_metadata) : {};
        const session = await db.get('SELECT id FROM academic_sessions WHERE school_id = $1 AND name = $2', [teacher.school_id, resource.academic_session]);
        const term = await db.get('SELECT id FROM academic_terms WHERE school_id = $1 AND name = $2 AND session_id = $3', [teacher.school_id, resource.term, session?.id]);
        if (!session || !term) {
            return res.status(400).json({ error: 'Validation Error', message: 'The resource academic period no longer exists.' });
        }
        const context = await resolveAcademicContext(teacher.school_id, resource.class_id, resource.subject_id, session.id, term.id);
        const generated = await generateContentData(req, teacher, context, {
            topic: metadata.topic || resource.title,
            content_type: resource.content_type,
            length: CONTENT_LENGTHS.has(metadata.length) ? metadata.length : 'medium',
            tone: CONTENT_TONES.has(metadata.tone) ? metadata.tone : 'professional',
            include_examples: Boolean(metadata.include_examples),
            include_assessment: Boolean(metadata.include_assessment)
        });
        await db.run(
            `UPDATE library_resources
             SET generation_id = $1, title = $2, body = $3, status = 'draft',
                 published_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [generated.generationId, generated.title, generated.body, resource.id]
        );
        res.json({ message: 'Learning content regenerated. Review the new draft.', resource: await getResource(resource.id) });
    } catch (error) {
        handleControllerError(res, error, 'Regenerate AI content error');
    }
};

exports.getContentDraft = async (req, res) => {
    try {
        const { resource } = await assertTeacherOwnsResource(req, positiveId(req.params.id));
        res.json({ resource });
    } catch (error) {
        handleControllerError(res, error, 'Get AI resource error');
    }
};

exports.updateContentDraft = async (req, res) => {
    try {
        const { resource } = await assertTeacherOwnsResource(req, positiveId(req.params.id));
        const title = cleanString(req.body.title, 300);
        const body = cleanString(req.body.body, 100000);
        const contentType = cleanString(req.body.content_type || resource.content_type, 50);
        if (!title || body.length < 20 || !CONTENT_TYPES.has(contentType)) {
            return res.status(400).json({ error: 'Validation Error', message: 'A title, valid content type, and document body are required.' });
        }
        const db = getDB();
        await db.run(
            `UPDATE library_resources
             SET title = $1, body = $2, content_type = $3, status = 'draft',
                 published_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [title, body, contentType, resource.id]
        );
        res.json({ message: 'Learning content draft saved.', resource: await getResource(resource.id) });
    } catch (error) {
        handleControllerError(res, error, 'Update AI resource error');
    }
};

exports.publishContent = async (req, res) => {
    try {
        const { resource } = await assertTeacherOwnsResource(req, positiveId(req.params.id));
        const db = getDB();
        await db.run(
            `UPDATE library_resources
             SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [resource.id]
        );
        res.json({ message: 'Learning content published to the library.', resource: await getResource(resource.id) });
    } catch (error) {
        handleControllerError(res, error, 'Publish AI resource error');
    }
};

exports.deleteContent = async (req, res) => {
    try {
        const { resource } = await assertTeacherOwnsResource(req, positiveId(req.params.id));
        const db = getDB();
        await db.run('DELETE FROM library_resources WHERE id = $1', [resource.id]);
        res.json({ message: 'EduMan AI learning content deleted.' });
    } catch (error) {
        handleControllerError(res, error, 'Delete AI resource error');
    }
};

exports.getMyDrafts = async (req, res) => {
    try {
        const db = getDB();
        const teacher = await getTeacher(req);
        const [quizzes, resources] = await Promise.all([
            db.all(
                `SELECT q.id, q.title, q.topic, q.difficulty, q.status, q.updated_at,
                        c.name AS class_name, s.name AS subject_name,
                        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count
                 FROM quizzes q
                 JOIN classes c ON c.id = q.class_id
                 JOIN subjects s ON s.id = q.subject_id
                 WHERE q.teacher_id = $1 AND q.school_id = $2 AND q.generation_id IS NOT NULL AND q.status = 'draft'
                 ORDER BY q.updated_at DESC`,
                [teacher.id, teacher.school_id]
            ),
            db.all(
                `SELECT lr.id, lr.title, lr.content_type, lr.status, lr.updated_at,
                        c.name AS class_name, s.name AS subject_name
                 FROM library_resources lr
                 JOIN classes c ON c.id = lr.class_id
                 JOIN subjects s ON s.id = lr.subject_id
                 WHERE lr.teacher_id = $1 AND lr.school_id = $2 AND lr.status = 'draft'
                 ORDER BY lr.updated_at DESC`,
                [teacher.id, teacher.school_id]
            )
        ]);
        res.json({ quizzes, resources });
    } catch (error) {
        handleControllerError(res, error, 'Get AI drafts error');
    }
};

exports.getMyPublished = async (req, res) => {
    try {
        const db = getDB();
        const teacher = await getTeacher(req);
        const [quizzes, resources] = await Promise.all([
            db.all(
                `SELECT q.id, q.title, q.topic, q.difficulty, q.status, q.published_at,
                        c.name AS class_name, s.name AS subject_name,
                        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count
                 FROM quizzes q
                 JOIN classes c ON c.id = q.class_id
                 JOIN subjects s ON s.id = q.subject_id
                 WHERE q.teacher_id = $1 AND q.school_id = $2 AND q.generation_id IS NOT NULL AND q.status = 'published'
                 ORDER BY q.published_at DESC`,
                [teacher.id, teacher.school_id]
            ),
            db.all(
                `SELECT lr.*, c.name AS class_name, s.name AS subject_name
                 FROM library_resources lr
                 JOIN classes c ON c.id = lr.class_id
                 JOIN subjects s ON s.id = lr.subject_id
                 WHERE lr.teacher_id = $1 AND lr.school_id = $2 AND lr.status = 'published'
                 ORDER BY lr.published_at DESC`,
                [teacher.id, teacher.school_id]
            )
        ]);
        res.json({ quizzes, resources });
    } catch (error) {
        handleControllerError(res, error, 'Get published AI resources error');
    }
};

exports.getPublishedLibrary = async (req, res) => {
    try {
        const db = getDB();
        const schoolId = req.user.school_id;
        const params = [schoolId];
        let query = `
            SELECT lr.*, c.name AS class_name, s.name AS subject_name, u.name AS teacher_name,
                   t.user_id AS teacher_user_id
            FROM library_resources lr
            JOIN classes c ON c.id = lr.class_id
            JOIN subjects s ON s.id = lr.subject_id
            JOIN teachers t ON t.id = lr.teacher_id
            JOIN users u ON u.id = t.user_id
            WHERE lr.school_id = $1 AND lr.status = 'published'
        `;
        if (req.user.role === 'Student') {
            const student = await db.get('SELECT class_id FROM students WHERE user_id = $1 AND school_id = $2', [req.user.id, schoolId]);
            if (!student) return res.status(403).json({ error: 'Forbidden', message: 'Student profile not found.' });
            params.push(student.class_id);
            query += ` AND lr.class_id = $${params.length}`;
        }
        query += ' ORDER BY lr.published_at DESC';
        const resources = await db.all(query, params);
        res.json({ resources });
    } catch (error) {
        handleControllerError(res, error, 'Get AI library error');
    }
};

async function canAccessResource(req, resource) {
    if (!resource || resource.school_id !== req.user.school_id) return false;
    if (req.user.role === 'SchoolAdmin') return true;
    if (req.user.role === 'Teacher') {
        const teacher = await getTeacher(req);
        return resource.teacher_id === teacher.id || resource.status === 'published';
    }
    if (req.user.role === 'Student') {
        const db = getDB();
        const student = await db.get('SELECT class_id FROM students WHERE user_id = $1 AND school_id = $2', [req.user.id, req.user.school_id]);
        return resource.status === 'published' && Number(student?.class_id) === Number(resource.class_id);
    }
    return resource.status === 'published';
}

exports.viewLibraryResource = async (req, res) => {
    try {
        const resource = await getResource(positiveId(req.params.id));
        if (!await canAccessResource(req, resource)) {
            return res.status(404).json({ error: 'Not Found', message: 'Learning resource not found.' });
        }
        res.json({ resource });
    } catch (error) {
        handleControllerError(res, error, 'View AI resource error');
    }
};

exports.downloadResource = async (req, res) => {
    try {
        const resource = await getResource(positiveId(req.params.id));
        if (!await canAccessResource(req, resource)) {
            return res.status(404).json({ error: 'Not Found', message: 'Learning resource not found.' });
        }
        const format = cleanString(req.query.format, 10).toLowerCase();
        if (format === 'pdf') return sendPdf(res, resource);
        if (format === 'docx') return sendDocx(res, resource);
        return res.status(400).json({ error: 'Validation Error', message: 'Download format must be pdf or docx.' });
    } catch (error) {
        if (res.headersSent) return res.end();
        handleControllerError(res, error, 'Download AI resource error');
    }
};

function getAdminSchoolId(req) {
    if (req.user.role === 'SchoolAdmin') return req.user.school_id;
    return positiveId(req.query.school_id || req.body.school_id);
}

exports.getAdminOverview = async (req, res) => {
    try {
        const db = getDB();
        const schoolId = getAdminSchoolId(req);
        if (!schoolId) return res.status(400).json({ error: 'Validation Error', message: 'A school is required.' });
        const [today, total, failed, drafts, published, settings] = await Promise.all([
            db.get('SELECT COUNT(*) AS count FROM ai_generations WHERE school_id = $1 AND created_at >= CURRENT_DATE', [schoolId]),
            db.get('SELECT COUNT(*) AS count FROM ai_generations WHERE school_id = $1', [schoolId]),
            db.get("SELECT COUNT(*) AS count FROM ai_generations WHERE school_id = $1 AND status = 'failed'", [schoolId]),
            db.get(
                `SELECT
                    (SELECT COUNT(*) FROM quizzes WHERE school_id = $1 AND generation_id IS NOT NULL AND status = 'draft') +
                    (SELECT COUNT(*) FROM library_resources WHERE school_id = $1 AND status = 'draft') AS count`,
                [schoolId]
            ),
            db.get(
                `SELECT
                    (SELECT COUNT(*) FROM quizzes WHERE school_id = $1 AND generation_id IS NOT NULL AND status = 'published') +
                    (SELECT COUNT(*) FROM library_resources WHERE school_id = $1 AND status = 'published') AS count`,
                [schoolId]
            ),
            getAiSettings(schoolId)
        ]);
        res.json({
            overview: {
                today: Number(today.count || 0),
                total: Number(total.count || 0),
                failed: Number(failed.count || 0),
                drafts: Number(drafts.count || 0),
                published: Number(published.count || 0)
            },
            settings: {
                ...settings,
                api_key_configured: Boolean(process.env.OPENROUTER_API_KEY)
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'AI admin overview error');
    }
};

exports.getUsageLogs = async (req, res) => {
    try {
        const db = getDB();
        const schoolId = getAdminSchoolId(req);
        if (!schoolId) return res.status(400).json({ error: 'Validation Error', message: 'A school is required.' });
        const status = cleanString(req.query.status, 30);
        const generationType = cleanString(req.query.generation_type, 50);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const params = [schoolId];
        let query = `
            SELECT ag.*, u.name AS teacher_name, u.email AS teacher_email,
                   c.name AS class_name, s.name AS subject_name
            FROM ai_generations ag
            JOIN teachers t ON t.id = ag.teacher_id
            JOIN users u ON u.id = t.user_id
            JOIN classes c ON c.id = ag.class_id
            JOIN subjects s ON s.id = ag.subject_id
            WHERE ag.school_id = $1
        `;
        if (status) {
            params.push(status);
            query += ` AND ag.status = $${params.length}`;
        }
        if (generationType) {
            params.push(generationType);
            query += ` AND ag.generation_type = $${params.length}`;
        }
        params.push(limit);
        query += ` ORDER BY ag.created_at DESC LIMIT $${params.length}`;
        const logs = await db.all(query, params);
        res.json({ logs });
    } catch (error) {
        handleControllerError(res, error, 'AI usage logs error');
    }
};

exports.getAdminSettings = async (req, res) => {
    try {
        const schoolId = getAdminSchoolId(req);
        if (!schoolId) return res.status(400).json({ error: 'Validation Error', message: 'A school is required.' });
        const settings = await getAiSettings(schoolId);
        res.json({
            settings: {
                ...settings,
                api_key_configured: Boolean(process.env.OPENROUTER_API_KEY)
            }
        });
    } catch (error) {
        handleControllerError(res, error, 'Get AI settings error');
    }
};

exports.updateAdminSettings = async (req, res) => {
    try {
        const db = getDB();
        const schoolId = getAdminSchoolId(req);
        const model = cleanString(req.body.model, 200);
        const dailyLimit = Number(req.body.daily_teacher_limit);
        const isEnabled = asBoolean(req.body.is_enabled) ? 1 : 0;
        if (!schoolId || !model || !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 500) {
            return res.status(400).json({ error: 'Validation Error', message: 'Model and a daily limit between 1 and 500 are required.' });
        }
        const school = await db.get('SELECT id FROM schools WHERE id = $1', [schoolId]);
        if (!school) return res.status(404).json({ error: 'Not Found', message: 'School not found.' });

        await db.run(
            `INSERT INTO ai_settings (school_id, model, daily_teacher_limit, is_enabled, updated_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (school_id) DO UPDATE SET
                model = EXCLUDED.model,
                daily_teacher_limit = EXCLUDED.daily_teacher_limit,
                is_enabled = EXCLUDED.is_enabled,
                updated_by = EXCLUDED.updated_by,
                updated_at = CURRENT_TIMESTAMP`,
            [schoolId, model, dailyLimit, isEnabled, req.user.id]
        );
        res.json({ message: 'EduMan AI settings updated.', settings: await getAiSettings(schoolId) });
    } catch (error) {
        handleControllerError(res, error, 'Update AI settings error');
    }
};
