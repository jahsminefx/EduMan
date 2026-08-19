const crypto = require('crypto');
const { getDB } = require('../config/database');

/**
 * Generates a cryptographically secure 32-byte setup token (raw)
 * and its SHA-256 hash for storage at rest.
 */
function generateSetupToken() {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash };
}

/**
 * Computes SHA-256 hash of a raw token string.
 */
function hashToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return '';
    return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Records an invitation audit event into superadmin_audit_logs.
 * Never logs plaintext passwords, raw setup tokens, or complete invitation URLs.
 */
async function recordInvitationAudit({ actorId, action, targetUserId, role, reason, ipAddress }) {
    try {
        const db = getDB();
        const actor = actorId || targetUserId;
        if (!actor) return;
        await db.run(`
            INSERT INTO superadmin_audit_logs (user_id, action, target_type, target_id, details, reason, ip_address)
            VALUES ($1, $2, 'User', $3, $4, $5, $6)
        `, [
            actor, 
            action, 
            targetUserId || null, 
            role ? `Role: ${role}` : null, 
            reason || null, 
            String(ipAddress || '127.0.0.1')
        ]);
    } catch (err) {
        // Silently swallow audit errors so primary operations are non-blocking
    }
}

module.exports = {
    generateSetupToken,
    hashToken,
    recordInvitationAudit
};
