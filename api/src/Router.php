<?php

declare(strict_types=1);

namespace Ardson;

/**
 * Tiny pattern router. Patterns use {name} placeholders, e.g.
 * /v1/admin/seafarers/{id}/cv
 */
final class Router
{
    /** @var array<string,mixed> */
    private array $config;

    /** @var list<array{method:string,regex:string,keys:list<string>,handler:callable,opts:array<string,mixed>}> */
    private array $routes = [];

    /** @param array<string,mixed> $config */
    public function __construct(array $config)
    {
        $this->config = $config;
    }

    /** @param array<string,mixed> $opts */
    public function add(string $method, string $pattern, callable $handler, array $opts = []): void
    {
        $keys = [];
        $regex = preg_replace_callback(
            '#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#',
            static function (array $m) use (&$keys): string {
                $keys[] = $m[1];
                return '(?P<' . $m[1] . '>[^/]+)';
            },
            $pattern
        );

        $this->routes[] = [
            'method' => strtoupper($method),
            'regex' => '#^' . $regex . '/?$#',
            'keys' => $keys,
            'handler' => $handler,
            'opts' => $opts,
        ];
    }

    /** @param array<string,mixed> $opts */
    public function get(string $pattern, callable $handler, array $opts = []): void
    {
        $this->add('GET', $pattern, $handler, $opts);
    }

    /** @param array<string,mixed> $opts */
    public function post(string $pattern, callable $handler, array $opts = []): void
    {
        $this->add('POST', $pattern, $handler, $opts);
    }

    /** @param array<string,mixed> $opts */
    public function patch(string $pattern, callable $handler, array $opts = []): void
    {
        $this->add('PATCH', $pattern, $handler, $opts);
    }

    /** @param array<string,mixed> $opts */
    public function delete(string $pattern, callable $handler, array $opts = []): void
    {
        $this->add('DELETE', $pattern, $handler, $opts);
    }

    public function dispatch(string $method, string $path): void
    {
        $request = new Request($this->config);

        foreach ($this->routes as $route) {
            if ($route['method'] !== strtoupper($method)) {
                continue;
            }
            if (!preg_match($route['regex'], $path, $matches)) {
                continue;
            }

            $params = [];
            foreach ($route['keys'] as $key) {
                $params[$key] = isset($matches[$key]) ? rawurldecode((string) $matches[$key]) : '';
            }

            $opts = $route['opts'];

            if (!empty($opts['limit'])) {
                $limit = (array) $opts['limit'];
                $max = (int) ($limit['max'] ?? 20);
                $window = (int) ($limit['window'] ?? 600);
                $bucket = (string) ($limit['bucket'] ?? $route['method'] . ' ' . $path);
                if (!RateLimiter::hit($bucket, $request->ip(), $max, $window)) {
                    header('Retry-After: ' . $window);
                    Response::fail('Too many submissions. Please try again later.', 429);
                }
            }

            if (!empty($opts['auth'])) {
                Auth::requireToken($this->config);
            }

            if (!empty($opts['perm'])) {
                Auth::requirePermission((string) $opts['perm']);
            }

            ($route['handler'])($params, $request);
            return;
        }

        Response::fail('Not found', 404);
    }
}
