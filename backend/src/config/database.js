const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs'); // Using bcryptjs for broader compatibility
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('CRITICAL ERROR: DATABASE_URL environment variable is missing.');
    console.error('The application cannot start without a valid PostgreSQL connection string.');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    // Render often requires SSL for database connections
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Basic pool settings for reliability
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
});

const schemaPath = path.join(__dirname, '../models/schema.sql');

// Singleton wrapper to mimic some sqlite-like behavior for easier migration
const db = {
    query: (text, params) => pool.query(text, params),
    
    // Shim for sqlite 'get' (returns first row)
    get: async (text, params) => {
        const res = await pool.query(text, params);
        return res.rows[0];
    },
    
    // Shim for sqlite 'all' (returns all rows)
    all: async (text, params) => {
        const res = await pool.query(text, params);
        return res.rows;
    },
    
    // Shim for sqlite 'run' (returns result with lastID/changes)
    run: async (text, params) => {
        const res = await pool.query(text, params);
        return {
            lastID: res.rows[0]?.id || null, 
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
        console.log('Attempting to connect to PostgreSQL...');
        
        // Test connection
        const testRes = await pool.query('SELECT NOW()');
        console.log(`Successfully connected to PostgreSQL at ${testRes.rows[0].now}`);

        // Run schema
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await pool.query(schema);
            console.log('Database schema synchronized successfully.');
        } else {
            console.warn('Warning: schema.sql not found at', schemaPath);
        }

        // Seed or Update SuperAdmin
        const adminRes = await db.get("SELECT id FROM users WHERE role = $1 LIMIT 1", ['SuperAdmin']);
        const newPassword = 'ASDFGHJKL';
        const hash = await bcrypt.hash(newPassword, 10);
        
        if (!adminRes) {
            console.log('No SuperAdmin found. Seeding default SuperAdmin...');
            await pool.query(
                'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
                ['Default Admin', 'admin@eduman.local', hash, 'SuperAdmin']
            );
            console.log(`Default SuperAdmin created (admin@eduman.local / ${newPassword}).`);
        } else {
            // Force update password for the existing SuperAdmin to ensure the user's request is applied
            await pool.query(
                'UPDATE users SET password_hash = $1 WHERE role = $2',
                [hash, 'SuperAdmin']
            );
            console.log(`SuperAdmin password updated to ${newPassword}.`);
        }

        return db;
    } catch (error) {
        console.error('DATABASE CONNECTION ERROR:', error.message);
        
        // Retry logic for production
        if (process.env.NODE_ENV === 'production') {
            console.log('Retrying database connection in 5 seconds...');
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
