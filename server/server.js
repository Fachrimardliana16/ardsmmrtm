/**
 * Ardson Maritime — Express API stub
 *
 * Implements the four endpoint groups defined in TRD §3:
 *   GET  /api/v1/jobs
 *   POST /api/v1/seafarers/register
 *   POST /api/v1/principals/crew-request
 *   POST /api/v1/contact
 *   POST /api/v1/newsletter
 *
 * Data is held in an in-memory store so the frontend can be
 * demonstrated without a database. Swap `store.js` for a
 * PostgreSQL client (pg / Prisma) to move to production.
 */

const path = require('path');
const express = require('express');
const multer = require('multer');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const store = require('./src/data/store');
const { validate } = require('./src/middleware/validate');
const {
    seafarerRules,
    principalRules,
    contactRules,
    newsletterRules
} = require('./src/middleware/rules');
const { sendNotification } = require('./src/services/notifier');
const { scanFile: scanForVirus, STRICT: VIRUS_SCAN_STRICT } = require('./src/services/virusScan');
const { encryptFile } = require('./src/services/cipher');
const { hasValidSignature } = require('./src/services/fileSignature');
const { assertAuthConfigured } = require('./src/middleware/adminAuth');
const adminRoutes = require('./src/routes/admin');
const adminUploadRoutes = require('./src/routes/adminUploads');
const app = express();
const PORT = process.env.PORT || 4000;

/*
 * When the API runs behind a reverse proxy or load balancer, set
 * TRUST_PROXY to the number of hops (usually 1) so rate limiting sees the
 * real client IP. Leave it unset when clients connect directly.
 */
if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}

/*
 * CORS allowlist. Production defaults to the live site; local development
 * origins can be added through CORS_ORIGINS (comma-separated) — e.g.
 * CORS_ORIGINS="http://localhost:5500,https://www.ardsonmaritime.com".
 */
const CORS_ORIGINS = (
    (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'https://www.ardsonmaritime.com')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
);
const corsOrigin = (origin, cb) => {
    if (!origin || CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(null, false);
};

/* ------------------------------------------------------------
   Security & parsers
   ------------------------------------------------------------ */
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com'],
            'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
            'img-src': ["'self'", 'data:', 'https://images.unsplash.com', 'https://www.googletagmanager.com', 'https://*.google-analytics.com'],
            'media-src': ["'self'", 'data:', 'blob:'],
            'connect-src': ["'self'", 'https://*.google-analytics.com', 'https://www.googletagmanager.com'],
            'frame-src': ['https://www.openstreetmap.org'],
            'object-src': ["'none'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"],
            'frame-ancestors': ["'none'"]
        }
    }
}));
app.use(cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* ------------------------------------------------------------
   Rate limiting (basic anti-spam on public forms)
   ------------------------------------------------------------ */
const formLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, message: 'Too many submissions. Please try again later.' }
});

/* ------------------------------------------------------------
   File upload (TRD §4: pdf/doc/docx, max 5MB, virus-scan hook)
   ------------------------------------------------------------ */
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'cv');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: UPLOAD_DIR,
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || '').toLowerCase();
            const safe = 'cv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + ext;
            cb(null, safe);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!['.pdf', '.doc', '.docx'].includes(ext)) {
            return cb(new Error('Only PDF, DOC, or DOCX files are accepted.'));
        }
        cb(null, true);
    }
});

/** Remove the temporary CV when a later middleware rejects the request. */
const cleanupRejectedUpload = (req, res, next) => {
    res.on('finish', () => {
        if (req.file && res.statusCode >= 400) {
            try { fs.unlinkSync(req.file.path); } catch (_e) { /* already removed */ }
        }
    });
    next();
};

/** Reject files whose content does not match their extension. */
const verifyCvSignature = (req, res, next) => {
    if (!req.file) return next();
    const ext = path.extname(req.file.filename || '').toLowerCase();
    if (!hasValidSignature(req.file.path, ext)) {
        try { fs.unlinkSync(req.file.path); } catch (_e) { /* already removed */ }
        return fail(res, 'The uploaded file is not a valid PDF, DOC, or DOCX document.', 400);
    }
    return next();
};

/* ------------------------------------------------------------
   Helpers
   ------------------------------------------------------------ */
const ok = (res, payload, status) => res.status(status || 200).json(payload);
const fail = (res, message, status) => res.status(status || 400).json({ ok: false, message });

/* ------------------------------------------------------------
   Routes — Jobs (public read)
   ------------------------------------------------------------ */
app.get('/api/v1/jobs', (req, res) => {
    const category = String(req.query.category || '').toLowerCase();
    const valid = ['deck', 'engine', 'hotel'];
    const data = valid.includes(category) ? store.listJobs(category) : store.listJobs();
    ok(res, { ok: true, count: data.length, data });
});

app.get('/api/v1/jobs/:id', (req, res) => {
    const job = store.getJob(String(req.params.id));
    if (!job) return fail(res, 'Vacancy not found', 404);
    ok(res, { ok: true, data: job });
});

/* ------------------------------------------------------------
   Routes — Maritime Insight (public read)
   ------------------------------------------------------------ */
