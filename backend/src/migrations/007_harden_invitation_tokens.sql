-- Migration 007: Harden Invitation Setup Tokens
-- Index setup_token column for fast SHA-256 hash lookup.

CREATE INDEX IF NOT EXISTS idx_users_setup_token ON users(setup_token);
