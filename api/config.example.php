<?php
/**
 * Ardson Maritime API configuration.
 *
 * Copy this file to config.php on the server, then fill in the real values.
 * config.php is ignored by git and denied by .htaccess.
 *
 * No Composer, no build step: uploading this folder + running install.php
 * is the whole deployment. SQLite is the default and needs no database
 * server; MySQL remains available by changing db.driver.
 */

return [
    'app' => [
        // "production" refuses to start without the required secrets.
        'env' => 'production',
        'debug' => false,
        // Leave empty: the API derives its own URL. Set only when mounted
        // somewhere unusual, e.g. https://ardsonmaritime.com/api
        'base_url' => '',
        // Public site origin(s) allowed to call the API.
        'cors_origins' => [
            'https://ardsonmaritime.com',
            'https://www.ardsonmaritime.com',
        ],
        // Set true when Hostinger/LiteSpeed sits in front of PHP and the
        // client IP must come from X-Forwarded-For.
        'trust_proxy' => false,
    ],

    'db' => [
        // "sqlite" needs no database server or credentials. The file is
        // created by api/install.php and must be writable by PHP.
        'driver' => 'sqlite',
        'path' => __DIR__ . '/storage/ardson.sqlite',

        // Optional MySQL setup: set driver to "mysql" and fill these in.
        // 'driver' => 'mysql',
        // 'host' => 'localhost',
        // 'port' => 3306,
        // 'name' => 'u123456789_ardson',
        // 'user' => 'u123456789_ardson',
        // 'pass' => 'replace-with-database-password',
        // 'charset' => 'utf8mb4',
    ],

    'admin' => [
        // Login for the admin console.
        'user' => 'admin@ardsonmaritime.com',
        // Either a plain password or a password_hash() value ("$2y$...").
        'password' => 'replace-with-a-long-random-password',
        // Machine tokens for integrations (comma separated in .env), e.g.
        // php -r "echo bin2hex(random_bytes(32));"
        'tokens' => [],
        // Session lifetime in seconds (12 hours, matching the Node server).
        'session_ttl' => 43200,
    ],

    'uploads' => [
        // Keep outside public_html when your plan allows it. Default is
        // api/storage, which .htaccess blocks from direct access.
        'dir' => __DIR__ . '/storage/uploads',
        'max_bytes' => 5 * 1024 * 1024,
        'allowed_ext' => ['pdf', 'doc', 'docx'],
        // Hero media (images/video) is handled separately.
        'max_media_bytes' => 50 * 1024 * 1024,
    ],

    'security' => [
        // 64 hex characters (32 bytes) for AES-256-GCM CV encryption.
        // Generate: php -r "echo bin2hex(random_bytes(32));"
        // Empty = store CVs unencrypted (development only).
        'cv_key' => '',
        // true = reject CV uploads when no ClamAV scanner is configured.
        // Shared Hostinger plans usually have no ClamAV, so this defaults to
        // false there; magic-byte + extension checks still run. Set true only
        // when clamav.host or clamscan/clamdscan is actually available.
        'virus_scan_strict' => false,
    ],

    'clamav' => [
        'host' => '',        // e.g. 127.0.0.1
        'port' => 3310,
    ],

    'mail' => [
        // Leave host empty to log notifications (dry run) instead of sending.
        // Set to Hostinger's SMTP host (e.g. smtp.hostinger.com) to deliver.
        'host' => '',
        'port' => 587,
        'user' => '',
        'pass' => '',
        'secure' => 'tls',   // tls | ssl | ''
        'from' => 'no-reply@ardsonmaritime.com',
        'from_name' => 'Ardson Maritime',
        'to' => 'ardsonmaritime@outlook.com',
    ],

    'whatsapp' => [
        'token' => '',
        'phone_id' => '',
        'to' => '',
    ],

    'media' => [
        // ffmpeg converts uploaded hero videos to WebM + MP4 + WebP poster.
        // Hostinger usually ships it; leave empty to look on PATH. Hero image
        // uploads work without it, video uploads return a clear error.
        'ffmpeg' => '',
    ],

    'paths' => [
        // Relative to the repository root (one level above api/).
        'web_root' => dirname(__DIR__),
        'storage' => __DIR__ . '/storage',
    ],
];
