/**
 * Admin API — /api/v1/admin/*
 *
 * All routes (except /login) require a Bearer token issued by /login
 * or configured through ADMIN_TOKENS.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../data/store');
const { validate } = require('../middleware/validate');
const { requireAdmin, verifyCredentials, issueToken, revokeToken, ADMIN_USER } = require('../middleware/adminAuth');
const { jobRules, jobPatchRules, loginRules, JOB_CATEGORIES, JOB_STATUSES, VESSEL_TYPES, SEAFARER_STATUSES, seafarerPatchRules } = require('../middleware/adminRules');
const { decryptFile, encryptionEnabled } = require('../services/cipher');

const router = express.Router();

/**
 * Brute-force protection: only failed attempts count, so a normal sign-in
 * does not eat into the budget. Successful logins reset the counter.
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { ok: false, message: 'Too many sign-in attempts. Try again in 15 minutes.' }
});

/* ---------- Auth ---------- */
router.post('/login', loginLimiter, validate(loginRules), (req, res) => {
    const { user, password } = req.body;
    if (!verifyCredentials(user, password)) {
        return res.status(401).json({ ok: false, message: 'Invalid email or password.' });
    }
    const token = issueToken(ADMIN_USER);
    store.recordLog('info', ADMIN_USER, 'Signed in', 'admin console', 'Session token issued');
    return res.json({
        ok: true,
        message: 'Signed in. Welcome back.',
        data: { token, user: ADMIN_USER, expiresIn: '12h' }
    });
});

router.post('/logout', requireAdmin, (req, res) => {
    revokeToken(req.adminToken);
    return res.json({ ok: true, message: 'Signed out.' });
});

/* Everything below requires a valid admin token. */
router.use(requireAdmin);

/* ---------- Dashboard ---------- */
router.get('/stats', (_req, res) => {
    const recentSeafarers = store.listSeafarers()
        .slice(-5)
        .reverse()
        .map((s) => ({ reference: s.reference, name: s.name, rank: s.applied_rank, created_at: s.created_at }));
    const recentRequests = store.listCrewRequests()
        .slice(-5)
        .reverse()
        .map((r) => ({ reference: r.reference, company: r.company_name, vessel: r.vessel_type, status: r.status, created_at: r.created_at }));
    const recentJobs = store.listAllJobs()
        .slice(-5)
        .reverse()
        .map((j) => ({ id: j.id, title: j.title, principal: j.principal, status: j.status, created_at: j.created_at }));

    return res.json({ ok: true, data: { stats: store.stats(), recentSeafarers, recentRequests, recentJobs } });
});

/* ---------- Jobs ---------- */
router.get('/jobs', (req, res) => {
    const status = String(req.query.status || '').toLowerCase();
    const category = String(req.query.category || '').toLowerCase();
    let data = store.listAllJobs();
    if (JOB_STATUSES.includes(status)) data = data.filter((j) => j.status === status);
    if (JOB_CATEGORIES.includes(category)) data = data.filter((j) => j.category === category);
    return res.json({ ok: true, count: data.length, data });
});

router.get('/jobs/:id', (req, res) => {
    const job = store.getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, message: 'Vacancy not found.' });
    return res.json({ ok: true, data: job });
});

router.post('/jobs', validate(jobRules), (req, res) => {
    const record = store.createJob(req.body);
    return res.status(201).json({ ok: true, message: `Vacancy "${record.title}" published.`, data: record });
});

router.patch('/jobs/:id', validate(jobPatchRules), (req, res) => {
    const updated = store.updateJob(req.params.id, req.body);
    if (!updated) return res.status(404).json({ ok: false, message: 'Vacancy not found.' });
    return res.json({ ok: true, message: 'Vacancy updated.', data: updated });
});

router.delete('/jobs/:id', (req, res) => {
    const removed = store.deleteJob(req.params.id);
    if (!removed) return res.status(404).json({ ok: false, message: 'Vacancy not found.' });
    return res.json({ ok: true, message: 'Vacancy removed.' });
});

