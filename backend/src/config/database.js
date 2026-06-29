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
            const defaultPassword = process.env.SUPERADMIN_PASSWORD || 'ASDFGHJKL';
            const hash = await bcrypt.hash(defaultPassword, 10);
            console.log('No SuperAdmin found. Seeding default SuperAdmin...');
            await pool.query(
                'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
                ['Default Admin', 'admin@eduman.local', hash, 'SuperAdmin']
            );
            console.log('Default SuperAdmin created (admin@eduman.local). Password set from SUPERADMIN_PASSWORD env var.');
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
