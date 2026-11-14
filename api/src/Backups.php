<?php

declare(strict_types=1);

namespace Ardson;

/**
 * JSON snapshots stored in the database. Download/restore behave like the
 * in-memory implementation, but survive restarts and PHP workers.
 */
final class Backups
{
    /** @return array<string,mixed> */
    public static function snapshot(): array
    {
        return [
            'settings' => Settings::get(),
            'jobs' => Store::listAllJobs(),
            'seafarers' => Store::listSeafarers(),
            'crewRequests' => Store::listCrewRequests(),
            'contacts' => Store::listContacts(),
            'subscribers' => Store::listSubscribers(),
            'adminUsers' => Store::listUsers(),
            'roles' => Store::listRoles(),
            'insights' => Store::listInsights(),
        ];
    }

    /** @param array<string,mixed> $snapshot @return array<string,int> */
    public static function counts(array $snapshot): array
    {
        return [
            'jobs' => count((array) ($snapshot['jobs'] ?? [])),
            'seafarers' => count((array) ($snapshot['seafarers'] ?? [])),
            'crewRequests' => count((array) ($snapshot['crewRequests'] ?? [])),
            'contacts' => count((array) ($snapshot['contacts'] ?? [])),
            'subscribers' => count((array) ($snapshot['subscribers'] ?? [])),
            'insights' => count((array) ($snapshot['insights'] ?? [])),
        ];
    }

    /** @return list<array<string,mixed>> */
    public static function list(): array
    {
        return array_map([self::class, 'metaFromRow'], Db::all('SELECT * FROM `backups` ORDER BY `sort_order` ASC'));
    }

    /** @return array<string,mixed>|null */
    public static function meta(string $id): ?array
    {
        $row = Db::one('SELECT * FROM `backups` WHERE `id` = ?', [$id]);
        return $row === null ? null : self::metaFromRow($row);
    }

    /** @return array<string,mixed> */
    public static function create(string $actor): array
    {
        $snapshot = self::snapshot();
        $json = self::encode($snapshot);
        $filename = 'ardson-backup-' . gmdate('Y-m-d\TH-i-s') . '.json';
        $counts = self::counts($snapshot);

        $row = [
            'id' => 'bak-' . str_pad((string) Db::nextCounter('backupSeq'), 3, '0', STR_PAD_LEFT),
            'sort_order' => self::nextSort(),
            'filename' => $filename,
            'payload' => $json,
            'created_at' => Clock::isoNow(),
            'created_by' => $actor,
            'size_kb' => max(1, (int) round(strlen($json) / 1024)),
            'status' => 'ready',
            'counts' => json_encode($counts, JSON_UNESCAPED_UNICODE),
        ];
        Db::insert('backups', $row);

        Logger::record('info', 'Created backup', $filename, '', $actor);
        return self::metaFromRow($row);
    }

    /** @return array<string,mixed>|null */
    public static function payload(string $id): ?array
    {
        $row = Db::one('SELECT `payload` FROM `backups` WHERE `id` = ?', [$id]);
        if ($row === null) {
            return null;
        }
        $decoded = json_decode((string) $row['payload'], true);
        return is_array($decoded) ? $decoded : null;
    }

    public static function delete(string $id): bool
    {
        return Db::delete('backups', '`id` = ?', [$id]) > 0;
    }

    /** @return array<string,mixed>|null */
    public static function restore(string $id, string $actor): ?array
    {
        $meta = self::meta($id);
        $snapshot = self::payload($id);
        if ($meta === null || $snapshot === null) {
            return null;
        }

        Db::transaction(static function () use ($snapshot): void {
            if (is_array($snapshot['settings'] ?? null)) {
                Settings::save($snapshot['settings']);
            }
            self::replaceJobs((array) ($snapshot['jobs'] ?? []));
            self::replaceSeafarers((array) ($snapshot['seafarers'] ?? []));
            self::replaceCrewRequests((array) ($snapshot['crewRequests'] ?? []));
            self::replaceContacts((array) ($snapshot['contacts'] ?? []));
            self::replaceSubscribers((array) ($snapshot['subscribers'] ?? []));
            self::replaceUsers((array) ($snapshot['adminUsers'] ?? []));
            self::replaceRoles((array) ($snapshot['roles'] ?? []));
            self::replaceInsights((array) ($snapshot['insights'] ?? []));
        });

        Logger::record('warning', 'Restored backup', (string) $meta['filename'], '', $actor);
        return $meta;
    }

