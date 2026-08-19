-- Migration 004: Global ContentManager & SupportOfficer Role Hardening

-- 1. Contact Inquiries & Relational Messages
CREATE TABLE IF NOT EXISTS contact_inquiries (
    id SERIAL PRIMARY KEY,
    inquiry_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEW',
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    converted_ticket_id INTEGER REFERENCES support_threads(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_inquiry_messages (
    id SERIAL PRIMARY KEY,
    inquiry_id INTEGER NOT NULL REFERENCES contact_inquiries(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    message TEXT NOT NULL,
    is_internal INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Learning Content Metadata & Lifecycle
ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PUBLISHED';
ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS subtopic TEXT;
ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS term TEXT;
ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS curriculum TEXT;
ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0;
ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE learning_contents ADD COLUMN IF NOT EXISTS downloads_count INTEGER DEFAULT 0;

-- 3. Support Ticket SLA & Escalation
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMP;
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMP;
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'IN_SLA';
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP;
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS escalated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
ALTER TABLE support_threads ADD COLUMN IF NOT EXISTS escalation_status TEXT DEFAULT 'NONE';

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON contact_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_assigned ON contact_inquiries(assigned_to);
