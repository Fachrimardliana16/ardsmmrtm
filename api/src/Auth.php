<?php

declare(strict_types=1);

namespace Ardson;

/**
 * Admin authentication: one configured operator plus machine tokens, with
 * hashed, database-backed sessions so PHP workers share login state.
 */
final class Auth
{
    private const MAX_SESSIONS = 100;

    private static ?string $user = null;
    private static ?string $token = null;

    /** @param array<string,mixed> $config */
    public static function requireToken(array $config): void
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ($header === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $header = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if ($header === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $name => $value) {
                if (strcasecmp($name, 'Authorization') === 0) {
                    $header = (string) $value;
                    break;
                }
            }
        }

        // The Node server requires the exact case-sensitive prefix.
        if (strpos($header, 'Bearer ') !== 0) {
            self::unauthorized();
        }
        $token = trim(substr($header, 7));
        if ($token === '') {
            self::unauthorized();
        }

        $adminUser = (string) (($config['admin']['user'] ?? '') ?: 'admin@ardsonmaritime.com');
        $staticTokens = self::staticTokens($config);
        foreach ($staticTokens as $candidate) {
            if (hash_equals(hash('sha256', $candidate), hash('sha256', $token))) {
                self::$token = $token;
                self::$user = $adminUser;
                return;
            }
        }

        $hash = hash('sha256', $token);
        $session = Db::one('SELECT `user`, `expires_at` FROM `admin_sessions` WHERE `token_hash` = ?', [$hash]);
        if ($session === null) {
            self::unauthorized();
        }
        if ((int) $session['expires_at'] <= time()) {
            Db::delete('admin_sessions', '`token_hash` = ?', [$hash]);
            self::unauthorized();
        }

        self::$token = $token;
        self::$user = (string) $session['user'];
    }

    /**
     * Verifies credentials and returns a new session token, or null.
     *
     * @param array<string,mixed> $config
     */
    public static function login(array $config, string $user, string $password): ?string
    {
        $configuredUser = (string) (($config['admin']['user'] ?? '') ?: 'admin@ardsonmaritime.com');
        $configuredPassword = (string) ($config['admin']['password'] ?? '');

        $userMatches = hash_equals(
            hash('sha256', strtolower(trim($user))),
            hash('sha256', strtolower(trim($configuredUser)))
        );

        $passwordMatches = false;
        if ($configuredPassword !== '') {
            if (preg_match('/^\$(2[aby]|argon2)/', $configuredPassword)) {
                $passwordMatches = password_verify($password, $configuredPassword);
            } else {
                $passwordMatches = hash_equals(
                    hash('sha256', $password),
                    hash('sha256', $configuredPassword)
                );
            }
        }

        if (!$userMatches || !$passwordMatches) {
            return null;
        }

        $token = 'amt_' . bin2hex(random_bytes(32));
        $ttl = (int) ($config['admin']['session_ttl'] ?? 43200);
        $now = time();

        Db::delete('admin_sessions', '`expires_at` <= ?', [$now]);

        $count = (int) Db::value('SELECT COUNT(*) FROM `admin_sessions`');
        if ($count >= self::MAX_SESSIONS) {
            Db::run(
                'DELETE FROM `admin_sessions` WHERE `token_hash` IN (SELECT `token_hash` FROM (SELECT `token_hash` FROM `admin_sessions` ORDER BY `issued_at` ASC LIMIT ' . ($count - self::MAX_SESSIONS + 1) . ') AS oldest)'
            );
        }

        Db::insert('admin_sessions', [
            'token_hash' => hash('sha256', $token),
            'user' => $configuredUser,
            'issued_at' => $now,
            'expires_at' => $now + $ttl,
        ]);

        self::$token = $token;
        self::$user = $configuredUser;

        return $token;
    }

    public static function logout(): void
    {
        if (self::$token !== null) {
            Db::delete('admin_sessions', '`token_hash` = ?', [hash('sha256', self::$token)]);
        }
        self::$token = null;
        self::$user = null;
    }

    public static function user(): ?string
    {
        return self::$user;
    }

    public static function token(): ?string
    {
        return self::$token;
    }

    /**
     * Kept for contract compatibility: the Node server exposes roles and
     * permissions but does not enforce them per route. Every authenticated
     * operator therefore has full access, exactly as before.
     */
    public static function requirePermission(string $permission): void
    {
        // Intentional no-op. See README "Authorization" for the trade-off.
    }

    private static function unauthorized(): void
    {
        header('WWW-Authenticate: Bearer realm="ardson-admin"');
        Response::fail('Admin authentication required.', 401);
    }

    /**
     * @param array<string,mixed> $config
     * @return list<string>
     */
    public static function staticTokens(array $config): array
    {
        $tokens = $config['admin']['tokens'] ?? [];
        if (is_string($tokens)) {
            $tokens = explode(',', $tokens);
        }
        $out = [];
        foreach ((array) $tokens as $token) {
            $token = trim((string) $token);
            if ($token !== '') {
                $out[] = $token;
            }
        }
        return $out;
    }
}
