<?php
/**
 * Ardson Maritime API — front controller.
 *
 * Deployed at public_html/api/. Apache/LiteSpeed rewrites every request
 * under /api/ here (see .htaccess).
 */

declare(strict_types=1);

if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'message' => 'This server needs PHP 8.1 or newer.',
    ]);
    exit;
}

define('API_ROOT', __DIR__);
define('APP_START', microtime(true));

spl_autoload_register(static function (string $class): void {
    $prefix = 'Ardson\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = API_ROOT . '/src/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

require API_ROOT . '/src/App.php';

$configFile = API_ROOT . '/config.php';
if (!is_file($configFile)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'message' => 'API is not configured yet. Copy api/config.example.php to api/config.php and fill in the database and admin credentials.',
    ]);
    exit;
}

$config = require $configFile;
if (!is_array($config)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'message' => 'api/config.php must return an array.']);
    exit;
}

Ardson\App::run($config);
