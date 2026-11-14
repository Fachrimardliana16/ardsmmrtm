<?php

declare(strict_types=1);

namespace Ardson;

/**
 * Persistence for every entity. Method names and semantics follow the Node
 * store so the API contract and the admin console stay unchanged.
 */
final class Store
{
    /* ------------------------------------------------------------------ */
    /* Jobs                                                               */
    /* ------------------------------------------------------------------ */

    /** @return list<array<string,mixed>> */
    public static function listAllJobs(): array
    {
        return array_map([self::class, 'jobFromRow'], Db::all('SELECT * FROM `jobs` ORDER BY `sort_order` ASC'));
    }

    /** @return list<array<string,mixed>> */
    public static function listJobs(?string $category): array
    {
        $jobs = self::listAllJobs();
        if ($category === null || $category === '' || $category === 'all') {
            return $jobs;
        }
        return array_values(array_filter($jobs, static fn(array $job): bool => $job['category'] === $category));
    }

    /** @return array<string,mixed>|null */
    public static function getJob(string $id): ?array
    {
        $row = Db::one('SELECT * FROM `jobs` WHERE `id` = ?', [$id]);
        return $row === null ? null : self::jobFromRow($row);
    }

    /** @param array<string,mixed> $payload @return array<string,mixed> */
    public static function createJob(array $payload): array
    {
        $id = 'AM-JOB-' . Db::nextCounter('jobSeq');
        $row = [
            'id' => $id,
            'sort_order' => self::nextSort('jobs'),
            'title' => (string) ($payload['title'] ?? ''),
            'category' => (string) ($payload['category'] ?? 'deck'),
            'vessel_type' => (string) ($payload['vessel_type'] ?? 'Container'),
            'vessel_name' => (string) ($payload['vessel_name'] ?? ''),
            'principal' => (string) ($payload['principal'] ?? ''),
            'flag_state' => (string) ($payload['flag_state'] ?? ''),
            'salary_min' => (int) (is_numeric($payload['salary_min'] ?? null) ? $payload['salary_min'] : 0),
            'salary_max' => (int) (is_numeric($payload['salary_max'] ?? null) ? $payload['salary_max'] : 0),
            'salary_currency' => (string) ($payload['salary_currency'] ?? 'USD'),
            'contract_duration' => (string) ($payload['contract_duration'] ?? '4 months'),
            'joining_date' => (string) (($payload['joining_date'] ?? '') ?: Clock::dateNow()),
            'status' => (string) ($payload['status'] ?? 'open'),
            'posted_at' => Clock::isoNow(),
            'extra' => null,
        ];
        Db::insert('jobs', $row);
        return self::jobFromRow($row);
    }

