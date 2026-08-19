const rateLimit = require('express-rate-limit');

// Rate limiter for setup token verification & password setup
const setupTokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: process.env.NODE_ENV === 'test' ? 1000 : 30, // 30 requests in dev/prod, high threshold in test mode to prevent test pollution
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too Many Requests', message: 'Too many setup password requests, please try again later.' }
});

// Rate limiter for invitation resend and access reset
const resendInvitationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: process.env.NODE_ENV === 'test' ? 1000 : 20, // 20 requests in dev/prod, high threshold in test mode
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too Many Requests', message: 'Too many invitation resend requests, please try again later.' }
});

module.exports = {
    setupTokenLimiter,
    resendInvitationLimiter
};
