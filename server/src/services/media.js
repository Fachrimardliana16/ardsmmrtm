/**
 * Ardson Maritime — hero media pipeline
 *
 * Accepts an image or a video and produces web-ready derivatives:
 *
 *   image  ->  WebP at 2400px (hero) and 1200px (mobile / social)
 *   video  ->  WebM (VP9) primary + MP4 (H.264) fallback + WebP poster
 *
 * The originals are discarded. Every derivative is written to
 * <repo>/uploads/hero and served statically at /uploads/hero/<file>.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const sharp = require('sharp');

const WEB_ROOT = path.join(__dirname, '..', '..', '..');
const HERO_DIR = path.join(WEB_ROOT, 'uploads', 'hero');
const TMP_DIR = path.join(os.tmpdir(), 'ardson-media');

for (const dir of [HERO_DIR, TMP_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.gif']);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi']);

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

const run = (bin, args) => new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 * 8 }, (err, stdout, stderr) => {
        if (err) {
            const detail = String(stderr || err.message || '').slice(-800);
            return reject(new Error(detail || 'Media processing failed.'));
        }
        resolve(stdout);
    });
});

const stamp = () => Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');

/**
 * Images: one master WebP (max 2400px wide) plus a 1200px variant.
 * Returns { type:'image', url, srcset, width, height, bytes }.
 */
async function processImage(sourcePath, originalName) {
    const base = 'hero-' + stamp();
    const out = path.join(HERO_DIR, base + '.webp');
    const outSmall = path.join(HERO_DIR, base + '-1200.webp');

    const meta = await sharp(sourcePath).rotate().metadata();
    const width = Math.min(meta.width || 2400, 2400);

    await sharp(sourcePath)
        .rotate()
        .resize({ width: 2400, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toFile(out);

    await sharp(sourcePath)
        .rotate()
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toFile(outSmall);

    const stat = fs.statSync(out);
    return {
        type: 'image',
        url: '/uploads/hero/' + path.basename(out),
        srcset: '/uploads/hero/' + path.basename(outSmall) + ' 1200w, /uploads/hero/' + path.basename(out) + ' 2400w',
        poster: null,
        width,
        height: meta.height || null,
        bytes: stat.size,
        original: originalName || null
    };
}

/**
 * Videos: VP9/WebM (primary) + H.264/MP4 (fallback) + WebP poster.
 * Audio is stripped — the hero is muted and autoplaying.
 */
async function processVideo(sourcePath, originalName) {
    const base = 'hero-' + stamp();
    const webm = path.join(HERO_DIR, base + '.webm');
    const mp4 = path.join(HERO_DIR, base + '.mp4');
    const poster = path.join(HERO_DIR, base + '-poster.webp');

    // Cap at 1920px wide, 24fps is enough for a slow background loop.
    const scale = 'scale=1920:-2:force_original_aspect_ratio=decrease';

    await run(FFMPEG, [
        '-y', '-i', sourcePath,
        '-an',
        '-vf', scale + ',fps=24',
        '-c:v', 'libvpx-vp9',
        '-row-mt', '1',
        '-cpu-used', '5',
        '-deadline', 'good',
        '-crf', '34',
        '-b:v', '0',
        webm
    ]);

    await run(FFMPEG, [
        '-y', '-i', sourcePath,
        '-an',
        '-vf', scale + ',fps=24',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '28',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        mp4
    ]);

    // Poster from the first frame that is not pure black.
    await run(FFMPEG, [
        '-y', '-ss', '1', '-i', sourcePath,
        '-frames:v', '1',
        '-vf', 'scale=2400:-2',
        poster.replace(/\.webp$/, '-raw.png')
    ]).catch(() => run(FFMPEG, ['-y', '-i', sourcePath, '-frames:v', '1', '-vf', 'scale=2400:-2', poster.replace(/\.webp$/, '-raw.png')]));

    const rawPoster = poster.replace(/\.webp$/, '-raw.png');
    if (fs.existsSync(rawPoster)) {
        await sharp(rawPoster).webp({ quality: 80 }).toFile(poster);
        fs.unlinkSync(rawPoster);
    }

    const stat = fs.statSync(webm);
    return {
        type: 'video',
        url: '/uploads/hero/' + path.basename(webm),
        fallback: '/uploads/hero/' + path.basename(mp4),
        poster: fs.existsSync(poster) ? '/uploads/hero/' + path.basename(poster) : null,
        bytes: stat.size,
        original: originalName || null
    };
}

async function processUpload(file) {
    const ext = path.extname(file.originalname || file.path || '').toLowerCase();
    try {
        if (IMAGE_EXT.has(ext)) return await processImage(file.path, file.originalname);
        if (VIDEO_EXT.has(ext)) return await processVideo(file.path, file.originalname);
        throw new Error('Unsupported file type. Upload an image (JPG, PNG, WebP) or video (MP4, MOV, WebM).');
    } finally {
        // The raw upload is never kept.
        fs.promises.unlink(file.path).catch(() => {});
    }
}

module.exports = { processUpload, processImage, processVideo, HERO_DIR, IMAGE_EXT, VIDEO_EXT };
