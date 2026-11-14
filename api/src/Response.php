<?php

declare(strict_types=1);

namespace Ardson;

final class Response
{
    /** @param array<string,mixed> $payload */
    public static function json(int $status, array $payload, array $headers = []): void
    {
        if (!headers_sent()) {
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            foreach ($headers as $name => $value) {
                header($name . ': ' . $value);
            }
        }

        echo json_encode(
            $payload,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
        );
        exit;
    }

    /** @param array<string,mixed> $payload */
    public static function ok(array $payload = [], int $status = 200, array $headers = []): void
    {
        self::json($status, array_merge(['ok' => true], $payload), $headers);
    }

    /** @param array<string,mixed> $extra */
    public static function fail(string $message, int $status = 400, array $extra = []): void
    {
        self::json($status, array_merge(['ok' => false, 'message' => $message], $extra));
    }

    public static function raw(int $status, string $body, array $headers = []): void
    {
        if (!headers_sent()) {
            http_response_code($status);
            header('Cache-Control: no-store');
            foreach ($headers as $name => $value) {
                header($name . ': ' . $value);
            }
        }
        echo $body;
        exit;
    }
}
