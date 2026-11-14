<?php

declare(strict_types=1);

namespace Ardson;

/**
 * File-backed fixed-window limiter. Shared by every PHP worker, unlike an
 * in-process Map, and still requires no extra service on shared hosting.
 *
 * Read-modify-write happens under a single exclusive lock so concurrent
 * requests cannot both pass at the limit or lose an increment.
 */
final class RateLimiter
{
    public static function hit(string $bucket, string $ip, int $max, int $window): bool
    {
        $file = self::file($bucket, $ip);
        $handle = @fopen($file, 'c+');
        if ($handle === false) {
            Logger::file('Rate limiter could not open ' . $file);
            self::headers($max, $max, $window);
            return true;
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                self::headers($max, $max, $window);
                return true;
            }

            $state = self::decode((string) stream_get_contents($handle), $window);
            if ($state['count'] >= $max) {
                $remaining = 0;
                $reset = max(0, $state['reset'] - time());
                self::headers($max, $remaining, $reset);
                return false;
            }

            $state['count']++;
            self::rewrite($handle, $state);
            self::headers($max, max(0, $max - $state['count']), max(0, $state['reset'] - time()));
            return true;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /** True when a request would be allowed, without consuming a slot. */
    public static function check(string $bucket, string $ip, int $max, int $window): bool
    {
        $file = self::file($bucket, $ip);
        $handle = @fopen($file, 'c+');
        if ($handle === false) {
            return true;
        }

        try {
            if (!flock($handle, LOCK_SH)) {
                return true;
            }
            $state = self::decode((string) stream_get_contents($handle), $window);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }

        $allowed = $state['count'] < $max;
        if (!$allowed) {
            self::headers($max, 0, max(0, $state['reset'] - time()));
        }
        return $allowed;
    }

    /** Consumes a slot after the fact (failed login attempts). */
    public static function add(string $bucket, string $ip, int $window): void
    {
        $file = self::file($bucket, $ip);
        $handle = @fopen($file, 'c+');
        if ($handle === false) {
            Logger::file('Rate limiter could not open ' . $file);
            return;
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                return;
            }
            $state = self::decode((string) stream_get_contents($handle), $window);
            $state['count']++;
            self::rewrite($handle, $state);
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /**
     * @param resource $handle
     * @return array{start:int,count:int,reset:int}
     */
    private static function decode(string $raw, int $window): array
    {
        $now = time();
        $data = $raw !== '' ? json_decode($raw, true) : null;
        if (!is_array($data) || !isset($data['start'], $data['count'])) {
            return ['start' => $now, 'count' => 0, 'reset' => $now + $window];
        }

        $start = (int) $data['start'];
        $count = (int) $data['count'];
        if ($now - $start >= $window) {
            return ['start' => $now, 'count' => 0, 'reset' => $now + $window];
        }
        return ['start' => $start, 'count' => $count, 'reset' => $start + $window];
    }

    /**
     * @param resource $handle
     * @param array{start:int,count:int,reset:int} $state
     */
    private static function rewrite($handle, array $state): void
    {
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode([
            'start' => $state['start'],
            'count' => $state['count'],
        ]));
        fflush($handle);
    }

    private static function file(string $bucket, string $ip): string
    {
        $dir = Storage::storageDir() . '/ratelimit';
        Storage::ensure($dir);
        return $dir . '/' . hash('sha256', $bucket . '|' . $ip) . '.json';
    }

    private static function headers(int $max, int $remaining, int $reset): void
    {
        if (headers_sent()) {
            return;
        }
        header('RateLimit-Limit: ' . $max);
        header('RateLimit-Remaining: ' . max(0, min($remaining, $max)));
        header('RateLimit-Reset: ' . $reset);
    }
}
