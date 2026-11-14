<?php

declare(strict_types=1);

namespace Ardson;

/**
 * Activity log, mirroring store.recordLog: newest first, max 500 rows.
 */
final class Logger
{
    private const MAX_ROWS = 500;

    public static function record(
        string $level,
        string $action,
        string $target = '',
        string $detail = '',
        ?string $actor = null
    ): void {
        $level = in_array($level, ['info', 'warning', 'error'], true) ? $level : 'info';
        $actor = $actor !== null && $actor !== '' ? $actor : (Auth::user() ?? 'system');

        try {
            $id = self::nextLogId();
            Db::insert('logs', [
                'id' => $id,
                'level' => $level,
                'actor' => $actor,
                'action' => $action,
                'target' => $target,
                'detail' => $detail,
                'created_at' => self::isoNow(),
            ]);
            Db::run(
                'DELETE FROM `logs` WHERE `seq` NOT IN (SELECT `seq` FROM (SELECT `seq` FROM `logs` ORDER BY `seq` DESC LIMIT ' . self::MAX_ROWS . ') AS keep_rows)'
            );
        } catch (\Throwable $e) {
            self::file('[' . $level . '] ' . $action . ' ' . $target . ' — ' . $detail . ' (' . $e->getMessage() . ')');
        }
    }

    public static function exception(\Throwable $e): void
    {
        self::file(
            'Unhandled ' . get_class($e) . ': ' . $e->getMessage()
            . ' in ' . $e->getFile() . ':' . $e->getLine()
        );
        try {
            self::record('error', 'Unhandled exception', get_class($e), $e->getMessage());
        } catch (\Throwable $ignored) {
            // Logging must never mask the original failure.
        }
    }

    public static function file(string $line): void
    {
        try {
            $dir = Storage::storageDir() . '/logs';
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            @file_put_contents(
                $dir . '/app.log',
                '[' . self::isoNow() . '] ' . $line . PHP_EOL,
                FILE_APPEND | LOCK_EX
            );
        } catch (\Throwable $ignored) {
        }
    }

    public static function isoNow(): string
    {
        return Clock::isoNow();
    }

    private static function nextLogId(): string
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $seq = Db::nextCounter('logSeq');
            $id = 'log-' . $seq;
            $exists = Db::value('SELECT COUNT(*) FROM `logs` WHERE `id` = ?', [$id]);
            if ((int) $exists === 0) {
                return $id;
            }
        }
        return 'log-' . Db::nextCounter('logSeq') . '-' . bin2hex(random_bytes(2));
    }
}