app.get('/api/v1/insights', (req, res) => {
    const tag = req.query.tag ? String(req.query.tag) : undefined;
    const data = store.listInsights({ public: true, tag });
    ok(res, { ok: true, count: data.length, data });
});

app.get('/api/v1/insights/:slug', (req, res) => {
    const article = store.getInsightBySlug(String(req.params.slug));
    if (!article || article.status !== 'published') {
        return fail(res, 'Article not found', 404);
    }
    ok(res, { ok: true, data: article });
});

/* ------------------------------------------------------------
   Routes — Public site settings (brand, contact, hero copy)
   Written by the admin console, read by the public pages.
   ------------------------------------------------------------ */
app.get('/api/v1/settings', (_req, res) => {
    const settings = store.getSettings();
    // Public copy changes rarely; allow a short shared cache so every page
    // view does not hit the process. Admin writes still appear within a minute.
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    ok(res, { ok: true, data: settings });
});

/* ------------------------------------------------------------
   Routes — Seafarer registration
   ------------------------------------------------------------ */
app.post(
    '/api/v1/seafarers/register',
    formLimiter,
    upload.single('cv_file'),
    cleanupRejectedUpload,
    verifyCvSignature,
    validate(seafarerRules),
    async (req, res) => {
        const certifications = [];
        try {
            const raw = req.body.certifications;
            if (Array.isArray(raw)) certifications.push(...raw);
            else if (typeof raw === 'string') certifications.push(...JSON.parse(raw));
        } catch (_e) { /* ignore malformed payload */ }
        const cleanCertifications = certifications
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim().slice(0, 80))
            .filter(Boolean)
            .slice(0, 20);

        // Virus-scan the uploaded CV before persisting metadata. If no scanner
        // is configured (and VIRUS_SCAN_STRICT is off) the upload proceeds and
        // the reason is recorded on the seafarer record for audit.
        let virusScan = { scanned: false, clean: true, engine: 'none', reason: 'not scanned' };
        if (req.file && req.file.path) {
            try {
                const scan = await scanForVirus(req.file.path);
                if (scan.scanned && !scan.clean) {
                    try { fs.unlinkSync(req.file.path); } catch (_e) { /* already gone */ }
                    return fail(res, 'The uploaded file failed the virus scan and was rejected.', 400);
                }
                virusScan = scan;
            } catch (err) {
                try { fs.unlinkSync(req.file.path); } catch (_e) { /* already gone */ }
                return fail(res, err.message || 'Virus scan failed.', 500);
            }
            // Encrypt at rest (AES-256-GCM). Falls back to plaintext when
            // CV_ENCRYPTION_KEY is not configured (local development only).
            let encrypted = false;
            try {
                const enc = encryptFile(req.file.path);
                encrypted = enc.encrypted;
            } catch (err) {
                try { fs.unlinkSync(req.file.path); } catch (_e) { /* already gone */ }
                return fail(res, 'Could not securely store the uploaded CV.', 500);
            }
            virusScan.encrypted = encrypted;
        }

        const record = store.createSeafarer({
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            applied_rank: req.body.applied_rank,
            vessel_experience: req.body.vessel_experience,
            certifications: cleanCertifications,
            cv_file: req.file ? req.file.filename : null,
            source_ip: req.ip,
            virus_scan: virusScan
        });

        await sendNotification({
            subject: 'New seafarer registration',
            lines: [
                'Name: ' + record.name,
                'Email: ' + record.email,
                'Rank: ' + record.applied_rank,
                'Vessel: ' + record.vessel_experience,
                'Certificates: ' + cleanCertifications.join(', ')
            ]
        }).catch(() => {}); // never block the request on mailer failure

        ok(res, {
            ok: true,
            message: 'Registration received. Our crewing team will verify your documents within 2 working days.',
            data: { reference: record.reference }
        }, 201);
    }
);

/* ------------------------------------------------------------
   Routes — Principal crew request
   ------------------------------------------------------------ */
app.post(
    '/api/v1/principals/crew-request',
    formLimiter,
    validate(principalRules),
    async (req, res) => {
        const record = store.createCrewRequest(req.body);
        await sendNotification({
            subject: 'New principal crew request',
            lines: [
                'Company: ' + record.company_name,
                'Email: ' + record.email,
                'Vessel: ' + record.vessel_type,
                'Joining: ' + record.joining_date,
                'Ranks: ' + record.required_ranks
            ]
        }).catch(() => {});

        ok(res, {
            ok: true,
            message: 'Crew request received. Candidate proposals will be sent within 24 hours.',
            data: { reference: record.reference }
        }, 201);
    }
);

/* ------------------------------------------------------------
   Routes — Emergency replacement (BSD §1.2)
   Stores as a flagged crew request so the duty desk sees it first.
   ------------------------------------------------------------ */
