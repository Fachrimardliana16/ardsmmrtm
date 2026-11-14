<?php
/**
 * One-time installer.
 *
 * 1. Upload everything.
 * 2. Copy config.example.php to config.php and fill in the database.
 * 3. Open https://your-domain/api/install.php once.
 * 4. Delete install.php.
 *
 * It creates the tables and inserts the original demo content. Running it
 * again is refused once the lock file exists.
 */

declare(strict_types=1);

define('API_ROOT', __DIR__);

spl_autoload_register(static function (string $class): void {
    $prefix = 'Ardson\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $file = API_ROOT . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

header('Content-Type: text/plain; charset=utf-8');

if (!is_file(API_ROOT . '/config.php')) {
    http_response_code(503);
    echo "config.php is missing. Copy config.example.php to config.php first.\n";
    exit;
}

$config = require API_ROOT . '/config.php';
$driver = strtolower((string) ($config['db']['driver'] ?? 'mysql'));
try {
    \Ardson\Db::init($config['db'] ?? []);
} catch (\Throwable $e) {
    http_response_code(500);
    echo "Database connection failed.\n\n";
    echo $e->getMessage() . "\n\n";
    if ($driver === 'sqlite') {
        echo "For SQLite, make sure the storage directory is writable and the\n";
        echo "pdo_sqlite extension is enabled.\n";
    } else {
        echo "Check db.host, db.name, db.user and db.pass in api/config.php.\n";
    }
    exit;
}

$lock = API_ROOT . '/storage/installed.lock';
if (is_file($lock)) {
    http_response_code(403);
    echo "Already installed.\n\n";
    echo "Delete storage/installed.lock only if you intentionally want to\n";
    echo "re-run the seed on an empty database.\n";
    exit;
}

$schemaFile = \Ardson\Db::driver() === 'sqlite' ? 'schema.sqlite.sql' : 'schema.sql';
$schema = file_get_contents(API_ROOT . '/' . $schemaFile);
if (!is_string($schema) || trim($schema) === '') {
    http_response_code(500);
    echo $schemaFile . " is missing.\n";
    exit;
}

// Strip comments, then run each statement. The schema has no procedures.
$schema = preg_replace('/^\s*--.*$/m', '', $schema) ?? '';
$statements = array_filter(array_map('trim', explode(';', $schema)));

$created = 0;
foreach ($statements as $statement) {
    if ($statement === '') {
        continue;
    }
    \Ardson\Db::pdo()->exec($statement);
    $created++;
}
echo "Schema ready ({$created} statements).\n";

$jobCount = (int) \Ardson\Db::value('SELECT COUNT(*) FROM `jobs`');
if ($jobCount > 0) {
    echo "Existing data detected; seed skipped.\n";
} else {
    $seedRaw = file_get_contents(API_ROOT . '/data/seed.json');
    $seed = is_string($seedRaw) ? json_decode($seedRaw, true) : null;
    if (!is_array($seed)) {
        http_response_code(500);
        echo "data/seed.json is missing or invalid.\n";
        exit;
    }

    \Ardson\Db::transaction(static function () use ($seed): void {
        \Ardson\Backups::installSeed($seed);

        $counters = [
            'sequence' => 1005,
            'jobSeq' => 1006,
            'idSeq' => 100,
            'insSeq' => 3,
            'heroSlideSeq' => 3,
            'logSeq' => 306,
            'backupSeq' => 2,
        ];
        foreach ($counters as $name => $value) {
            $exists = (int) \Ardson\Db::value('SELECT COUNT(*) FROM `counters` WHERE `name` = ?', [$name]);
            if ($exists === 0) {
                \Ardson\Db::insert('counters', ['name' => $name, 'value' => $value]);
            }
        }
    });

    echo "Demo content imported: jobs, seafarers, crew requests, contacts,\n";
    echo "subscribers, insights, roles, users, logs and backups.\n";
}

\Ardson\Storage::ensure(API_ROOT . '/storage');
file_put_contents($lock, 'installed ' . gmdate('c') . PHP_EOL);

echo "\nDone. Now DELETE api/install.php from the server.\n";
echo "Admin console: /admin/login.html\n";