    /* ------------------------------------------------------------------ */
    /* Seed installation                                                  */
    /* ------------------------------------------------------------------ */

    /**
     * First-run seed. The JSON is the exact snapshot exported from the
     * original Node store, so the site starts with the same content.
     *
     * @param array<string,mixed> $seed
     */
    public static function installSeed(array $seed): void
    {
        if (is_array($seed['settings'] ?? null)) {
            Settings::save($seed['settings']);
        }
        self::replaceJobs((array) ($seed['jobs'] ?? []));
        self::replaceSeafarers((array) ($seed['seafarers'] ?? []));
        self::replaceCrewRequests((array) ($seed['crew_requests'] ?? []));
        self::replaceContacts((array) ($seed['contacts'] ?? []));
        self::replaceSubscribers((array) ($seed['subscribers'] ?? []));
        self::replaceRoles((array) ($seed['roles'] ?? []));
        self::replaceUsers((array) ($seed['users'] ?? []));

        foreach ((array) ($seed['insights'] ?? []) as $index => $record) {
            $known = ['id', 'slug', 'title', 'tag', 'date', 'read', 'image', 'lede', 'body', 'status', 'created_at'];
            $extra = array_diff_key($record, array_flip($known));
            Db::insert('insights', [
                'id' => (string) ($record['id'] ?? ''),
                'sort_order' => $index + 1,
                'slug' => (string) ($record['slug'] ?? ''),
                'title' => (string) ($record['title'] ?? ''),
                'tag' => (string) ($record['tag'] ?? 'Career guide'),
                'date' => (string) ($record['date'] ?? Clock::dateNow()),
                'read' => (string) ($record['read'] ?? '4 min read'),
                'image' => (string) ($record['image'] ?? ''),
                'lede' => (string) ($record['lede'] ?? ''),
                'body' => (string) ($record['body'] ?? ''),
                'status' => (string) ($record['status'] ?? 'draft'),
                'created_at' => (string) ($record['created_at'] ?? Clock::isoNow()),
                'extra' => $extra === [] ? null : self::encode($extra),
            ]);
        }

        foreach ((array) ($seed['logs'] ?? []) as $record) {
            Db::insert('logs', [
                'id' => (string) ($record['id'] ?? ''),
                'level' => (string) ($record['level'] ?? 'info'),
                'actor' => (string) ($record['actor'] ?? 'system'),
                'action' => (string) ($record['action'] ?? ''),
                'target' => (string) ($record['target'] ?? ''),
                'detail' => (string) ($record['detail'] ?? ''),
                'created_at' => (string) ($record['created_at'] ?? Clock::isoNow()),
            ]);
        }

        self::seedDemoBackups('system');
    }

    /** Used by install.php to recreate the two demo backups. */
    public static function seedDemoBackups(string $actor): void
    {
        $snapshot = self::snapshot();
        $json = self::encode($snapshot);
        $counts = self::counts($snapshot);
        $sizeKb = max(1, (int) round(strlen($json) / 1024));

        $rows = [
            [
                'id' => 'bak-001',
                'sort_order' => 1,
                'filename' => 'ardson-backup-2026-11-08.json',
                'created_at' => '2026-11-08T09:00:00.000Z',
                'size_kb' => $sizeKb,
            ],
            [
                'id' => 'bak-002',
                'sort_order' => 2,
                'filename' => 'ardson-backup-2026-11-01.json',
                'created_at' => '2026-11-01T09:00:00.000Z',
                'size_kb' => $sizeKb,
            ],
        ];

        foreach ($rows as $row) {
            Db::insert('backups', array_merge($row, [
                'payload' => $json,
                'created_by' => $actor,
                'status' => 'ready',
                'counts' => json_encode($counts, JSON_UNESCAPED_UNICODE),
            ]));
        }
    }

    /* ------------------------------------------------------------------ */
    /* Row mapping                                                        */
    /* ------------------------------------------------------------------ */

