<?php

declare(strict_types=1);

namespace Ardson;

/**
 * AES-256-GCM for CVs at rest. Binary layout matches the Node service:
 * [12-byte IV][16-byte auth tag][ciphertext].
 */
final class Cipher
{
    /** @return array{encrypted:bool} */
    public static function encryptFile(string $path): array
    {
        $key = self::key();
        if ($key === null) {
            return ['encrypted' => false];
        }

        $plain = file_get_contents($path);
        if ($plain === false) {
            throw new \RuntimeException('Could not read the uploaded CV.');
        }

        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt(
            $plain,
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            16
        );
        if ($ciphertext === false) {
            throw new \RuntimeException('Could not securely store the uploaded CV.');
        }

        if (file_put_contents($path, $iv . $tag . $ciphertext, LOCK_EX) === false) {
            throw new \RuntimeException('Could not securely store the uploaded CV.');
        }

        return ['encrypted' => true];
    }

    public static function decryptFile(string $path): string
    {
        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new \RuntimeException('CV file missing on disk.');
        }

        $key = self::key();
        if ($key === null) {
            return $raw;
        }

        if (strlen($raw) < 28) {
            return $raw;
        }

        // Legacy plaintext files written before encryption was enabled.
        $head8 = substr($raw, 0, 8);
        if (strncmp($raw, '%PDF-', 5) === 0
            || substr($raw, 0, 2) === 'PK'
            || $head8 === "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1") {
            return $raw;
        }

        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $ciphertext = substr($raw, 28);

        $plain = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($plain === false) {
            throw new \RuntimeException('Could not decrypt the CV.');
        }
        return $plain;
    }

    public static function enabled(): bool
    {
        return (string) App::cfg('security.cv_key', '') !== '';
    }

    private static function key(): ?string
    {
        $hex = (string) App::cfg('security.cv_key', '');
        if ($hex === '') {
            return null;
        }
        if (!preg_match('/^[0-9a-fA-F]{64}$/', $hex)) {
            throw new \RuntimeException('CV_ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters).');
        }
        return hex2bin($hex);
    }
}
