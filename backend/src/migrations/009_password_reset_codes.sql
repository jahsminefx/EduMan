-- Migration 009: Add Password Reset Codes to Users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMP;
