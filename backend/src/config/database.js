const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
let usingMemoryDb = false;

function createPostgresPool() {
    if (!connectionString) return null;

    return new Pool({
        connectionString,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 60000,
        keepAlive: true
    });
}

function createMemoryPool() {
    const { newDb } = require('pg-mem');
    const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
    const adapter = memoryDb.adapters.createPg();
    usingMemoryDb = true;
    return new adapter.Pool();
}

let pool = createPostgresPool();

if (!pool) {
    if (isProduction) {
        console.error('CRITICAL ERROR: DATABASE_URL environment variable is missing.');
        console.error('The application cannot start in production without a valid PostgreSQL connection string.');
        process.exit(1);
    }

    console.warn('DATABASE_URL is missing. Using an in-memory database for local development.');
    pool = createMemoryPool();
}

// Prevent Node process from crashing on idle client errors
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

const schemaPath = path.join(__dirname, '../models/schema.sql');

async function runSqlScript(sql) {
    const statements = sql
        .split(';')
        .map(statement => statement.trim())
        .filter(Boolean);

    for (const statement of statements) {
        if (
            usingMemoryDb &&
            statement.includes('DELETE FROM teacher_subject_assignments') &&
            statement.includes('GROUP BY teacher_id, class_id, subject_id')
        ) {
            continue;
        }

        if (
            usingMemoryDb &&
            statement.includes('DELETE FROM teacher_classes') &&
            statement.includes('GROUP BY teacher_id, class_id, school_id')
        ) {
            continue;
        }

        await pool.query(statement);
    }
}

// Database helper wrapping pg Pool for convenience
const db = {
    query: (text, params) => pool.query(text, params),

    // Returns first row
    get: async (text, params) => {
        const res = await pool.query(text, params);
        return res.rows[0];
    },

    // Returns all rows
    all: async (text, params) => {
        const res = await pool.query(text, params);
        return res.rows;
    },

    // Returns { lastID, changes }
    run: async (text, params) => {
        const res = await pool.query(text, params);
        return {
            lastID: res.rows[0]?.id || null,
            changes: res.rowCount
        };
    },

    // Execute raw SQL
    exec: async (text) => {
        return pool.query(text);
    },

    /**
     * Run a function inside a proper PostgreSQL transaction using a dedicated client.
     * Usage:
     *   await db.transaction(async (client) => {
     *       await client.query('INSERT INTO ...', [...]);
     *       await client.query('UPDATE ...', [...]);
     *   });
     */
    transaction: async (fn) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Provide helper methods on the client matching the db interface
            client.get = async (text, params) => {
                const res = await client.query(text, params);
                return res.rows[0];
            };
            client.all = async (text, params) => {
                const res = await client.query(text, params);
                return res.rows;
            };
            client.run = async (text, params) => {
                const res = await client.query(text, params);
                return {
                    lastID: res.rows[0]?.id || null,
                    changes: res.rowCount
                };
            };

            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
};

const MAX_RETRIES = 5;

