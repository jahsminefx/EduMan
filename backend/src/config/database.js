const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('CRITICAL ERROR: DATABASE_URL environment variable is missing.');
    console.error('The application cannot start without a valid PostgreSQL connection string.');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 10000, // Reduced from 30s to 10s to drop idle connections cleanly
    connectionTimeoutMillis: 60000, // INCREASED to 60 seconds specifically for free Render DB cold starts!
    keepAlive: true
});

// Prevent Node process from crashing on idle client errors
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

const schemaPath = path.join(__dirname, '../models/schema.sql');

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
        console.log('Attempting to connect to PostgreSQL...');

        // Test connection
        const testRes = await pool.query('SELECT NOW()');
        console.log(`Successfully connected to PostgreSQL at ${testRes.rows[0].now}`);

        // Run schema
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await pool.query(schema);
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
        } else {
            console.warn('Warning: schema.sql not found at', schemaPath);
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
        console.error('DATABASE CONNECTION ERROR:', error.message);

        if (process.env.NODE_ENV === 'production' && retryCount < MAX_RETRIES) {
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

module.exports = {
    initDB,
    getDB,
    pool
};
