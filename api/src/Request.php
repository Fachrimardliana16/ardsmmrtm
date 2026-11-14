<?php

declare(strict_types=1);

namespace Ardson;

final class Request
{
    /** @var array<string,mixed> */
    private array $config;

    /** @var array<string,mixed>|null */
    private ?array $json = null;

    /** @param array<string,mixed> $config */
    public function __construct(array $config)
    {
        $this->config = $config;
    }

    public function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public function path(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $uri = is_string($uri) ? $uri : '/';

        $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
        $base = rtrim(str_replace('/index.php', '', $script), '/');

        if ($base !== '' && strpos($uri, $base) === 0) {
            $uri = substr($uri, strlen($base));
        }

        if ($uri === '' || $uri === false) {
            $uri = '/';
        }

        return '/' . ltrim($uri, '/');
    }

    /** @return mixed */
    public function query(string $key, $default = null)
    {
        return $_GET[$key] ?? $default;
    }

    /**
     * Merged body: JSON payload, urlencoded form and multipart fields.
     *
     * @return array<string,mixed>
     */
    public function body(): array
    {
        $contentType = strtolower($_SERVER['CONTENT_TYPE'] ?? '');

        if ($this->json === null) {
            $this->json = [];
            if (strpos($contentType, 'application/json') !== false) {
                $raw = file_get_contents('php://input');
                if (is_string($raw) && trim($raw) !== '') {
                    $decoded = json_decode($raw, true);
                    if (is_array($decoded)) {
                        $this->json = $decoded;
                    }
                }
            }
        }

        return array_merge($_POST, $this->json);
    }

    /**
     * @return array{name:string,type:string,tmp_name:string,error:int,size:int}|null
     */
    public function file(string $key): ?array
    {
        if (!isset($_FILES[$key]) || !is_array($_FILES[$key])) {
            return null;
        }
        $file = $_FILES[$key];
        if (!isset($file['tmp_name']) || !is_string($file['tmp_name']) || $file['tmp_name'] === '') {
            return null;
        }
        return $file;
    }

    public function header(string $name): ?string
    {
        $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        if (isset($_SERVER[$serverKey])) {
            return (string) $_SERVER[$serverKey];
        }
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            foreach ($headers as $key => $value) {
                if (strcasecmp($key, $name) === 0) {
                    return (string) $value;
                }
            }
        }
        return null;
    }

    public function bearer(): ?string
    {
        $auth = $this->header('Authorization');
        // Apache sometimes hides Authorization from PHP when proxied.
        if ($auth === null && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $auth = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if ($auth === null && isset($_SERVER['PHP_AUTH_PW'])) {
            $auth = 'Bearer ' . $_SERVER['PHP_AUTH_PW'];
        }
        if ($auth !== null && preg_match('/^Bearer\s+(.+)$/i', trim($auth), $m)) {
            return trim($m[1]);
        }
        return null;
    }

    public function ip(): string
    {
        $trustProxy = (bool) ($this->config['app']['trust_proxy'] ?? false);
        if ($trustProxy) {
            $forwarded = $this->header('X-Forwarded-For');
            if ($forwarded !== null && $forwarded !== '') {
                $first = trim(explode(',', $forwarded)[0]);
                if (filter_var($first, FILTER_VALIDATE_IP)) {
                    return $first;
                }
            }
        }
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    }

    public function isMultipart(): bool
    {
        return strpos(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data') !== false;
    }
}
