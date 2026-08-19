-- Migration 006: SuperAdmin Role Hardening & Platform Expansion

-- 1. Explicit School Lifecycle Columns
ALTER TABLE schools ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS suspended_by INTEGER REFERENCES users(id);

-- 2. Explicit User Security & Session Revocation Columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1;

-- 3. SuperAdmin Append-Only Audit Logs Table
CREATE TABLE IF NOT EXISTS superadmin_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    details TEXT,
    reason TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Platform Non-Secret Settings Table
CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_user ON superadmin_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);