app.post(
    '/api/v1/principals/emergency',
    formLimiter,
    validate(principalRules),
    async (req, res) => {
        const { port, reason, notes } = req.body;
        const record = store.createCrewRequest(req.body);
        record.emergency = true;
        record.port = typeof port === 'string' ? port.slice(0, 120) : '';
        record.reason = typeof reason === 'string' ? reason.slice(0, 120) : '';
        record.notes = typeof notes === 'string' ? notes.slice(0, 2000) : '';
        record.status = 'emergency';
        await sendNotification({
            subject: 'EMERGENCY replacement request',
            lines: [
                'Company: ' + record.company_name,
                'Email: ' + record.email,
                'Vessel: ' + record.vessel_type,
                'Joining: ' + record.joining_date,
                'Ranks: ' + record.required_ranks,
                'Port: ' + record.port,
                'Reason: ' + record.reason
            ]
        }).catch(() => {});

        ok(res, {
            ok: true,
            message: 'Emergency request received. Duty desk will respond within 30 minutes.',
            data: { reference: record.reference }
        }, 201);
    }
);

/* ------------------------------------------------------------
   Routes — Contact & newsletter
   ------------------------------------------------------------ */
app.post('/api/v1/contact', formLimiter, validate(contactRules), async (req, res) => {
    const record = store.createContact(req.body);
    await sendNotification({
        subject: 'New contact message',
        lines: ['From: ' + record.name + ' <' + record.email + '>', record.message]
    }).catch(() => {});

    ok(res, { ok: true, message: 'Message sent. We will reply during working hours (Mon–Sat, 08:00–17:00 WIB).' }, 201);
});

app.post('/api/v1/newsletter', formLimiter, validate(newsletterRules), (req, res) => {
    store.createSubscriber(req.body.email);
    ok(res, { ok: true, message: 'Subscribed. New vacancy alerts will arrive in your inbox.' }, 201);
});

/* ------------------------------------------------------------
   Routes — Admin management surface (Bearer token required)
   Mounted before the static file handler and the 404 fallback.
   ------------------------------------------------------------ */
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin/uploads', adminUploadRoutes);

/* ------------------------------------------------------------
   Health & errors
   ------------------------------------------------------------ */
app.get('/api/v1/health', (req, res) => ok(res, { ok: true, service: 'ardson-maritime-api', time: new Date().toISOString() }));

/* ------------------------------------------------------------
   Optional: serve the static frontend from this process.
   Useful for local development (single origin, no CORS setup).
   In production the frontend is hosted on Vercel/Netlify and
   this API runs behind a gateway (see IPD §2).
   ------------------------------------------------------------ */
if (process.env.SERVE_STATIC !== 'false') {
    const WEB_ROOT = path.join(__dirname, '..');
    // Source folders (partials, page bodies, build scripts) stay private.
    const PRIVATE_FILES = /^\/(pages\.json|package(-lock)?\.json|(prd|ipd|bsd|trd|afd|rtk)\.md)$/i;
    app.use((req, res, next) => {
        if (/^\/(\.|_|scripts\/|server\/|node_modules\/)/.test(req.path) || PRIVATE_FILES.test(req.path)) {
            return fail(res, 'Not found', 404);
        }
        // Candidate CVs are sensitive personal data — never publicly served.
        // They are fetched by the crewing team through the authenticated
        // /api/v1/admin/seafarers/:id/cv endpoint instead.
        if (/^\/uploads\/cv(\/|$)/i.test(req.path)) {
            return fail(res, 'Not found', 404);
        }
        next();
    });
    app.use('/uploads', express.static(path.join(WEB_ROOT, 'uploads'), {
        fallthrough: false,
        setHeaders: (res, filePath) => {
            if (/\.(webm|mp4)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            if (/\.webp$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }));
    app.use(express.static(WEB_ROOT, {
        extensions: ['html'],
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache');
            } else if (/\.(css|js)$/i.test(filePath)) {
                // Unversioned filenames: a short cache keeps edits visible.
                res.setHeader('Cache-Control', 'public, max-age=300');
            } else if (/\.(png|jpe?g|webp|svg|ico|woff2?)$/i.test(filePath)) {
                res.setHeader('Cache-Control', 'public, max-age=86400');
            }
        }
    }));
}

app.use((req, res) => fail(res, 'Not found', 404));

app.use((err, req, res, _next) => {
    if (err instanceof multer.MulterError) {
        return fail(res, 'Upload failed: ' + err.message, 400);
    }
    if (err && err.message && /PDF|DOC/i.test(err.message)) {
        return fail(res, err.message, 400);
    }
    console.error('[api] error:', err);
    fail(res, 'Internal server error', 500);
});

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
assertAuthConfigured();

if (process.env.NODE_ENV === 'production') {
    if (!process.env.CV_ENCRYPTION_KEY) {
        console.warn('[security] CV_ENCRYPTION_KEY is not set — uploaded CVs will be stored unencrypted.');
    }
    if (!process.env.CLAMAV_HOST && !VIRUS_SCAN_STRICT) {
        console.warn('[security] Virus scanning is not configured and VIRUS_SCAN_STRICT is off.');
    }
}

app.listen(PORT, () => {
    console.log('Ardson Maritime API stub listening on http://localhost:' + PORT);
    console.log('CORS origins: ' + CORS_ORIGINS.join(', '));
    console.log('In-memory store — data resets on restart.');
});

module.exports = app;