/* ---------- Maritime Insight articles ---------- */
router.get('/insights', (req, res) => {
    const status = String(req.query.status || '').toLowerCase();
    let data = store.listInsights();
    if (['published', 'draft'].includes(status)) data = data.filter((i) => i.status === status);
    return res.json({ ok: true, count: data.length, data });
});

router.get('/insights/:id', (req, res) => {
    const article = store.getInsight(req.params.id);
    if (!article) return res.status(404).json({ ok: false, message: 'Article not found.' });
    return res.json({ ok: true, data: article });
});

router.post('/insights', (req, res) => {
    const { title } = req.body || {};
    if (!title || !String(title).trim()) {
        return res.status(400).json({ ok: false, message: 'Title is required.' });
    }
    const record = store.createInsight(req.body || {});
    if (!record) return res.status(409).json({ ok: false, message: 'An article with that slug already exists.' });
    store.recordLog('info', req.adminUser || 'admin', 'Created article', record.slug, record.title);
    return res.status(201).json({ ok: true, message: `Article "${record.title}" created.`, data: record });
});

router.patch('/insights/:id', (req, res) => {
    const updated = store.updateInsight(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ ok: false, message: 'Article not found.' });
    if (updated.conflict) return res.status(409).json({ ok: false, message: 'Another article already uses that slug.' });
    store.recordLog('info', req.adminUser || 'admin', 'Updated article', updated.slug, Object.keys(req.body || {}).join(', '));
    return res.json({ ok: true, message: 'Article updated.', data: updated });
});

router.delete('/insights/:id', (req, res) => {
    const removed = store.deleteInsight(req.params.id);
    if (!removed) return res.status(404).json({ ok: false, message: 'Article not found.' });
    store.recordLog('warning', req.adminUser || 'admin', 'Deleted article', req.params.id, '');
    return res.json({ ok: true, message: 'Article removed.' });
});

/* ---------- Seafarers ---------- */
router.get('/seafarers', (req, res) => {
    const rank = String(req.query.rank || '').toLowerCase();
    let data = store.listSeafarers().slice().reverse();
    if (rank) data = data.filter((s) => String(s.applied_rank || '').toLowerCase().includes(rank));
    return res.json({ ok: true, count: data.length, data });
});

router.patch('/seafarers/:id', validate(seafarerPatchRules), (req, res) => {
    const existing = store.findSeafarer(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, message: 'Seafarer not found.' });
    const patch = {
        status: req.body.status,
        notes: typeof req.body.notes === 'string' ? req.body.notes : existing.notes || '',
        screened_by: req.adminUser || 'admin',
        screened_at: new Date().toISOString()
    };
    const updated = store.updateSeafarer(req.params.id, patch);
    store.recordLog('info', req.adminUser || 'admin', 'Seafarer status → ' + patch.status, existing.reference || req.params.id, patch.notes || '');
    return res.json({ ok: true, message: 'Seafarer updated.', data: updated });
});

/**
 * Authenticated CV download. CVs live in server/uploads/cv and are never
 * exposed through the public static handler; the crewing team reaches them
 * only through this endpoint.
 */
const CV_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'cv');

router.get('/seafarers/:id/cv', (req, res) => {
    const record = store.listSeafarers().find((s) => s.id === req.params.id);
    if (!record || !record.cv_file) return res.status(404).json({ ok: false, message: 'CV not found.' });
    const file = path.resolve(CV_DIR, record.cv_file);
    if (file !== CV_DIR && !file.startsWith(CV_DIR + path.sep)) {
        return res.status(400).json({ ok: false, message: 'Invalid CV path.' });
    }
    if (!fs.existsSync(file)) return res.status(404).json({ ok: false, message: 'CV file missing on disk.' });
    const ext = path.extname(file).toLowerCase();
    const filename = 'CV-' + (record.name || record.id).replace(/[^\w.-]+/g, '_') + ext;
    store.recordLog('info', req.adminUser || 'admin', 'Downloaded CV', record.reference || record.id);

    // Decrypt at rest for the admin download. When encryption is not
    // configured the file is served as-is (plaintext fallback).
    if (!encryptionEnabled()) {
        return res.download(file, filename);
    }
    let plain;
    try {
        plain = decryptFile(file);
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'Could not decrypt the CV.' });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename.replace(/"/g, '') + '"');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(plain);
});

