/**
 * Virus scanning service for uploaded files.
 *
 * Strategy:
 *   1. If CLAMAV_HOST is set, use the ClamAV INSTREAM TCP interface
 *      (clamd) — best for production with a running clamd service.
 *   2. If `clamscan` (or `clamdscan`) is on PATH, shell out to it.
 *   3. Otherwise, return a "skipped" result and let the caller decide
 *      whether to reject the upload (strict mode) or accept it.
 *
 * Configure via environment variables:
 *   CLAMAV_HOST  — clamd TCP host (e.g. clamav:3310). Optional.
 *   CLAMAV_PORT  — clamd TCP port (default 3310).
 *   VIRUS_SCAN_STRICT — set to "1" to reject uploads when no scanner
 *                       is available (defaults to "0" for development).
 */

const net = require('node:net');
const { spawn } = require('node:child_process');
const fs = require('node:fs');

const CLAMAV_HOST = process.env.CLAMAV_HOST || '';
const CLAMAV_PORT = Number(process.env.CLAMAV_PORT || 3310);
const STRICT = process.env.VIRUS_SCAN_STRICT === '1';

function scanViaClamd(filePath) {
    return new Promise((resolve, reject) => {
        const socket = net.connect({ host: CLAMAV_HOST, port: CLAMAV_PORT }, () => {
            // INSTREAM protocol: send the chunk size prefix + bytes + zero terminator.
            const sizeBuf = Buffer.alloc(4);
            sizeBuf.writeUInt32BE(0, 0); // chunk length placeholder (we write in chunks below)
            socket.write('zINSTREAM\0');
            const readStream = fs.createReadStream(filePath);
            readStream.on('data', (chunk) => {
                const len = Buffer.alloc(4);
                len.writeUInt32BE(chunk.length, 0);
                socket.write(len);
                socket.write(chunk);
            });
            readStream.on('end', () => {
                const zero = Buffer.alloc(4);
                zero.writeUInt32BE(0, 0);
                socket.end(zero);
            });
        });

        let data = '';
        socket.on('data', (d) => { data += d.toString(); });
        socket.on('end', () => {
            const clean = /OK/.test(data) && !/FOUND/.test(data);
            resolve({ scanned: true, clean, engine: 'clamd', detail: data.trim() });
        });
        socket.on('error', reject);
    });
}

function scanViaCli(scanner, filePath) {
    return new Promise((resolve) => {
        const proc = spawn(scanner, [filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.on('error', () => resolve(null));
        proc.on('close', (code) => {
            // ClamAV exit codes: 0 = clean, 1 = virus found, 2 = error.
            if (code === 0) return resolve({ scanned: true, clean: true, engine: scanner, detail: stdout.trim() });
            if (code === 1) return resolve({ scanned: true, clean: false, engine: scanner, detail: stdout.trim() });
            resolve(null);
        });
    });
}

async function scanFile(filePath) {
    if (CLAMAV_HOST) {
        try {
            return await scanViaClamd(filePath);
        } catch (err) {
            if (STRICT) throw new Error('Virus scan failed: ' + err.message);
            return { scanned: false, clean: true, engine: 'none', reason: 'clamd unreachable: ' + err.message };
        }
    }
    for (const bin of ['clamdscan', 'clamscan']) {
        const result = await scanViaCli(bin, filePath);
        if (result) return result;
    }
    if (STRICT) throw new Error('Virus scan required but no scanner is configured.');
    return {
        scanned: false,
        clean: true,
        engine: 'none',
        reason: 'Virus scanning not configured. Set CLAMAV_HOST or install clamscan/clamdscan.'
    };
}

module.exports = { scanFile, STRICT };
