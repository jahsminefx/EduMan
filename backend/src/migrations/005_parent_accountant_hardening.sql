-- Migration 005: Parent & Accountant Role Hardening & Feature Expansion

-- 1. Extend parent_student_links table
ALTER TABLE parent_student_links ADD COLUMN IF NOT EXISTS relationship TEXT DEFAULT 'Parent';
ALTER TABLE parent_student_links ADD COLUMN IF NOT EXISTS is_primary INTEGER DEFAULT 1;
ALTER TABLE parent_student_links ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Invitation & Password Setup columns on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token_expires TIMESTAMP;

-- Clean up pre-existing duplicate links before applying unique constraint (keeps earliest link)
DELETE FROM parent_student_links a
USING parent_student_links b
WHERE a.id > b.id
  AND a.parent_user_id = b.parent_user_id
  AND a.student_id = b.student_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_parent_student_link ON parent_student_links (parent_user_id, student_id);

-- 2. Fee Structures Table
CREATE TABLE IF NOT EXISTS fee_structures (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    academic_session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL,
    term_id INTEGER REFERENCES academic_terms(id) ON DELETE SET NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    description TEXT,
    due_date DATE,
    status TEXT DEFAULT 'ACTIVE',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Student Fee Invoices Table
CREATE TABLE IF NOT EXISTS student_fee_invoices (
    id SERIAL PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES academic_sessions(id) ON DELETE SET NULL,
    term_id INTEGER REFERENCES academic_terms(id) ON DELETE SET NULL,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    outstanding_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ISSUED',
    due_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Invoice Line Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES student_fee_invoices(id) ON DELETE CASCADE,
    fee_structure_id INTEGER REFERENCES fee_structures(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL
);

-- 5. Fee Payments Table
CREATE TABLE IF NOT EXISTS fee_payments (
    id SERIAL PRIMARY KEY,
    payment_reference TEXT UNIQUE NOT NULL,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    invoice_id INTEGER NOT NULL REFERENCES student_fee_invoices(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    payer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'VERIFIED',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Fee Discounts Table
CREATE TABLE IF NOT EXISTS fee_discounts (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES student_fee_invoices(id) ON DELETE CASCADE,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    discount_amount NUMERIC(12,2) NOT NULL,
    reason TEXT NOT NULL,
    applied_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Fee Refunds Table
CREATE TABLE IF NOT EXISTS fee_refunds (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL REFERENCES fee_payments(id) ON DELETE CASCADE,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    refund_amount NUMERIC(12,2) NOT NULL,
    reason TEXT NOT NULL,
    processed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Financial Audit Logs Table
CREATE TABLE IF NOT EXISTS financial_audit_logs (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast querying & tenant isolation
CREATE INDEX IF NOT EXISTS idx_fee_structures_school ON fee_structures(school_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_invoices_school ON student_fee_invoices(school_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_invoices_student ON student_fee_invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school ON fee_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_invoice ON fee_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_school ON financial_audit_logs(school_id);