/* ---------- Crew requests ---------- */
router.get('/crew-requests', (_req, res) => {
    const data = store.listCrewRequests().slice().reverse();
    return res.json({ ok: true, count: data.length, data });
});

router.patch('/crew-requests/:id', (req, res) => {
    const status = req.body?.status;
    const allowed = ['new', 'emergency', 'contacted', 'shortlisting', 'proposed', 'fulfilled', 'closed'];
    if (status !== undefined && !allowed.includes(String(status))) {
        return res.status(400).json({ ok: false, message: 'Unknown crew request status.' });
    }
    const updated = store.updateCrewRequest(req.params.id, {
        status: status !== undefined ? String(status) : undefined,
        notes: req.body?.notes,
        assigned_to: req.body?.assigned_to
    });
    if (!updated) return res.status(404).json({ ok: false, message: 'Crew request not found.' });
    store.recordLog('info', req.adminUser || 'admin', 'Updated crew request', updated.reference, `status → ${updated.status}`);
    return res.json({ ok: true, data: updated });
});

/* ---------- Contacts ---------- */
router.get('/contacts', (_req, res) => {
    const data = store.listContacts();
    return res.json({ ok: true, count: data.length, data });
});

router.patch('/contacts/:id/read', (req, res) => {
    const updated = store.markContactRead(req.params.id);
    if (!updated) return res.status(404).json({ ok: false, message: 'Message not found.' });
    return res.json({ ok: true, data: updated });
});

router.patch('/contacts/:id', (req, res) => {
    const status = req.body?.status;
    const allowed = ['unread', 'read', 'replied', 'archived'];
    if (status !== undefined && !allowed.includes(String(status))) {
        return res.status(400).json({ ok: false, message: 'Unknown message status.' });
    }
    const updated = store.updateContact(req.params.id, {
        status: status !== undefined ? String(status) : undefined,
        notes: req.body?.notes
    });
    if (!updated) return res.status(404).json({ ok: false, message: 'Message not found.' });
    store.recordLog('info', req.adminUser || 'admin', 'Updated message', updated.email, `status → ${updated.status}`);
    return res.json({ ok: true, data: updated });
});

/* ---------- Newsletter ---------- */
router.get('/subscribers', (_req, res) => {
    const data = store.listSubscribers();
    return res.json({ ok: true, count: data.length, data });
});

/* ---------- Website & hero settings ---------- */
router.get('/settings', (_req, res) => {
    return res.json({ ok: true, data: store.getSettings() });
});

router.patch('/settings/:section', (req, res) => {
    const section = String(req.params.section || '');
    if (!['site', 'hero', 'help', 'profile_button', 'help_button', 'pages', 'blocks'].includes(section)) {
        return res.status(400).json({ ok: false, message: 'Unknown settings section.' });
    }
    const updated = store.updateSettings(section, req.body || {});
    if (!updated) return res.status(400).json({ ok: false, message: 'Could not update settings.' });
    store.recordLog('info', req.adminUser || 'admin', `Updated ${section} settings`, 'website settings', Object.keys(req.body || {}).join(', '));
    return res.json({ ok: true, message: `${section === 'site' ? 'Website' : section.replace('_', ' ')} settings saved.`, data: updated });
});

router.post('/settings/blocks/:key/reset', (req, res) => {
    const key = String(req.params.key || '');
    const updated = store.resetBlock(key);
    store.recordLog('warning', req.adminUser || 'admin', 'Reset content block', key, 'Restored defaults');
    return res.json({ ok: true, message: 'Section restored.', data: updated });
});

router.post('/settings/:section/reset', (req, res) => {
    const section = String(req.params.section || '');
    if (!['site', 'hero', 'help', 'profile_button', 'help_button', 'pages', 'blocks', 'all'].includes(section)) {
        return res.status(400).json({ ok: false, message: 'Unknown settings section.' });
    }
    const updated = store.resetSettings(section === 'all' ? null : section);
    store.recordLog('warning', req.adminUser || 'admin', 'Reset settings', section, 'Restored defaults');
    return res.json({ ok: true, message: 'Defaults restored.', data: updated });
});

