<?php

declare(strict_types=1);

namespace Ardson;

/**
 * Bootstrap: configuration, error handling, CORS, security headers and
 * routing. Routes live in api/routes/*.php and stay plain closures.
 */
final class App
{
    /** @var array<string,mixed> */
    private static array $config = [];

    /** @param array<string,mixed> $config */
    public static function run(array $config): void
    {
        self::$config = $config;

        $debug = (bool) self::cfg('app.debug', false);
        ini_set('display_errors', $debug ? '1' : '0');
        ini_set('log_errors', '1');
        error_reporting(E_ALL);

        set_exception_handler(static function (\Throwable $e) use ($debug): void {
            Logger::exception($e);
            Response::fail(
                $debug ? $e->getMessage() : 'Server error. Please try again later.',
                500
            );
        });

        set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
            if (!(error_reporting() & $severity)) {
                return false;
            }
            throw new \ErrorException($message, 0, $severity, $file, $line);
        });

        self::securityHeaders();

        if (!self::handleCors()) {
            return;
        }

        try {
            Db::init(self::cfg('db', []));
        } catch (\Throwable $e) {
            Logger::exception($e);
            Response::json(503, [
                'ok' => false,
                'message' => $debug
                    ? 'Database connection failed: ' . $e->getMessage()
                    : 'Database unavailable. Please try again shortly.',
            ]);
        }

        $request = new Request(self::$config);
        $router = new Router(self::$config);

        $routesFile = API_ROOT . '/routes/public.php';
        if (is_file($routesFile)) {
            (require $routesFile)($router);
        }

        $adminFile = API_ROOT . '/routes/admin.php';
        if (is_file($adminFile)) {
            (require $adminFile)($router);
        }

        $router->dispatch($request->method(), $request->path());
    }

    /** @return mixed */
    public static function cfg(string $path, $default = null)
    {
        $value = self::$config;
        foreach (explode('.', $path) as $part) {
            if (!is_array($value) || !array_key_exists($part, $value)) {
                return $default;
            }
            $value = $value[$part];
        }
        return $value;
    }

    /** @return array<string,mixed> */
    public static function config(): array
    {
        return self::$config;
    }

    public static function isProduction(): bool
    {
        return self::cfg('app.env', 'production') === 'production';
    }

    private static function securityHeaders(): void
    {
        if (headers_sent()) {
            return;
        }
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: no-referrer');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
        header('Cross-Origin-Opener-Policy: same-origin');
        header('Cross-Origin-Resource-Policy: same-site');
        // The API only ever returns JSON (or an authenticated file download).
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        header_remove('X-Powered-By');
    }

    /**
     * Applies the CORS allowlist and answers preflight requests.
     * Returns false when the request must stop here.
     */
    private static function handleCors(): bool
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = array_map('strval', (array) self::cfg('app.cors_origins', []));
        $sameOrigin = $origin !== '' && self::isSameOrigin($origin);

        if ($origin !== '') {
            if ($sameOrigin || in_array($origin, $allowed, true)) {
                header('Access-Control-Allow-Origin: ' . $origin);
                header('Vary: Origin');
                header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
                header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
                header('Access-Control-Max-Age: 600');
            } elseif (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
                http_response_code(403);
                return false;
            } else {
                // Cross-origin read is blocked by the browser, but the request
                // is still answered without CORS headers (same as the Node server).
            }
        }

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code(204);
            return false;
        }

        return true;
    }

    private static function isSameOrigin(string $origin): bool
    {
        $host = $_SERVER['HTTP_HOST'] ?? '';
        if ($host === '') {
            return false;
        }
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        return $origin === $scheme . '://' . $host;
    }
}
