const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, '../../database/eduman_v2.db');
const schemaPath = path.join(__dirname, '../models/schema.sql');

// Singleton db instance
let dbInstance = null;

async function initDB() {
    if (dbInstance) return dbInstance;

    try {
        dbInstance = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        console.log('Connected to SQLite database.');

        // Enable foreign keys
        await dbInstance.exec('PRAGMA foreign_keys = ON;');

        // Run migrations/schema
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await dbInstance.exec(schema);

        console.log('Schema synchronized.');

        // Check if there is a SuperAdmin
        const adminExt = await dbInstance.get("SELECT id FROM users WHERE role = 'SuperAdmin' LIMIT 1");
        if (!adminExt) {
            console.log('No SuperAdmin found. Seeding default SuperAdmin...');
            const hash = await bcrypt.hash('password123', 10);
            await dbInstance.run(
                'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                ['Default Admin', 'admin@eduman.local', hash, 'SuperAdmin']
            );
            console.log('Default SuperAdmin created: admin@eduman.local / password123');
        }

        return dbInstance;
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

// Helper to get db instance
function getDB() {
    if (!dbInstance) throw new Error("Database not initialized. Call initDB first.");
    return dbInstance;
}

module.exports = {
    initDB,
    getDB
};
