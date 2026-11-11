/**
 * Magic-byte checks for uploaded documents.
 *
 * The browser-supplied MIME type and file extension are attacker
 * controlled, so a .pdf upload could really be an executable. These
 * checks read the first bytes of the stored file and accept only the
 * formats the crewing team expects.
 */

const fs = require('fs');

const SIGNATURES = {
    '.pdf': [Buffer.from('%PDF-')],
    '.doc': [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
    // DOCX is a ZIP container; both plain and data-descriptor zips occur.
    '.docx': [Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from([0x50, 0x4b, 0x05, 0x06])]
};

/**
 * @param {string} filePath absolute path on disk
 * @param {string} ext lower-case extension including the dot
 * @returns {boolean} true when the file starts with a known signature
 */
function hasValidSignature(filePath, ext) {
    const allowed = SIGNATURES[String(ext || '').toLowerCase()];
    if (!allowed) return false;
    let fd;
    try {
        fd = fs.openSync(filePath, 'r');
        const header = Buffer.alloc(8);
        const read = fs.readSync(fd, header, 0, header.length, 0);
        return allowed.some((sig) => read >= sig.length && header.subarray(0, sig.length).equals(sig));
    } catch (_err) {
        return false;
    } finally {
        if (fd !== undefined) {
            try { fs.closeSync(fd); } catch (_err) { /* ignore */ }
        }
    }
}

module.exports = { hasValidSignature };
