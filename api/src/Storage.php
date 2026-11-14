<?php

declare(strict_types=1);

namespace Ardson;

/**
 * Filesystem layout for private data and uploads.
 *
 * Everything lives under api/storage by default, which .htaccess blocks.
 * CVs are additionally encrypted at rest (see Cipher).
 */
final class Storage
{
    public static function storageDir(): string
    {
        $dir = (string) App::cfg('paths.storage', API_ROOT . '/storage');
        self::ensure($dir);
        return rtrim($dir, '/');
    }

    public static function cvDir(): string
    {
        $dir = self::storageDir() . '/uploads/cv';
        self::ensure($dir);
        return $dir;
    }

    public static function heroDir(): string
    {
        $webRoot = (string) App::cfg('paths.web_root', dirname(API_ROOT));
        $dir = rtrim($webRoot, '/') . '/uploads/hero';
        self::ensure($dir);
        return $dir;
    }

    public static function tmpDir(): string
    {
        $dir = self::storageDir() . '/tmp';
        self::ensure($dir);
        return $dir;
    }

    public static function ensure(string $dir): void
    {
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
    }

    /**
     * Validates and stores an uploaded file.
     *
     * @param array{name:string,type:string,tmp_name:string,error:int,size:int} $file
     * @param list<string> $allowedExt extensions without dot, lowercase
     */
    public static function saveUploaded(
        array $file,
        string $dir,
        string $prefix,
        array $allowedExt,
        int $maxBytes
    ): string {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            throw new \RuntimeException('Upload failed: File too large');
        }
        if ($error !== UPLOAD_ERR_OK) {
            throw new \RuntimeException('Upload failed: upload error ' . $error);
        }

        $size = (int) ($file['size'] ?? 0);
        if ($size <= 0) {
            throw new \RuntimeException('Upload failed: empty file');
        }
        if ($size > $maxBytes) {
            throw new \RuntimeException('Upload failed: File too large');
        }

        $original = (string) ($file['name'] ?? '');
        $ext = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));
        if ($ext === '' || !in_array($ext, $allowedExt, true)) {
            throw new \RuntimeException('Only PDF, DOC, or DOCX files are accepted.');
        }

        self::ensure($dir);
        $name = $prefix . (string) round(microtime(true) * 1000)
            . '-' . self::randomBase36(8)
            . '.' . $ext;

        $target = $dir . '/' . $name;
        $tmp = (string) ($file['tmp_name'] ?? '');

        $moved = is_uploaded_file($tmp)
            ? @move_uploaded_file($tmp, $target)
            : @copy($tmp, $target);

        if (!$moved) {
            throw new \RuntimeException('Upload failed: could not store the file');
        }
        @chmod($target, 0640);

        return $name;
    }

    public static function randomBase36(int $length): string
    {
        $alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
        $out = '';
        for ($i = 0; $i < $length; $i++) {
            $out .= $alphabet[random_int(0, 35)];
        }
        return $out;
    }

    /** Absolute path + basename, guaranteed to stay inside the directory. */
    public static function safeJoin(string $dir, string $name): ?string
    {
        $base = basename($name);
        if ($base === '' || $base === '.' || $base === '..') {
            return null;
        }
        $path = rtrim($dir, '/') . '/' . $base;
        $realDir = realpath($dir);
        $realPath = realpath($path);
        if ($realDir === false || $realPath === false) {
            return $path;
        }
        if ($realPath !== $realDir && strpos($realPath, $realDir . DIRECTORY_SEPARATOR) !== 0) {
            return null;
        }
        return $path;
    }
}