/* ---------- Hero slides ---------- */
router.get('/hero-slides', (_req, res) => {
    const data = store.listHeroSlides();
    return res.json({ ok: true, count: data.length, data });
});

router.post('/hero-slides', (req, res) => {
    const slide = store.createHeroSlide(req.body || {});
    store.recordLog('info', req.adminUser || 'admin', 'Created hero slide', slide.id, slide.type);
    return res.status(201).json({ ok: true, message: 'Slide added.', data: slide });
});

router.patch('/hero-slides/:id', (req, res) => {
    const slide = store.updateHeroSlide(req.params.id, req.body || {});
    if (!slide) return res.status(404).json({ ok: false, message: 'Slide not found.' });
    store.recordLog('info', req.adminUser || 'admin', 'Updated hero slide', slide.id, Object.keys(req.body || {}).join(', '));
    return res.json({ ok: true, message: 'Slide updated.', data: slide });
});

router.delete('/hero-slides/:id', (req, res) => {
    const removed = store.deleteHeroSlide(req.params.id);
    if (!removed) return res.status(404).json({ ok: false, message: 'Slide not found.' });
    store.recordLog('warning', req.adminUser || 'admin', 'Deleted hero slide', req.params.id, '');
    return res.json({ ok: true, message: 'Slide removed.' });
});

router.post('/hero-slides/reorder', (req, res) => {
    const order = req.body && req.body.order;
    const result = store.reorderHeroSlides(order);
    if (!result) return res.status(400).json({ ok: false, message: 'Order must list every slide id once.' });
    store.recordLog('info', req.adminUser || 'admin', 'Reordered hero slides', '', result.map((s) => s.id).join(','));
    return res.json({ ok: true, message: 'Slide order saved.', data: result });
});

/* ---------- Admin users ---------- */
router.get('/users', (_req, res) => {
    return res.json({ ok: true, count: store.listUsers().length, data: store.listUsers() });
});

router.post('/users', (req, res) => {
    const { name, email, role, status } = req.body || {};
    if (!name || !email) return res.status(400).json({ ok: false, message: 'Name and email are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        return res.status(400).json({ ok: false, message: 'Enter a valid email address.' });
    }
    if (store.getUserByEmail(email)) {
        return res.status(409).json({ ok: false, message: 'A user with that email already exists.' });
    }
    if (!store.listRoles().some((r) => r.slug === role)) {
        return res.status(400).json({ ok: false, message: 'Unknown role.' });
    }
    const record = store.createUser({ name, email, role, status });
    store.recordLog('info', req.adminUser || 'admin', 'Invited user', record.email, record.role);
    return res.status(201).json({ ok: true, message: `Invitation sent to ${record.email}.`, data: record });
});

router.patch('/users/:id', (req, res) => {
    const patch = req.body || {};
    if (patch.email) {
        const existing = store.getUserByEmail(patch.email);
        if (existing && existing.id !== req.params.id) {
            return res.status(409).json({ ok: false, message: 'Another user already uses that email.' });
        }
    }
    if (patch.role && !store.listRoles().some((r) => r.slug === patch.role)) {
        return res.status(400).json({ ok: false, message: 'Unknown role.' });
    }
    const updated = store.updateUser(req.params.id, patch);
    if (!updated) return res.status(404).json({ ok: false, message: 'User not found.' });
    store.recordLog('info', req.adminUser || 'admin', 'Updated user', updated.email, Object.keys(patch).join(', '));
    return res.json({ ok: true, message: 'User updated.', data: updated });
});

router.delete('/users/:id', (req, res) => {
    const user = store.getUser(req.params.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found.' });
    if (user.email === ADMIN_USER) {
        return res.status(400).json({ ok: false, message: 'The primary administrator cannot be removed.' });
    }
    store.deleteUser(req.params.id);
    store.recordLog('warning', req.adminUser || 'admin', 'Removed user', user.email, '');
    return res.json({ ok: true, message: 'User removed.' });
});

/* ---------- Roles & permissions ---------- */
router.get('/roles', (_req, res) => {
    return res.json({
        ok: true,
        count: store.listRoles().length,
        data: store.listRoles(),
        permissions: store.permissionCatalogue()
    });
});

router.post('/roles', (req, res) => {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) {
        return res.status(400).json({ ok: false, message: 'Role name is required.' });
    }
    if (store.listRoles().some((r) => r.name.toLowerCase() === String(name).trim().toLowerCase())) {
        return res.status(409).json({ ok: false, message: 'A role with that name already exists.' });
    }
    const record = store.createRole(req.body);
    store.recordLog('info', req.adminUser || 'admin', 'Created role', record.name, record.permissions.join(', '));
    return res.status(201).json({ ok: true, message: `Role "${record.name}" created.`, data: record });
});

router.patch('/roles/:id', (req, res) => {
    const updated = store.updateRole(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ ok: false, message: 'Role not found.' });
    if (updated.locked_error) {
        return res.status(400).json({ ok: false, message: 'The Super Admin role is locked and cannot be edited.' });
    }
    store.recordLog('info', req.adminUser || 'admin', 'Updated role', updated.name, updated.permissions.join(', '));
    return res.json({ ok: true, message: 'Role updated.', data: updated });
});