    /** @param array<string,mixed> $patch @return array<string,mixed>|null */
    public static function updateJob(string $id, array $patch): ?array
    {
        $row = Db::one('SELECT * FROM `jobs` WHERE `id` = ?', [$id]);
        if ($row === null) {
            return null;
        }

        $known = [
            'title', 'category', 'vessel_type', 'vessel_name', 'principal', 'flag_state',
            'salary_min', 'salary_max', 'salary_currency', 'contract_duration',
            'joining_date', 'status', 'posted_at',
        ];
        $data = [];
        foreach ($known as $column) {
            if (!array_key_exists($column, $patch)) {
                continue;
            }
            $value = $patch[$column];
            if (in_array($column, ['salary_min', 'salary_max'], true)) {
                $value = (int) $value;
            } else {
                $value = $value === null ? null : (string) $value;
            }
            $data[$column] = $value;
        }

        $extra = self::decodeArray($row['extra'] ?? null);
        foreach ($patch as $key => $value) {
            if (!in_array($key, $known, true)) {
                $extra[$key] = $value;
            }
        }
        $data['extra'] = json_encode($extra, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        Db::update('jobs', $data, '`id` = ?', [$id]);
        return self::getJob($id);
    }

    public static function deleteJob(string $id): bool
    {
        return Db::delete('jobs', '`id` = ?', [$id]) > 0;
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function jobFromRow(array $row): array
    {
        $job = [
            'id' => (string) $row['id'],
            'title' => (string) $row['title'],
            'category' => (string) $row['category'],
            'vessel_type' => (string) $row['vessel_type'],
            'vessel_name' => (string) $row['vessel_name'],
            'principal' => (string) $row['principal'],
            'flag_state' => (string) $row['flag_state'],
            'salary_min' => (int) $row['salary_min'],
            'salary_max' => (int) $row['salary_max'],
            'salary_currency' => (string) $row['salary_currency'],
            'contract_duration' => (string) $row['contract_duration'],
            'joining_date' => (string) $row['joining_date'],
            'status' => (string) $row['status'],
            'posted_at' => (string) $row['posted_at'],
        ];
        return array_merge($job, self::decodeArray($row['extra'] ?? null));
    }

    /* ------------------------------------------------------------------ */
    /* Seafarers                                                          */
    /* ------------------------------------------------------------------ */

    /** @return list<array<string,mixed>> */
    public static function listSeafarers(): array
    {
        return array_map(
            [self::class, 'seafarerFromRow'],
            Db::all('SELECT * FROM `seafarers` ORDER BY `sort_order` ASC')
        );
    }

    /** @return array<string,mixed>|null */
    public static function getSeafarer(string $id): ?array
    {
        $row = Db::one('SELECT * FROM `seafarers` WHERE `id` = ?', [$id]);
        return $row === null ? null : self::seafarerFromRow($row);
    }

    /** @param array<string,mixed> $data @return array<string,mixed> */
    public static function createSeafarer(array $data): array
    {
        $id = 'srf-' . Db::nextCounter('idSeq');
        $reference = self::nextReference('AM');
        $certifications = $data['certifications'] ?? [];
        if (is_string($certifications)) {
            $decoded = json_decode($certifications, true);
            $certifications = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($certifications)) {
            $certifications = [];
        }

        $row = [
            'id' => $id,
            'sort_order' => self::nextSort('seafarers'),
            'reference' => $reference,
            'name' => (string) ($data['name'] ?? ''),
            'email' => (string) ($data['email'] ?? ''),
            'phone' => (string) ($data['phone'] ?? ''),
            'applied_rank' => (string) ($data['applied_rank'] ?? ''),
            'vessel_experience' => (string) (($data['vessel_experience'] ?? '') ?: 'Other'),
            'certifications' => json_encode(array_values($certifications), JSON_UNESCAPED_UNICODE),
            'cv_file' => isset($data['cv_file']) && $data['cv_file'] !== '' ? (string) $data['cv_file'] : null,
            'status' => 'new',
            'notes' => null,
            'screened_by' => null,
            'screened_at' => null,
            'created_at' => Clock::isoNow(),
            'updated_at' => null,
        ];
        Db::insert('seafarers', $row);
        return self::seafarerFromRow($row);
    }

    /** @return array<string,mixed>|null */
    public static function updateSeafarerStatus(string $id, string $status, ?string $notes, string $actor): ?array
    {
        $row = Db::one('SELECT * FROM `seafarers` WHERE `id` = ?', [$id]);
        if ($row === null) {
            return null;
        }
        $notesToStore = $notes !== null ? $notes : (string) ($row['notes'] ?? '');
        Db::update('seafarers', [
            'status' => $status,
            'notes' => $notesToStore,
            'screened_by' => $actor,
            'screened_at' => Clock::isoNow(),
            'updated_at' => Clock::isoNow(),
        ], '`id` = ?', [$id]);
        return self::getSeafarer($id);
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function seafarerFromRow(array $row): array
    {
        $record = [
            'id' => (string) $row['id'],
            'reference' => (string) $row['reference'],
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'phone' => (string) $row['phone'],
            'applied_rank' => (string) $row['applied_rank'],
            'vessel_experience' => (string) $row['vessel_experience'],
            'certifications' => self::decodeList($row['certifications'] ?? null),
            'cv_file' => $row['cv_file'] !== null ? (string) $row['cv_file'] : null,
            'status' => (string) $row['status'],
            'created_at' => (string) $row['created_at'],
        ];
        if ($row['notes'] !== null) {
            $record['notes'] = (string) $row['notes'];
        }
        if ($row['screened_by'] !== null) {
            $record['screened_by'] = (string) $row['screened_by'];
        }
        if ($row['screened_at'] !== null) {
            $record['screened_at'] = (string) $row['screened_at'];
        }
        if ($row['updated_at'] !== null) {
            $record['updated_at'] = (string) $row['updated_at'];
        }
        return $record;
    }

    /* ------------------------------------------------------------------ */
    /* Crew requests                                                      */
    /* ------------------------------------------------------------------ */

    /** @return list<array<string,mixed>> */
    public static function listCrewRequests(): array
    {
        return array_map(
            [self::class, 'crewFromRow'],
            Db::all('SELECT * FROM `crew_requests` ORDER BY `sort_order` ASC')
        );
    }

    /** @return array<string,mixed>|null */
    public static function getCrewRequest(string $id): ?array
    {
        $row = Db::one('SELECT * FROM `crew_requests` WHERE `id` = ?', [$id]);
        return $row === null ? null : self::crewFromRow($row);
    }

    /** @param array<string,mixed> $data @return array<string,mixed> */
    public static function createCrewRequest(array $data): array
    {
        $row = [
            'id' => 'creq-' . Db::nextCounter('idSeq'),
            'sort_order' => self::nextSort('crew_requests'),
            'reference' => self::nextReference('AMR'),
            'company_name' => (string) ($data['company_name'] ?? ''),
            'email' => (string) ($data['email'] ?? ''),
            'vessel_type' => (string) ($data['vessel_type'] ?? ''),
            'joining_date' => (string) ($data['joining_date'] ?? ''),
            'required_ranks' => (string) ($data['required_ranks'] ?? ''),
            'contract_duration' => (string) (($data['contract_duration'] ?? '') ?: 'TBD'),
            'flag_state' => (string) (($data['flag_state'] ?? '') ?: 'TBD'),
            'status' => 'new',
            'emergency' => 0,
            'port' => null,
            'reason' => null,
            'notes' => null,
            'assigned_to' => null,
            'created_at' => Clock::isoNow(),
            'updated_at' => null,
        ];
        Db::insert('crew_requests', $row);
        return self::crewFromRow($row);
    }

    /** @param array<string,mixed> $fields @return array<string,mixed>|null */
    public static function markCrewEmergency(string $id, array $fields): ?array
    {
        if (self::getCrewRequest($id) === null) {
            return null;
        }
        Db::update('crew_requests', [
            'emergency' => 1,
            'port' => (string) ($fields['port'] ?? ''),
            'reason' => (string) ($fields['reason'] ?? ''),
            'notes' => (string) ($fields['notes'] ?? ''),
            'status' => 'emergency',
        ], '`id` = ?', [$id]);
        return self::getCrewRequest($id);
    }

    /** @param array<string,mixed> $patch @return array<string,mixed>|null */
    public static function updateCrewRequest(string $id, array $patch): ?array
    {
        $row = Db::one('SELECT * FROM `crew_requests` WHERE `id` = ?', [$id]);
        if ($row === null) {
            return null;
        }
        $data = ['updated_at' => Clock::isoNow()];
        foreach (['status', 'notes', 'assigned_to'] as $column) {
            if (array_key_exists($column, $patch)) {
                $data[$column] = $patch[$column] === null ? null : (string) $patch[$column];
            }
        }
        Db::update('crew_requests', $data, '`id` = ?', [$id]);
        return self::getCrewRequest($id);
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function crewFromRow(array $row): array
    {
        $record = [
            'id' => (string) $row['id'],
            'reference' => (string) $row['reference'],
            'company_name' => (string) $row['company_name'],
            'email' => (string) $row['email'],
            'vessel_type' => (string) $row['vessel_type'],
            'joining_date' => (string) $row['joining_date'],
            'required_ranks' => (string) $row['required_ranks'],
            'contract_duration' => (string) $row['contract_duration'],
            'flag_state' => (string) $row['flag_state'],
            'status' => (string) $row['status'],
            'created_at' => (string) $row['created_at'],
        ];
        if ((int) $row['emergency'] === 1) {
            $record['emergency'] = true;
        }
        foreach (['port', 'reason', 'notes', 'assigned_to', 'updated_at'] as $optional) {
            if ($row[$optional] !== null) {
                $record[$optional] = (string) $row[$optional];
            }
        }
        return $record;
    }

    /* ------------------------------------------------------------------ */
    /* Contacts                                                           */
    /* ------------------------------------------------------------------ */

    /** @return list<array<string,mixed>> */
    public static function listContacts(): array
    {
        return array_map(
            [self::class, 'contactFromRow'],
            Db::all('SELECT * FROM `contacts` ORDER BY `sort_order` ASC')
        );
    }

    /** @param array<string,mixed> $data @return array<string,mixed> */
    public static function createContact(array $data): array
    {
        $row = [
            'id' => 'msg-' . Db::nextCounter('idSeq'),
            'sort_order' => self::nextSort('contacts'),
            'name' => (string) ($data['name'] ?? ''),
            'email' => (string) ($data['email'] ?? ''),
            'message' => (string) ($data['message'] ?? ''),
            'status' => 'unread',
            'notes' => null,
            'created_at' => Clock::isoNow(),
            'updated_at' => null,
        ];
        Db::insert('contacts', $row);
        return self::contactFromRow($row);
    }

    /** @param array<string,mixed> $patch @return array<string,mixed>|null */
    public static function updateContact(string $id, array $patch): ?array
    {
        $row = Db::one('SELECT * FROM `contacts` WHERE `id` = ?', [$id]);
        if ($row === null) {
            return null;
        }
        $data = ['updated_at' => Clock::isoNow()];
        foreach (['status', 'notes'] as $column) {
            if (array_key_exists($column, $patch)) {
                $data[$column] = $patch[$column] === null ? null : (string) $patch[$column];
            }
        }
        Db::update('contacts', $data, '`id` = ?', [$id]);
        return self::contact($id);
    }

    /** @return array<string,mixed>|null */
    public static function contact(string $id): ?array
    {
        $row = Db::one('SELECT * FROM `contacts` WHERE `id` = ?', [$id]);
        return $row === null ? null : self::contactFromRow($row);
    }

    /** @return array<string,mixed>|null */
    public static function markContactRead(string $id): ?array
    {
        if (self::contact($id) === null) {
            return null;
        }
        Db::update('contacts', ['status' => 'read'], '`id` = ?', [$id]);
        return self::contact($id);
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function contactFromRow(array $row): array
    {
        $record = [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'message' => (string) $row['message'],
            'status' => (string) $row['status'],
            'created_at' => (string) $row['created_at'],
        ];
        if ($row['notes'] !== null) {
            $record['notes'] = (string) $row['notes'];
        }
        if ($row['updated_at'] !== null) {
            $record['updated_at'] = (string) $row['updated_at'];
        }
        return $record;
    }

    /* ------------------------------------------------------------------ */
    /* Subscribers                                                        */
    /* ------------------------------------------------------------------ */

    /** @return array<string,mixed> */
    public static function createSubscriber(string $email): array
    {
        $email = strtolower(trim($email));
        $existing = Db::one('SELECT * FROM `subscribers` WHERE `email` = ?', [$email]);
        if ($existing !== null) {
            return ['email' => (string) $existing['email'], 'subscribed_at' => (string) $existing['subscribed_at']];
        }
        $subscribedAt = Clock::isoNow();
        Db::insert('subscribers', ['email' => $email, 'subscribed_at' => $subscribedAt]);
        return ['email' => $email, 'subscribed_at' => $subscribedAt];
    }

    /** @return list<array<string,mixed>> */
    public static function listSubscribers(): array
    {
        return array_map(static function (array $row): array {
            return [
                'email' => (string) $row['email'],
                'subscribed_at' => (string) $row['subscribed_at'],
            ];
        }, Db::all('SELECT * FROM `subscribers` ORDER BY `subscribed_at` DESC'));
    }

    /* ------------------------------------------------------------------ */
    /* Insights                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * @param array<string,mixed> $opts status, tag
     * @return list<array<string,mixed>>
     */
    public static function listInsights(array $opts = []): array
    {
        $rows = Db::all('SELECT * FROM `insights` ORDER BY `date` DESC, `sort_order` ASC');
        $status = isset($opts['status']) ? strtolower((string) $opts['status']) : null;
        $tag = isset($opts['tag']) ? (string) $opts['tag'] : null;

        $out = [];
        foreach ($rows as $row) {
            if ($status !== null && $status !== '' && strtolower((string) $row['status']) !== $status) {
                continue;
            }
            if ($tag !== null && $tag !== '' && (string) $row['tag'] !== $tag) {
                continue;
            }
            $out[] = self::insightFromRow($row);
        }
        return $out;
    }

    /** @return array<string,mixed>|null */
    public static function getInsight(string $id): ?array
    {
        $row = Db::one('SELECT * FROM `insights` WHERE `id` = ?', [$id]);
        return $row === null ? null : self::insightFromRow($row);
    }

    /** @return array<string,mixed>|null */
    public static function getInsightBySlug(string $slug): ?array
    {
        $row = Db::one('SELECT * FROM `insights` WHERE `slug` = ?', [$slug]);
        return $row === null ? null : self::insightFromRow($row);
    }

    /** @param array<string,mixed> $data @return array<string,mixed>|null */
    public static function createInsight(array $data): ?array
    {
        $title = (string) ($data['title'] ?? '');
        $slugSource = (string) (($data['slug'] ?? '') !== '' ? $data['slug'] : $title);
        $slug = self::slugify($slugSource);
        if ($slug === '') {
            $slug = 'insight-' . (Db::nextCounter('insSeq') + 1);
        }
        if (Db::value('SELECT COUNT(*) FROM `insights` WHERE `slug` = ?', [$slug]) > 0) {
            return null;
        }

        $row = [
            'id' => 'ins-' . str_pad((string) Db::nextCounter('insSeq'), 3, '0', STR_PAD_LEFT),
            'sort_order' => self::nextSort('insights'),
            'slug' => $slug,
            'title' => $title,
            'tag' => (string) (($data['tag'] ?? '') ?: 'Career guide'),
            'date' => (string) (($data['date'] ?? '') ?: Clock::dateNow()),
            'read' => (string) (($data['read'] ?? '') ?: '4 min read'),
            'image' => (string) ($data['image'] ?? ''),
            'lede' => (string) ($data['lede'] ?? ''),
            'body' => (string) ($data['body'] ?? ''),
            'status' => (string) (($data['status'] ?? '') ?: 'draft'),
            'created_at' => Clock::isoNow(),
            'extra' => null,
        ];
        Db::insert('insights', $row);
        return self::getInsight($row['id']);
    }

    /**
     * @param array<string,mixed> $patch
     * @return array<string,mixed>|null null when missing
     * @throws \DomainException when the raw slug is already used
     */
    public static function updateInsight(string $id, array $patch): ?array
    {
        $row = Db::one('SELECT * FROM `insights` WHERE `id` = ?', [$id]);
        if ($row === null) {
            return null;
        }

        if (isset($patch['slug']) && (string) $patch['slug'] !== (string) $row['slug']) {
            $taken = Db::value('SELECT COUNT(*) FROM `insights` WHERE `slug` = ? AND `id` <> ?', [(string) $patch['slug'], $id]);
            if ((int) $taken > 0) {
                throw new \DomainException('slug-conflict');
            }
        }

        $known = ['slug', 'title', 'tag', 'date', 'read', 'image', 'lede', 'body', 'status'];
        $data = [];
        foreach ($known as $column) {
            if (!array_key_exists($column, $patch)) {
                continue;
            }
            if ($column === 'slug') {
                $data['slug'] = self::slugify((string) $patch['slug']);
            } else {
                $data[$column] = $patch[$column] === null ? null : (string) $patch[$column];
            }
        }

        $extra = self::decodeArray($row['extra'] ?? null);
        foreach ($patch as $key => $value) {
            if (!in_array($key, $known, true)) {
                $extra[$key] = $value;
            }
        }
        if ($data !== [] || $patch !== []) {
            $data['extra'] = json_encode($extra, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            Db::update('insights', $data, '`id` = ?', [$id]);
        }

        return self::getInsight($id);
    }

    public static function deleteInsight(string $id): bool
    {
        return Db::delete('insights', '`id` = ?', [$id]) > 0;
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function insightFromRow(array $row): array
    {
        $insight = [
            'id' => (string) $row['id'],
            'slug' => (string) $row['slug'],
            'title' => (string) $row['title'],
            'tag' => (string) $row['tag'],
            'date' => (string) $row['date'],
            'read' => (string) $row['read'],
            'image' => (string) $row['image'],
            'lede' => (string) $row['lede'],
            'body' => (string) $row['body'],
            'status' => (string) $row['status'],
            'created_at' => (string) $row['created_at'],
        ];
        return array_merge($insight, self::decodeArray($row['extra'] ?? null));
    }

    /* ------------------------------------------------------------------ */
    /* Roles                                                              */
    /* ------------------------------------------------------------------ */

    /** @return list<array<string,mixed>> */
    public static function listRoles(): array
    {
        return array_map([self::class, 'roleFromRow'], Db::all('SELECT * FROM `roles` ORDER BY `sort_order` ASC'));
    }

    /** @return array<string,mixed>|null */
    public static function getRole(string $id): ?array
    {
        $row = Db::one('SELECT * FROM `roles` WHERE `id` = ?', [$id]);
        return $row === null ? null : self::roleFromRow($row);
    }

    /** @return array<string,mixed>|null */
    public static function getRoleBySlug(string $slug): ?array
    {
        $row = Db::one('SELECT * FROM `roles` WHERE `slug` = ?', [$slug]);
        return $row === null ? null : self::roleFromRow($row);
    }

    /** @param array<string,mixed> $data @return array<string,mixed> */
    public static function createRole(array $data): array
    {
        $name = trim((string) ($data['name'] ?? ''));
        $slug = self::roleSlug($name);
        $row = [
            'id' => 'role-' . Db::nextCounter('idSeq'),
            'sort_order' => self::nextSortEnd('roles'),
            'slug' => $slug,
            'name' => $name,
            'description' => trim((string) ($data['description'] ?? '')),
            'permissions' => json_encode(is_array($data['permissions'] ?? null) ? $data['permissions'] : [], JSON_UNESCAPED_UNICODE),
            'locked' => 0,
        ];
        Db::insert('roles', $row);
        return self::roleFromRow($row);
    }

    /** @param array<string,mixed> $patch @return array<string,mixed>|null */
    public static function updateRole(string $id, array $patch): ?array
    {
        $row = Db::one('SELECT * FROM `roles` WHERE `id` = ?', [$id]);
        if ($row === null) {
            return null;
        }
        $data = [];
        if (array_key_exists('name', $patch)) {
            $data['name'] = (string) $patch['name'];
        }
        if (array_key_exists('description', $patch)) {
            $data['description'] = (string) $patch['description'];
        }
        if (array_key_exists('permissions', $patch) && is_array($patch['permissions'])) {
            $data['permissions'] = json_encode(array_values($patch['permissions']), JSON_UNESCAPED_UNICODE);
        }
        if ($data !== []) {
            Db::update('roles', $data, '`id` = ?', [$id]);
        }
        return self::getRole($id);
    }

    public static function deleteRole(string $id): bool
    {
        return Db::delete('roles', '`id` = ?', [$id]) > 0;
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function roleFromRow(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'slug' => (string) $row['slug'],
            'name' => (string) $row['name'],
            'description' => (string) $row['description'],
            'permissions' => self::decodeList($row['permissions'] ?? null),
            'locked' => (int) $row['locked'] === 1,
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Admin users                                                        */
    /* ------------------------------------------------------------------ */

    /** @return list<array<string,mixed>> */
    public static function listUsers(): array
    {
        return array_map([self::class, 'userFromRow'], Db::all('SELECT * FROM `admin_users` ORDER BY `sort_order` ASC'));
    }

    /** @return array<string,mixed>|null */
    public static function getUser(string $id): ?array
    {
        $row = Db::one('SELECT * FROM `admin_users` WHERE `id` = ?', [$id]);
        return $row === null ? null : self::userFromRow($row);
    }

    /** @return array<string,mixed>|null */
    public static function getUserByEmail(string $email): ?array
    {
        $row = Db::one('SELECT * FROM `admin_users` WHERE LOWER(`email`) = LOWER(?) LIMIT 1', [$email]);
        return $row === null ? null : self::userFromRow($row);
    }

    /** @param array<string,mixed> $data @return array<string,mixed> */
    public static function createUser(array $data): array
    {
        $row = [
            'id' => 'usr-' . Db::nextCounter('idSeq'),
            'sort_order' => self::nextSortEnd('admin_users'),
            'name' => trim((string) ($data['name'] ?? '')),
            'email' => strtolower(trim((string) ($data['email'] ?? ''))),
            'role' => (string) (($data['role'] ?? '') ?: 'viewer'),
            'status' => 'invited',
            'created_at' => Clock::isoNow(),
            'last_login' => null,
        ];
        Db::insert('admin_users', $row);
        return self::userFromRow($row);
    }

    /** @param array<string,mixed> $patch @return array<string,mixed>|null */
    public static function updateUser(string $id, array $patch): ?array
    {
        $row = Db::one('SELECT * FROM `admin_users` WHERE `id` = ?', [$id]);
        if ($row === null) {
            return null;
        }
        $data = [];
        foreach (['name', 'role', 'status'] as $column) {
            if (array_key_exists($column, $patch)) {
                $data[$column] = (string) $patch[$column];
            }
        }
        if (array_key_exists('email', $patch)) {
            $data['email'] = strtolower(trim((string) $patch['email']));
        }
        if ($data !== []) {
            Db::update('admin_users', $data, '`id` = ?', [$id]);
        }
        return self::getUser($id);
    }

    public static function deleteUser(string $id): bool
    {
        return Db::delete('admin_users', '`id` = ?', [$id]) > 0;
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private static function userFromRow(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'role' => (string) $row['role'],
            'status' => (string) $row['status'],
            'created_at' => (string) $row['created_at'],
            'last_login' => $row['last_login'] !== null ? (string) $row['last_login'] : null,
        ];
    }

    /* ------------------------------------------------------------------ */
    /* Helpers                                                            */
    /* ------------------------------------------------------------------ */

    public static function nextReference(string $prefix): string
    {
        $sequence = Db::nextCounter('sequence');
        return $prefix . '-' . Clock::year() . '-' . str_pad((string) $sequence, 5, '0', STR_PAD_LEFT);
    }

    public static function slugify(string $value): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
        return trim($slug, '-');
    }

    public static function roleSlug(string $name): string
    {
        $slug = strtolower(trim($name));
        $slug = preg_replace('/[^a-z0-9]+/', '_', $slug) ?? '';
        $slug = trim($slug, '_');
        return $slug !== '' ? $slug : 'role';
    }

    private static function nextSort(string $table): int
    {
        $minimum = Db::value('SELECT MIN(`sort_order`) FROM `' . $table . '`');
        return $minimum === null ? 1 : ((int) $minimum - 1);
    }

    /** Newest-last ordering, matching the Node store's push() for users/roles. */
    private static function nextSortEnd(string $table): int
    {
        $maximum = Db::value('SELECT MAX(`sort_order`) FROM `' . $table . '`');
        return $maximum === null ? 1 : ((int) $maximum + 1);
    }

    /** @param mixed $value @return array<string,mixed> */
    private static function decodeArray($value): array
    {
        if (!is_string($value) || $value === '') {
            return [];
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }

    /** @param mixed $value @return list<mixed> */
    private static function decodeList($value): array
    {
        $decoded = self::decodeArray(is_string($value) ? $value : null);
        return array_values($decoded);
    }
}
