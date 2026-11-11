/**
 * Encryption at rest for sensitive files (CVs).
 *
 * CVs are written to disk encrypted with AES-256-GCM. The key is loaded
 * from CV_ENCRYPTION_KEY (32-byte hex string). When the key is absent
 * the file is stored plaintext (with an audit flag) so local development
 * stays simple — set the key in production.
 *
 * File format on disk (binary):
 *   [12-byte IV][16-byte auth tag][ciphertext]
 */

const crypto = require('node:crypto');
const fs = require('node:fs');

const KEY_HEX = process.env.CV_ENCRYPTION_KEY || '';

function getKey() {
    if (!KEY_HEX) return null;
    const buf = Buffer.from(KEY_HEX, 'hex');
    if (buf.length !== 32) {
        throw new Error('CV_ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters).');
    }
    return buf;
}

const encryptionEnabled = () => Boolean(KEY_HEX);

function encryptFile(plainPath) {
    const key = getKey();
    if (!key) return { encrypted: false };
    const plain = fs.readFileSync(plainPath);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    fs.writeFileSync(plainPath, Buffer.concat([iv, tag, ciphertext]));
    return { encrypted: true };
}

function decryptFile(encryptedPath) {
    const key = getKey();
    if (!key) {
        // Fall back: file was written plaintext.
        return fs.readFileSync(encryptedPath);
    }
    const raw = fs.readFileSync(encryptedPath);
    if (raw.length < 12 + 16) {
        // Plaintext fallback for legacy files.
        return raw;
    }
    // Legacy plaintext uploads may predate encryption being enabled.
    const head = raw.subarray(0, 8);
    if (head.equals(Buffer.from('%PDF-')) || head.subarray(0, 2).toString() === 'PK' ||
        head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) {
        return raw;
    }
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

module.exports = { encryptFile, decryptFile, encryptionEnabled };
