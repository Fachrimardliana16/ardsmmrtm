/**
 * Admin API — /api/v1/admin/uploads/*
 *
 * Multipart uploads for site media. Currently: hero stills and
 * background videos. Every route runs behind requireAdmin so an
 * unauthenticated request never reaches disk.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { requireAdmin } = require('../middleware/adminAuth');
const { processUpload } = require('../services/media');

const router = express.Router();

const HERO_MEDIA_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'hero');
if (!fs.existsSync(HERO_MEDIA_DIR)) fs.mkdirSync(HERO_MEDIA_DIR, { recursive: true });

const ALLOWED = [
    '.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.gif',
    '.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'
];

const heroUpload = multer({
    storage: multer.diskStorage({
        destination: HERO_MEDIA_DIR,
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname || '').toLowerCase();
            const safe = 'src-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + ext;
            cb(null, safe);
        }
    }),
    limits: { fileSize: 100 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (!ALLOWED.includes(ext)) {
            return cb(new Error('Upload a JPG, PNG, WebP, MP4, MOV, or WebM file.'));
        }
        cb(null, true);
    }
});

/* Everything here needs a valid admin token. */
router.use(requireAdmin);

router.post('/hero', heroUpload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ ok: false, message: 'Choose an image or video to upload.' });
    }
    try {
        const media = await processUpload(req.file);
        store_log(req, media);
        return res.status(201).json({
            ok: true,
            message: 'Media uploaded and compressed.',
            data: media
        });
    } catch (err) {
        console.error('[media] failed:', err.message);
        return res.status(500).json({
            ok: false,
            message: 'Could not process that file. Try a different image or video.'
        });
    }
});

function store_log(req, media) {
    try {
        const store = require('../data/store');
        store.recordLog(
            'info',
            req.adminUser || 'admin',
            'Uploaded hero media',
            media.url,
            `${media.type} · ${(media.bytes / 1024).toFixed(0)} KB`
        );
    } catch (_e) { /* logging is best effort */ }
}

module.exports = router;
