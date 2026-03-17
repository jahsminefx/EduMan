const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const schemaPath = path.join(__dirname, '../models/schema.sql');

// Singleton wrapper to mimic some sqlite-like behavior for easier migration
const db = {
    query: (text, params) => pool.query(text, params),
    
    // Shim for sqlite 'get' (returns first row)
    get: async (text, params) => {
        // Convert ? to $1, $2 if present (simple regex replacement for transition)
        let n = 1;
        const processedText = text.replace(/\?/g, () => `$${n++}`);
        const res = await pool.query(processedText, params);
        return res.rows[0];
    },
    
    // Shim for sqlite 'all' (returns all rows)
    all: async (text, params) => {
        let n = 1;
        const processedText = text.replace(/\?/g, () => `$${n++}`);
        const res = await pool.query(processedText, params);
        return res.rows;
    },
    
    // Shim for sqlite 'run' (returns result with lastID/changes)
    run: async (text, params) => {
        let n = 1;
        // Postgres uses RETURNING id to get lastID, but for now we shim the execution
        const processedText = text.replace(/\?/g, () => `$${n++}`);
        const res = await pool.query(processedText, params);
        return {
            lastID: res.rows[0]?.id || null, // Assumes use of RETURNING id in queries later
            changes: res.rowCount
        };
    },
    
    // Shim for exec
    exec: async (text) => {
        return pool.query(text);
    }
};

async function initDB() {
    try {
        console.log('Connecting to PostgreSQL database...');
        
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('Connected to PostgreSQL.');

        // Run schema
        const schema = fs.readFileSync(schemaPath, 'utf8');
        // Simple regex to convert SQLite specific parts to Postgres if they were missed in manual update
        const postgresSchema = schema
            .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
            .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
            .replace(/DATETIME/gi, 'TIMESTAMP')
            .replace(/DATE/gi, 'DATE');

        await pool.query(postgresSchema);
        console.log('Schema synchronized.');

        // Seed SuperAdmin if not exists
        const adminRes = await db.get("SELECT id FROM users WHERE role = $1 LIMIT 1", ['SuperAdmin']);
        if (!adminRes) {
            console.log('No SuperAdmin found. Seeding default SuperAdmin...');
            const hash = await bcrypt.hash('password123', 10);
            await pool.query(
                'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
                ['Default Admin', 'admin@eduman.local', hash, 'SuperAdmin']
            );
            console.log('Default SuperAdmin created.');
        }

        return db;
    } catch (error) {
        console.error('Database initialization failed:', error);
        // Retry logic for cloud environments
        if (process.env.NODE_ENV === 'production') {
            console.log('Retrying connection in 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            return initDB();
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