router.delete('/roles/:id', (req, res) => {
    const result = store.deleteRole(req.params.id);
    if (result === 'locked') return res.status(400).json({ ok: false, message: 'The Super Admin role cannot be deleted.' });
    if (result === 'in_use') return res.status(409).json({ ok: false, message: 'Reassign users on this role before deleting it.' });
    if (!result) return res.status(404).json({ ok: false, message: 'Role not found.' });
    return res.json({ ok: true, message: 'Role removed.' });
});

/* ---------- Logs (activity + error) ---------- */
router.get('/logs', (req, res) => {
    const level = String(req.query.level || 'all').toLowerCase();
    if (!['all', 'info', 'warning', 'error'].includes(level)) {
        return res.status(400).json({ ok: false, message: 'Unknown log level.' });
    }
    const data = store.listLogs(level);
    return res.json({
        ok: true,
        count: data.length,
        data,
        summary: {
            info: store.listLogs('info').length,
            warning: store.listLogs('warning').length,
            error: store.listLogs('error').length
        }
    });
});

router.delete('/logs', (req, res) => {
    const level = String(req.query.level || 'all').toLowerCase();
    if (!['all', 'info', 'warning', 'error'].includes(level)) {
        return res.status(400).json({ ok: false, message: 'Unknown log level.' });
    }
    const removed = store.clearLogs(level);
    store.recordLog('warning', req.adminUser || 'admin', 'Cleared logs', level, `${removed} entries removed`);
    return res.json({ ok: true, message: `Cleared ${removed} log entr${removed === 1 ? 'y' : 'ies'}.`, data: { removed } });
});

/* ---------- Backups ---------- */
router.get('/backups', (_req, res) => {
    return res.json({ ok: true, count: store.listBackups().length, data: store.listBackups() });
});

router.post('/backups', (req, res) => {
    const record = store.createBackup(req.adminUser || 'admin');
    return res.status(201).json({ ok: true, message: `Backup ${record.filename} created.`, data: record });
});

router.get('/backups/:id/download', (req, res) => {
    const payload = store.getBackupPayload(req.params.id);
    if (!payload) return res.status(404).json({ ok: false, message: 'Backup not found.' });
    const entry = store.listBackups().find((b) => b.id === req.params.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${entry ? entry.filename : 'ardson-backup.json'}"`);
    return res.send(JSON.stringify(payload, null, 2));
});

router.post('/backups/:id/restore', (req, res) => {
    const restored = store.restoreBackup(req.params.id, req.adminUser || 'admin');
    if (!restored) return res.status(404).json({ ok: false, message: 'Backup not found.' });
    return res.json({ ok: true, message: 'Backup restored. Live data has been replaced.', data: restored });
});

router.delete('/backups/:id', (req, res) => {
    const removed = store.deleteBackup(req.params.id);
    if (!removed) return res.status(404).json({ ok: false, message: 'Backup not found.' });
    store.recordLog('warning', req.adminUser || 'admin', 'Deleted backup', req.params.id, '');
    return res.json({ ok: true, message: 'Backup deleted.' });
});

module.exports = router;