    private static function replaceJobs(array $rows): void
    {
        Db::delete('jobs', '1 = 1');
        foreach ($rows as $index => $job) {
            $known = ['id', 'title', 'category', 'vessel_type', 'vessel_name', 'principal', 'flag_state',
                'salary_min', 'salary_max', 'salary_currency', 'contract_duration', 'joining_date', 'status', 'posted_at'];
            $extra = array_diff_key($job, array_flip($known));
            Db::insert('jobs', [
                'id' => (string) ($job['id'] ?? ''),
                'sort_order' => $index + 1,
                'title' => (string) ($job['title'] ?? ''),
                'category' => (string) ($job['category'] ?? 'deck'),
                'vessel_type' => (string) ($job['vessel_type'] ?? 'Container'),
                'vessel_name' => (string) ($job['vessel_name'] ?? ''),
                'principal' => (string) ($job['principal'] ?? ''),
                'flag_state' => (string) ($job['flag_state'] ?? ''),
                'salary_min' => (int) ($job['salary_min'] ?? 0),
                'salary_max' => (int) ($job['salary_max'] ?? 0),
                'salary_currency' => (string) ($job['salary_currency'] ?? 'USD'),
                'contract_duration' => (string) ($job['contract_duration'] ?? '4 months'),
                'joining_date' => (string) ($job['joining_date'] ?? Clock::dateNow()),
                'status' => (string) ($job['status'] ?? 'open'),
                'posted_at' => (string) ($job['posted_at'] ?? Clock::isoNow()),
                'extra' => $extra === [] ? null : self::encode($extra),
            ]);
        }
    }

    private static function replaceSeafarers(array $rows): void
    {
        Db::delete('seafarers', '1 = 1');
        foreach ($rows as $index => $record) {
            Db::insert('seafarers', [
                'id' => (string) ($record['id'] ?? ''),
                'sort_order' => $index + 1,
                'reference' => (string) ($record['reference'] ?? ''),
                'name' => (string) ($record['name'] ?? ''),
                'email' => (string) ($record['email'] ?? ''),
                'phone' => (string) ($record['phone'] ?? ''),
                'applied_rank' => (string) ($record['applied_rank'] ?? ''),
                'vessel_experience' => (string) ($record['vessel_experience'] ?? 'Other'),
                'certifications' => self::encode((array) ($record['certifications'] ?? [])),
                'cv_file' => $record['cv_file'] ?? null,
                'status' => (string) ($record['status'] ?? 'new'),
                'notes' => $record['notes'] ?? null,
                'screened_by' => $record['screened_by'] ?? null,
                'screened_at' => $record['screened_at'] ?? null,
                'created_at' => (string) ($record['created_at'] ?? Clock::isoNow()),
                'updated_at' => $record['updated_at'] ?? null,
            ]);
        }
    }

    private static function replaceCrewRequests(array $rows): void
    {
        Db::delete('crew_requests', '1 = 1');
        foreach ($rows as $index => $record) {
            Db::insert('crew_requests', [
                'id' => (string) ($record['id'] ?? ''),
                'sort_order' => $index + 1,
                'reference' => (string) ($record['reference'] ?? ''),
                'company_name' => (string) ($record['company_name'] ?? ''),
                'email' => (string) ($record['email'] ?? ''),
                'vessel_type' => (string) ($record['vessel_type'] ?? ''),
                'joining_date' => (string) ($record['joining_date'] ?? ''),
                'required_ranks' => (string) ($record['required_ranks'] ?? ''),
                'contract_duration' => (string) ($record['contract_duration'] ?? 'TBD'),
                'flag_state' => (string) ($record['flag_state'] ?? 'TBD'),
                'status' => (string) ($record['status'] ?? 'new'),
                'emergency' => !empty($record['emergency']) ? 1 : 0,
                'port' => $record['port'] ?? null,
                'reason' => $record['reason'] ?? null,
                'notes' => $record['notes'] ?? null,
                'assigned_to' => $record['assigned_to'] ?? null,
                'created_at' => (string) ($record['created_at'] ?? Clock::isoNow()),
                'updated_at' => $record['updated_at'] ?? null,
            ]);
        }
    }