async function initDB(retryCount = 0) {
    try {
        console.log(`Attempting to connect to ${usingMemoryDb ? 'in-memory PostgreSQL' : 'PostgreSQL'}...`);

        // Test connection
        const testRes = await pool.query('SELECT NOW()');
        console.log(`Successfully connected to ${usingMemoryDb ? 'in-memory PostgreSQL' : 'PostgreSQL'} at ${testRes.rows[0].now}`);

        // Run schema
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await runSqlScript(schema);
            console.log('Database schema synchronized successfully.');

            // ── Safe incremental schema patches (idempotent) ──
            try {
                await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1");
                await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
            } catch (patchErr) {
                // Column may already exist – safe to continue
                console.log('Schema patch (users columns) skipped or already applied.');
            }
            try {
                await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS uq_saa_user_school ON school_admin_assignments (user_id, school_id)");
            } catch (patchErr) {
                console.log('Schema patch (school_admin_assignments unique index) skipped or already applied.');
            }
            // ── Form Teacher column on classes ──
            try {
                await pool.query("ALTER TABLE classes ADD COLUMN IF NOT EXISTS form_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL");
                console.log('Schema patch (classes.form_teacher_id) applied.');
            } catch (patchErr) {
                console.log('Schema patch (classes.form_teacher_id) skipped or already applied.');
            }
            // Announcement attachments
            try {
                await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(500)");
                await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS featured_image_public_id TEXT");
                await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_public_id TEXT");
                await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255)");
                await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(30)");
                await pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(120)");
                console.log('Schema patch (announcement attachments) applied.');
            } catch (patchErr) {
                console.log('Schema patch (announcement attachments) skipped or already applied.', patchErr.message);
            }
            // School profile, gender, report metadata, and class-info tables
            try {
                await pool.query("ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url TEXT");
                await pool.query("ALTER TABLE schools ADD COLUMN IF NOT EXISTS motto TEXT");
                await pool.query("ALTER TABLE schools ADD COLUMN IF NOT EXISTS website TEXT");
                await pool.query("ALTER TABLE schools ADD COLUMN IF NOT EXISTS principal_name TEXT");
                await pool.query("ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_type TEXT");
                await pool.query("ALTER TABLE schools ADD COLUMN IF NOT EXISTS city TEXT");
                await pool.query("ALTER TABLE schools ADD COLUMN IF NOT EXISTS state TEXT");
                await pool.query("ALTER TABLE schools ADD COLUMN IF NOT EXISTS country TEXT");
                await pool.query("ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_public_id TEXT");
                await pool.query("ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS file_public_id TEXT");
                await pool.query("ALTER TABLE homework ADD COLUMN IF NOT EXISTS file_public_id TEXT");
                await pool.query("ALTER TABLE homework_submissions ADD COLUMN IF NOT EXISTS file_public_id TEXT");
                await pool.query("ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_public_id TEXT");
                await pool.query("ALTER TABLE teachers ADD COLUMN IF NOT EXISTS gender TEXT");
                await pool.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS age INTEGER");
                await pool.query("ALTER TABLE assessments ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL");
                await pool.query("ALTER TABLE assessments ADD COLUMN IF NOT EXISTS academic_session TEXT");
                await pool.query("ALTER TABLE assessments ADD COLUMN IF NOT EXISTS term TEXT");
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS timetables (
                        id SERIAL PRIMARY KEY,
                        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                        day_of_week TEXT NOT NULL,
                        start_time TIME NOT NULL,
                        end_time TIME NOT NULL,
                        subject TEXT NOT NULL,
                        room TEXT,
                        notes TEXT,
                        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS class_announcements (
                        id SERIAL PRIMARY KEY,
                        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        message TEXT NOT NULL,
                        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS class_events (
                        id SERIAL PRIMARY KEY,
                        school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        event_date DATE NOT NULL,
                        description TEXT,
                        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                await pool.query("CREATE INDEX IF NOT EXISTS idx_timetables_school_class ON timetables (school_id, class_id)");
                await pool.query("CREATE INDEX IF NOT EXISTS idx_class_announcements_school_class ON class_announcements (school_id, class_id)");
                await pool.query("CREATE INDEX IF NOT EXISTS idx_class_events_school_class_date ON class_events (school_id, class_id, event_date)");
                await pool.query(`
                    UPDATE assessments a
                    SET
                        session_id = COALESCE(a.session_id, at.session_id),
                        academic_session = COALESCE(a.academic_session, acs.name),
                        term = COALESCE(a.term, at.name)
                    FROM academic_terms at
                    JOIN academic_sessions acs ON acs.id = at.session_id
                    WHERE a.term_id = at.id
                `);
                console.log('Schema patch (profile/report/class-info) applied.');
            } catch (patchErr) {
                console.log('Schema patch (profile/report/class-info) skipped or already applied.', patchErr.message);
            }
            // ── Quiz attempt answers table for review feature ──
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
                        id SERIAL PRIMARY KEY,
                        attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
                        question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
                        selected_option_index INTEGER
                    )
                `);
                await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS uq_qaa_attempt_question ON quiz_attempt_answers (attempt_id, question_id)");
                console.log('Schema patch (quiz_attempt_answers) applied.');
            } catch (patchErr) {
                console.log('Schema patch (quiz_attempt_answers) skipped or already applied.');
            }
            // EduMan AI tables and backwards-compatible quiz fields
            try {
                await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS generation_id INTEGER REFERENCES ai_generations(id) ON DELETE SET NULL");
                await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS topic TEXT");
                await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS difficulty TEXT");
                await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS question_type TEXT");
                await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS academic_session TEXT");
                await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS term TEXT");
                await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'");
                await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
                await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
                await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS published_at TIMESTAMP");
                await pool.query("UPDATE quizzes SET status = 'published' WHERE status IS NULL");
                await pool.query("ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS explanation TEXT");
                await pool.query("ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'multiple_choice'");
                await pool.query("UPDATE quiz_questions SET question_type = 'multiple_choice' WHERE question_type IS NULL");
                await pool.query("CREATE INDEX IF NOT EXISTS idx_ai_generations_teacher_created ON ai_generations (teacher_id, created_at)");
                await pool.query("CREATE INDEX IF NOT EXISTS idx_ai_generations_school_created ON ai_generations (school_id, created_at)");
                await pool.query("CREATE INDEX IF NOT EXISTS idx_quizzes_status_class ON quizzes (status, class_id)");
                await pool.query("CREATE INDEX IF NOT EXISTS idx_library_resources_status_class ON library_resources (status, class_id)");
                console.log('Schema patch (EduMan AI) applied.');
            } catch (patchErr) {
                console.log('Schema patch (EduMan AI) skipped or already applied.', patchErr.message);
            }
            // Support Center tables patch
            try {
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS support_threads (
                        id SERIAL PRIMARY KEY,
                        ticket_number TEXT UNIQUE NOT NULL,
                        school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        subject TEXT NOT NULL,
                        category TEXT NOT NULL,
                        priority TEXT NOT NULL DEFAULT 'MEDIUM',
                        status TEXT NOT NULL DEFAULT 'OPEN',
                        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        last_reply_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        first_response_at TIMESTAMP,
                        closed_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        ai_summary TEXT,
                        ai_suggested_reply TEXT,
                        ai_sentiment TEXT,
                        ai_priority_score REAL,
                        ai_category_score REAL,
                        ai_resolution TEXT,
                        ai_duplicate_id INTEGER,
                        ai_metadata TEXT
                    );
                    CREATE TABLE IF NOT EXISTS support_messages (
                        id SERIAL PRIMARY KEY,
                        thread_id INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
                        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        message TEXT NOT NULL,
                        is_internal INTEGER DEFAULT 0,
                        mentions TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS support_attachments (
                        id SERIAL PRIMARY KEY,
                        message_id INTEGER NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
                        file_name TEXT NOT NULL,
                        file_url TEXT NOT NULL,
                        file_type TEXT NOT NULL,
                        file_size INTEGER NOT NULL,
                        public_id TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS support_assignments (
                        id SERIAL PRIMARY KEY,
                        thread_id INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
                        assigned_from INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        reason TEXT,
                        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS support_tags (
                        id SERIAL PRIMARY KEY,
                        name TEXT UNIQUE NOT NULL,
                        color TEXT DEFAULT '#3B82F6'
                    );
                    CREATE TABLE IF NOT EXISTS support_thread_tags (
                        thread_id INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
                        tag_id INTEGER NOT NULL REFERENCES support_tags(id) ON DELETE CASCADE,
                        PRIMARY KEY(thread_id, tag_id)
                    );
                    CREATE TABLE IF NOT EXISTS support_canned_responses (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        category TEXT,
                        content TEXT NOT NULL,
                        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS support_feedback (
                        id SERIAL PRIMARY KEY,
                        thread_id INTEGER UNIQUE NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        rating INTEGER NOT NULL,
                        comment TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS support_watchers (
                        id SERIAL PRIMARY KEY,
                        thread_id INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(thread_id, user_id)
                    );
                    CREATE TABLE IF NOT EXISTS knowledge_base_articles (
                        id SERIAL PRIMARY KEY,
                        title TEXT NOT NULL,
                        slug TEXT UNIQUE NOT NULL,
                        category TEXT NOT NULL,
                        content TEXT NOT NULL,
                        featured_image TEXT,
                        published INTEGER DEFAULT 0,
                        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        views INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS support_activity_logs (
                        id SERIAL PRIMARY KEY,
                        thread_id INTEGER NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
                        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        action TEXT NOT NULL,
                        details TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE TABLE IF NOT EXISTS support_bookmarks (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        article_id INTEGER NOT NULL REFERENCES knowledge_base_articles(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, article_id)
                    );
                    CREATE TABLE IF NOT EXISTS notifications (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        message TEXT NOT NULL,
                        type TEXT NOT NULL DEFAULT 'support',
                        link TEXT,
                        is_read INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                console.log('Schema patch (Support Center) applied.');
            } catch (patchErr) {
                console.log('Schema patch (Support Center) skipped or already applied.', patchErr.message);
            }
        } else {
            console.warn('Warning: schema.sql not found at', schemaPath);
        }

        if (usingMemoryDb) {
            const { seed } = require('../../seed');
            await seed(pool, { closePool: false, resetPasswords: true });
        }

        // Seed SuperAdmin only if none exists (do NOT reset password on every restart)
        const adminRes = await db.get("SELECT id FROM users WHERE role = $1 LIMIT 1", ['SuperAdmin']);

        if (!adminRes) {
            const superAdminEmail = process.env.SUPERADMIN_EMAIL || (isProduction ? null : 'admin@eduman.local');
            const superAdminPassword = process.env.SUPERADMIN_PASSWORD || (isProduction ? null : 'ASDFGHJKL');

            if (isProduction && (!superAdminEmail || !superAdminPassword)) {
                console.warn('Production Notice: No SuperAdmin account exists yet. Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD environment variables to automatically seed initial SuperAdmin account.');
            } else if (superAdminEmail && superAdminPassword) {
                const hash = await bcrypt.hash(superAdminPassword, 10);
                console.log(`No SuperAdmin found. Seeding initial SuperAdmin account (${superAdminEmail})...`);
                await pool.query(
                    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
                    ['System Admin', superAdminEmail, hash, 'SuperAdmin']
                );
                console.log(`Initial SuperAdmin account created successfully for ${superAdminEmail}.`);
            }
        } else {
            console.log('SuperAdmin account already exists — no changes made.');
        }

        return db;
    } catch (error) {
        if (!usingMemoryDb && !isProduction) {
            console.warn(`PostgreSQL connection failed (${error.message || error.code || 'unknown error'}). Falling back to in-memory database.`);
            await pool.end().catch(() => {});
            pool = createMemoryPool();
            return initDB(retryCount);
        }

        console.error('DATABASE CONNECTION ERROR:', error.message);

        if (isProduction && retryCount < MAX_RETRIES) {
            const delay = Math.min(5000 * Math.pow(2, retryCount), 60000); // exponential backoff, max 60s
            console.log(`Retrying database connection in ${delay / 1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return initDB(retryCount + 1);
        }

        throw error;
    }
}

function getDB() {
    return db;
}

async function closeDB() {
    await pool.end();
}

module.exports = {
    initDB,
    getDB,
    closeDB,
    get pool() {
        return pool;
    }
};
