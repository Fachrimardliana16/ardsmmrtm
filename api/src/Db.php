<?php

declare(strict_types=1);

namespace Ardson;

use PDO;
use PDOException;

final class Db
{
    private static ?PDO $pdo = null;

    /** @var array<string,mixed> */
    private static array $config = [];

    private static string $driver = 'mysql';

    /** @param array<string,mixed> $config */
    public static function init(array $config): void
    {
        self::$config = $config;
        self::$driver = strtolower((string) ($config['driver'] ?? 'mysql'));

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ];

        if (self::$driver === 'sqlite') {
            $path = self::sqlitePath((string) ($config['path'] ?? ''));
            $dir = dirname($path);
            if ($dir !== '' && !is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }

            $isNew = !is_file($path);
            self::$pdo = new PDO('sqlite:' . $path, null, null, $options);
            self::$pdo->exec('PRAGMA busy_timeout = 5000');
            self::$pdo->exec('PRAGMA foreign_keys = ON');
            self::$pdo->exec('PRAGMA journal_mode = WAL');
            self::$pdo->exec('PRAGMA synchronous = NORMAL');
            if ($isNew) {
                @chmod($path, 0600);
            }
            return;
        }

        if (self::$driver !== 'mysql') {
            throw new \InvalidArgumentException('Unsupported database driver: ' . self::$driver);
        }

        $host = (string) ($config['host'] ?? 'localhost');
        $port = (int) ($config['port'] ?? 3306);
        $name = (string) ($config['name'] ?? '');
        $charset = (string) ($config['charset'] ?? 'utf8mb4');

        $dsn = 'mysql:host=' . $host . ';port=' . $port . ';dbname=' . $name . ';charset=' . $charset;

        self::$pdo = new PDO($dsn, (string) ($config['user'] ?? ''), (string) ($config['pass'] ?? ''), $options);
    }

    public static function driver(): string
    {
        return self::$driver;
    }

    private static function sqlitePath(string $path): string
    {
        if ($path === '') {
            $path = dirname(__DIR__) . '/storage/ardson.sqlite';
        } elseif ($path[0] !== '/' && !preg_match('/^[A-Za-z]:[\\\\\\/]/', $path)) {
            $path = dirname(__DIR__) . '/' . ltrim($path, '/');
        }
        return $path;
    }

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            throw new \RuntimeException('Database is not initialised.');
        }
        return self::$pdo;
    }

    /** @param array<string|int,mixed> $params */
    public static function run(string $sql, array $params = []): \PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /**
     * @param array<string|int,mixed> $params
     * @return list<array<string,mixed>>
     */
    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }

    /**
     * @param array<string|int,mixed> $params
     * @return array<string,mixed>|null
     */
    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /** @param array<string|int,mixed> $params */
    public static function value(string $sql, array $params = [])
    {
        $value = self::run($sql, $params)->fetchColumn();
        return $value === false ? null : $value;
    }

    /** @param array<string,mixed> $data */
    public static function insert(string $table, array $data): void
    {
        $columns = array_keys($data);
        $sql = 'INSERT INTO `' . self::ident($table) . '` (`'
            . implode('`,`', array_map([self::class, 'ident'], $columns))
            . '`) VALUES (' . self::placeholders($columns) . ')';
        self::run($sql, array_values($data));
    }

    /**
     * @param array<string,mixed> $data
     * @param array<string|int,mixed> $params
     */
    public static function update(string $table, array $data, string $where, array $params = []): int
    {
        $sets = [];
        foreach (array_keys($data) as $column) {
            $sets[] = '`' . self::ident($column) . '` = ?';
        }
        $sql = 'UPDATE `' . self::ident($table) . '` SET ' . implode(', ', $sets) . ' WHERE ' . $where;
        return self::run($sql, array_merge(array_values($data), $params))->rowCount();
    }

    /** @param array<string|int,mixed> $params */
    public static function delete(string $table, string $where, array $params = []): int
    {
        $sql = 'DELETE FROM `' . self::ident($table) . '` WHERE ' . $where;
        return self::run($sql, $params)->rowCount();
    }

    /**
     * Atomic named counter. Used for IDs and references, mirroring the
     * monotonic counters in the Node store.
     */
    public static function nextCounter(string $name): int
    {
        if (self::$driver === 'sqlite') {
            return self::transaction(static function () use ($name): int {
                // Single atomic upsert; SQLite has no SELECT ... FOR UPDATE.
                self::run(
                    'INSERT INTO `counters` (`name`, `value`) VALUES (?, 1)'
                    . ' ON CONFLICT(`name`) DO UPDATE SET `value` = `value` + 1',
                    [$name]
                );
                return (int) self::value('SELECT `value` FROM `counters` WHERE `name` = ?', [$name]);
            });
        }

        return self::transaction(static function () use ($name): int {
            $row = self::one('SELECT `value` FROM `counters` WHERE `name` = ? FOR UPDATE', [$name]);
            if ($row === null) {
                self::insert('counters', ['name' => $name, 'value' => 1]);
                return 1;
            }
            $next = (int) $row['value'] + 1;
            self::run('UPDATE `counters` SET `value` = ? WHERE `name` = ?', [$next, $name]);
            return $next;
        });
    }

    /**
     * @template T
     * @param callable():T $fn
     * @return T
     */
    public static function transaction(callable $fn)
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /** @param array<int,string> $columns */
    private static function placeholders(array $columns): string
    {
        return implode(',', array_fill(0, count($columns), '?'));
    }

    /** Rejects anything that is not a plain identifier. */
    private static function ident(string $name): string
    {
        if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name)) {
            throw new \InvalidArgumentException('Invalid SQL identifier: ' . $name);
        }
        return $name;
    }
}