    private static function replaceContacts(array $rows): void
    {
        Db::delete('contacts', '1 = 1');
        foreach ($rows as $index => $record) {
            Db::insert('contacts', [
                'id' => (string) ($record['id'] ?? ''),
                'sort_order' => $index + 1,
                'name' => (string) ($record['name'] ?? ''),
                'email' => (string) ($record['email'] ?? ''),
                'message' => (string) ($record['message'] ?? ''),
                'status' => (string) ($record['status'] ?? 'unread'),
                'notes' => $record['notes'] ?? null,
                'created_at' => (string) ($record['created_at'] ?? Clock::isoNow()),
                'updated_at' => $record['updated_at'] ?? null,
            ]);
        }
    }

    private static function replaceSubscribers(array $rows): void
    {
        Db::delete('subscribers', '1 = 1');
        foreach ($rows as $record) {
            Db::insert('subscribers', [
                'email' => strtolower((string) ($record['email'] ?? '')),
                'subscribed_at' => (string) ($record['subscribed_at'] ?? Clock::isoNow()),
            ]);
        }
    }

    private static function replaceUsers(array $rows): void
    {
        Db::delete('admin_users', '1 = 1');
        foreach ($rows as $index => $record) {
            Db::insert('admin_users', [
                'id' => (string) ($record['id'] ?? ''),
                'sort_order' => $index + 1,
                'name' => (string) ($record['name'] ?? ''),
                'email' => strtolower((string) ($record['email'] ?? '')),
                'role' => (string) ($record['role'] ?? 'viewer'),
                'status' => (string) ($record['status'] ?? 'invited'),
                'created_at' => (string) ($record['created_at'] ?? Clock::isoNow()),
                'last_login' => $record['last_login'] ?? null,
            ]);
        }
    }

    private static function replaceRoles(array $rows): void
    {
        Db::delete('roles', '1 = 1');
        foreach ($rows as $index => $record) {
            Db::insert('roles', [
                'id' => (string) ($record['id'] ?? ''),
                'sort_order' => $index + 1,
                'slug' => (string) ($record['slug'] ?? ''),
                'name' => (string) ($record['name'] ?? ''),
                'description' => (string) ($record['description'] ?? ''),
                'permissions' => self::encode((array) ($record['permissions'] ?? [])),
                'locked' => !empty($record['locked']) ? 1 : 0,
            ]);
        }
    }

    private static function replaceInsights(array $rows): void
    {
        if ($rows === []) {
            $seed = self::seedFile();
            $rows = (array) ($seed['insights'] ?? []);
        }

        Db::delete('insights', '1 = 1');
        foreach ($rows as $index => $record) {
            $known = ['id', 'slug', 'title', 'tag', 'date', 'read', 'image', 'lede', 'body', 'status', 'created_at'];
            $extra = array_diff_key($record, array_flip($known));
            Db::insert('insights', [
                'id' => (string) ($record['id'] ?? ''),
                'sort_order' => $index + 1,
                'slug' => (string) ($record['slug'] ?? ''),
                'title' => (string) ($record['title'] ?? ''),
                'tag' => (string) ($record['tag'] ?? 'Career guide'),
                'date' => (string) ($record['date'] ?? Clock::dateNow()),
                'read' => (string) ($record['read'] ?? '4 min read'),
                'image' => (string) ($record['image'] ?? ''),
                'lede' => (string) ($record['lede'] ?? ''),
                'body' => (string) ($record['body'] ?? ''),
                'status' => (string) ($record['status'] ?? 'draft'),
                'created_at' => (string) ($record['created_at'] ?? Clock::isoNow()),
                'extra' => $extra === [] ? null : self::encode($extra),
            ]);
        }
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function metaFromRow(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'filename' => (string) $row['filename'],
            'created_at' => (string) $row['created_at'],
            'created_by' => (string) $row['created_by'],
            'size_kb' => (int) $row['size_kb'],
            'status' => (string) $row['status'],
            'counts' => json_decode((string) $row['counts'], true) ?: new \stdClass(),
        ];
    }

    private static function nextSort(): int
    {
        $minimum = Db::value('SELECT MIN(`sort_order`) FROM `backups`');
        return $minimum === null ? 1 : ((int) $minimum - 1);
    }

    /** @param mixed $value */
    private static function encode($value): string
    {
        $json = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return is_string($json) ? $json : '{}';
    }

    /** @return array<string,mixed> */
    private static function seedFile(): array
    {
        $raw = @file_get_contents(API_ROOT . '/data/seed.json');
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : [];
    }
}
