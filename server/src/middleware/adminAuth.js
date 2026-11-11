/**
 * Minimal token auth for the /api/v1/admin/* surface.
 *
 * Tokens are configured via the ADMIN_TOKENS environment variable as a
 * comma-separated list, e.g. ADMIN_TOKENS=am-admin-key,am-manager-key.
 * The login endpoint (below) validates a plain password (ADMIN_PASSWORD)
 * and returns a session token held in memory — no cookies, no persistence.
 * Swap this for JWT + a user table in production (see IPD §6).
 */

const crypto = require('crypto');

const ADMIN_USER = process.env.ADMIN_USER || 'admin@ardsonmaritime.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ardson-admin-2026';
const CONFIGURED_TOKENS = (process.env.ADMIN_TOKENS || 'am-dev-admin-token')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

// In-memory sessions — cleared on process restart.
const sessions = new Map();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function issueToken(user) {
    const token = 'amt_' + crypto.randomBytes(24).toString('hex');
    const email = user || ADMIN_USER;
    sessions.set(token, {
        user: email,
        issuedAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS
    });
    return token;
}

function revokeToken(token) {
    sessions.delete(token);
}

function isValidToken(token) {
    if (!token) return false;
    if (CONFIGURED_TOKENS.includes(token)) return true;
    const session = sessions.get(token);
    if (!session) return false;
    if (session.expiresAt < Date.now()) {
        sessions.delete(token);
        return false;
    }
    return true;
}

function tokenUser(token) {
    const session = sessions.get(token);
    return session ? session.user : ADMIN_USER;
}

function verifyCredentials(user, password) {
    return String(user || '').trim().toLowerCase() === ADMIN_USER.toLowerCase()
        && String(password || '') === ADMIN_PASSWORD;
}

/** Express middleware — requires a valid token. */
function requireAdmin(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
    if (!isValidToken(token)) {
        return res.status(401).json({ ok: false, message: 'Admin authentication required.' });
    }
    req.adminToken = token;
    req.adminUser = tokenUser(token);
    return next();
}

module.exports = {
    requireAdmin,
    verifyCredentials,
    issueToken,
    revokeToken,
    tokenUser,
    ADMIN_USER
};