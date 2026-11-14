<?php

declare(strict_types=1);

namespace Ardson;

/**
 * Hero media pipeline: WebP derivatives for images, WebM/MP4 + poster for
 * video. Same output shape as the Node service, using GD and ffmpeg.
 *
 * If ffmpeg is unavailable (common on shared hosting) video uploads fail
 * with a clear message instead of breaking the admin console.
 */
final class Media
{
    private const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff', 'gif'];
    private const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'];

    /**
     * @param array{name:string,type:string,tmp_name:string,error:int,size:int} $file
     * @return array<string,mixed>
     */
    public static function processUpload(array $file): array
    {
        $original = (string) ($file['name'] ?? '');
        $ext = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));
        $dir = Storage::heroDir();
        $rawName = 'src-' . (string) round(microtime(true) * 1000) . '-' . Storage::randomBase36(10) . '.' . $ext;
        $rawPath = $dir . '/' . $rawName;

        $tmp = (string) ($file['tmp_name'] ?? '');
        $moved = is_uploaded_file($tmp) ? @move_uploaded_file($tmp, $rawPath) : @copy($tmp, $rawPath);
        if (!$moved) {
            throw new \RuntimeException('Could not store the uploaded media.');
        }

        try {
            if (in_array($ext, self::IMAGE_EXT, true)) {
                return self::processImage($rawPath, $original);
            }
            if (in_array($ext, self::VIDEO_EXT, true)) {
                return self::processVideo($rawPath, $original);
            }
            throw new \RuntimeException('Unsupported file type. Upload an image (JPG, PNG, WebP) or video (MP4, MOV, WebM).');
        } finally {
            if (is_file($rawPath)) {
                @unlink($rawPath);
            }
        }
    }

    /**
     * @return array<string,mixed>
     */
    private static function processImage(string $source, string $original): array
    {
        $info = @getimagesize($source);
        if ($info === false) {
            throw new \RuntimeException('Unsupported image.');
        }
        [$srcWidth, $srcHeight] = $info;

        $contents = file_get_contents($source);
        $image = $contents !== false ? @imagecreatefromstring($contents) : false;
        if ($image === false) {
            throw new \RuntimeException('Unsupported image.');
        }
        if (!function_exists('imagewebp')) {
            throw new \RuntimeException('WebP support is missing from PHP GD.');
        }

        $stamp = base_convert((string) round(microtime(true) * 1000), 10, 36)
            . '-' . bin2hex(random_bytes(3));
        $base = 'hero-' . $stamp;

        $width = min($srcWidth > 0 ? $srcWidth : 2400, 2400);
        $master = $base . '.webp';
        $small = $base . '-1200.webp';

        self::resizeWebp($image, $width, Storage::heroDir() . '/' . $master, 82);

        $smallWidth = min($srcWidth > 0 ? $srcWidth : 1200, 1200);
        self::resizeWebp($image, $smallWidth, Storage::heroDir() . '/' . $small, 78);

        $bytes = (int) @filesize(Storage::heroDir() . '/' . $master);

        return [
            'type' => 'image',
            'url' => '/uploads/hero/' . $master,
            'srcset' => '/uploads/hero/' . $small . ' 1200w, /uploads/hero/' . $master . ' 2400w',
            'poster' => null,
            'width' => $width,
            'height' => $srcHeight ?: null,
            'bytes' => $bytes,
            'original' => $original !== '' ? $original : null,
        ];
    }

    /** @param resource|\GdImage $image */
    private static function resizeWebp($image, int $targetWidth, string $output, int $quality): void
    {
        $width = imagesx($image);
        $height = imagesy($image);
        if ($width <= 0 || $height <= 0) {
            throw new \RuntimeException('Invalid image dimensions.');
        }
        $targetWidth = max(1, min($targetWidth, $width));
        $targetHeight = (int) max(1, round($height * ($targetWidth / $width)));

        $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
        imagefilledrectangle($canvas, 0, 0, $targetWidth, $targetHeight, $transparent);
        imagecopyresampled($canvas, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);

        if (!imagewebp($canvas, $output, $quality)) {
            throw new \RuntimeException('Could not write WebP.');
        }
    }

    /**
     * @return array<string,mixed>
     */
    private static function processVideo(string $source, string $original): array
    {
        $ffmpeg = self::ffmpeg();
        if ($ffmpeg === null) {
            throw new \RuntimeException('Video processing is not available on this server (ffmpeg missing).');
        }

        $stamp = base_convert((string) round(microtime(true) * 1000), 10, 36)
            . '-' . bin2hex(random_bytes(3));
        $base = 'hero-' . $stamp;
        $dir = Storage::heroDir();

        $webm = $dir . '/' . $base . '.webm';
        $mp4 = $dir . '/' . $base . '.mp4';
        $rawPoster = $dir . '/' . $base . '-raw.png';
        $poster = $dir . '/' . $base . '-poster.webp';

        $filter = 'scale=1920:-2:force_original_aspect_ratio=decrease,fps=24';

        self::run($ffmpeg, [
            '-y', '-i', $source, '-an', '-vf', $filter,
            '-c:v', 'libvpx-vp9', '-row-mt', '1', '-cpu-used', '5',
            '-deadline', 'good', '-crf', '34', '-b:v', '0', $webm,
        ]);

        self::run($ffmpeg, [
            '-y', '-i', $source, '-an', '-vf', $filter,
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', $mp4,
        ]);

        $posterUrl = null;
        try {
            self::run($ffmpeg, ['-y', '-ss', '1', '-i', $source, '-frames:v', '1', '-vf', 'scale=2400:-2', $rawPoster]);
        } catch (\Throwable $e) {
            try {
                self::run($ffmpeg, ['-y', '-i', $source, '-frames:v', '1', '-vf', 'scale=2400:-2', $rawPoster]);
            } catch (\Throwable $ignored) {
            }
        }

        if (is_file($rawPoster) && function_exists('imagewebp')) {
            $contents = file_get_contents($rawPoster);
            $image = $contents !== false ? @imagecreatefromstring($contents) : false;
            if ($image !== false) {
                $width = imagesx($image);
                self::resizeWebp($image, min(2400, $width), $poster, 80);
                $posterUrl = '/uploads/hero/' . $base . '-poster.webp';
            }
            @unlink($rawPoster);
        }

        return [
            'type' => 'video',
            'url' => '/uploads/hero/' . $base . '.webm',
            'fallback' => '/uploads/hero/' . $base . '.mp4',
            'poster' => $posterUrl,
            'bytes' => (int) @filesize($webm),
            'original' => $original !== '' ? $original : null,
        ];
    }

    private static function ffmpeg(): ?string
    {
        $configured = (string) App::cfg('media.ffmpeg', '');
        $binary = $configured !== '' ? $configured : 'ffmpeg';

        if (!function_exists('proc_open')) {
            return null;
        }

        $descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $process = @proc_open([$binary, '-version'], $descriptors, $pipes);
        if (!is_resource($process)) {
            return null;
        }
        stream_get_contents($pipes[1]);
        stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        return proc_close($process) === 0 ? $binary : null;
    }

    /** @param list<string> $args */
    private static function run(string $binary, array $args): void
    {
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = @proc_open(array_merge([$binary], $args), $descriptors, $pipes);
        if (!is_resource($process)) {
            throw new \RuntimeException('Media processing failed.');
        }
        fclose($pipes[0]);
        stream_get_contents($pipes[1]);
        $stderr = (string) stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($process);

        if ($code !== 0) {
            throw new \RuntimeException(trim(substr($stderr, -800)) ?: 'Media processing failed.');
        }
    }
}
