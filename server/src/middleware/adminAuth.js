/**
 * Admin authentication for the /api/v1/admin/* surface.
 *
 * Two token sources are accepted:
 *   1. Session tokens issued by POST /api/v1/admin/login (12h TTL, memory only).
 *   2. Static machine tokens configured through ADMIN_TOKENS.
 *
 * Credentials come from ADMIN_USER / ADMIN_PASSWORD. The development
 * defaults below are only used when NODE_ENV is not "production"; in
 * production the process refuses to boot without explicit credentials.
 */

const crypto = require('crypto');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_USER = process.env.ADMIN_USER || 'admin@ardsonmaritime.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? '' : 'ardson-admin-2026');
const CONFIGURED_TOKENS = (process.env.ADMIN_TOKENS || (IS_PRODUCTION ? '' : 'am-dev-admin-token'))
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_SESSIONS = 100;

/** Session tokens are stored hashed so a heap dump does not expose them. */
const sessions = new Map(); // sha256(token) -> { user, issuedAt, expiresAt }

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/** Constant-time comparison that also hides the input length. */
const safeEqual = (a, b) => {
    const ha = crypto.createHash('sha256').update(String(a == null ? '' : a)).digest();
    const hb = crypto.createHash('sha256').update(String(b == null ? '' : b)).digest();
    return crypto.timingSafeEqual(ha, hb);
};

/**
 * Fail fast when production is started without real credentials. Called
 * from server.js before the HTTP listener is opened.
 */
function assertAuthConfigured() {
    if (!IS_PRODUCTION) return;
    const missing = [];
    if (!process.env.ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
    if (!process.env.ADMIN_TOKENS) missing.push('ADMIN_TOKENS');
    if (missing.length) {
        throw new Error(
            'Refusing to start in production without ' + missing.join(' and ') + '. ' +
            'Set them in the environment (see server/.env.example).'
        );
    }
}

function pruneSessions() {
    const now = Date.now();
    for (const [key, session] of sessions) {
        if (session.expiresAt <= now) sessions.delete(key);
    }
}

function issueToken(user) {
    pruneSessions();
    if (sessions.size >= MAX_SESSIONS) {
        // Drop the oldest session rather than growing without bound.
        let oldestKey = null;
        let oldestAt = Infinity;
        for (const [key, session] of sessions) {
            if (session.issuedAt < oldestAt) {
                oldestAt = session.issuedAt;
                oldestKey = key;
            }
        }
        if (oldestKey) sessions.delete(oldestKey);
    }
    const token = 'amt_' + crypto.randomBytes(32).toString('hex');
    sessions.set(hashToken(token), {
        user: user || ADMIN_USER,
        issuedAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS
    });
    return token;
}

function revokeToken(token) {
    if (!token) return;
    sessions.delete(hashToken(token));
}

function findConfiguredToken(token) {
    for (const configured of CONFIGURED_TOKENS) {
        if (safeEqual(configured, token)) return configured;
    }
    return null;
}

function isValidToken(token) {
    if (!token || typeof token !== 'string') return false;
    if (findConfiguredToken(token)) return true;
    const key = hashToken(token);
    const session = sessions.get(key);
    if (!session) return false;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(key);
        return false;
    }
    return true;
}

function tokenUser(token) {
    const session = sessions.get(hashToken(token));
    return session ? session.user : ADMIN_USER;
}

function verifyCredentials(user, password) {
    const userOk = safeEqual(String(user || '').trim().toLowerCase(), ADMIN_USER.toLowerCase());
    const passOk = safeEqual(String(password || ''), ADMIN_PASSWORD);
    return userOk && passOk;
}

/** Express middleware — requires a Bearer token from the Authorization header. */
function requireAdmin(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!isValidToken(token)) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="ardson-admin"');
        return res.status(401).json({ ok: false, message: 'Admin authentication required.' });
    }
    req.adminToken = token;
    req.adminUser = tokenUser(token);
    return next();
}

// Expired sessions are evicted hourly; unref keeps this from holding the
// process open during tests or graceful shutdown.
setInterval(pruneSessions, 60 * 60 * 1000).unref();

module.exports = {
    requireAdmin,
    verifyCredentials,
    issueToken,
    revokeToken,
    tokenUser,
    assertAuthConfigured,
    ADMIN_USER,
    SESSION_TTL_MS
};
