<?php

declare(strict_types=1);

use Ardson\Auth;
use Ardson\Backups;
use Ardson\Cipher;
use Ardson\Clock;
use Ardson\Db;
use Ardson\Logger;
use Ardson\Media;
use Ardson\RateLimiter;
use Ardson\Response;
use Ardson\Settings;
use Ardson\Storage;
use Ardson\Store;
use Ardson\Validator;

/** @var \Ardson\Router $router */
return static function ($router): void {
    $auth = ['auth' => true];

    $permissions = [
        ['key' => 'jobs.manage', 'label' => 'Manage vacancies'],
        ['key' => 'seafarers.view', 'label' => 'View seafarers'],
        ['key' => 'seafarers.manage', 'label' => 'Manage seafarers'],
        ['key' => 'requests.view', 'label' => 'View crew requests'],
        ['key' => 'contacts.view', 'label' => 'View messages'],
        ['key' => 'newsletter.manage', 'label' => 'Manage newsletter'],
        ['key' => 'settings.manage', 'label' => 'Edit website settings'],
        ['key' => 'users.manage', 'label' => 'Manage users & roles'],
        ['key' => 'backup.manage', 'label' => 'Create and restore backups'],
        ['key' => 'logs.view', 'label' => 'View activity and error logs'],
    ];

    /* ---------------------------------------------------------------- */
    /* Session                                                           */
    /* ---------------------------------------------------------------- */

    $router->post('/v1/admin/login', static function ($params, $request): void {
        $bucket = 'admin-login';
        $window = 900;
        $max = 8;
        if (!RateLimiter::check($bucket, $request->ip(), $max, $window)) {
            Response::fail('Too many sign-in attempts. Try again in 15 minutes.', 429);
        }

        $body = $request->body();
        $rules = [
            'user' => ['label' => 'Email or username', 'required' => true, 'maxLength' => 200],
            'password' => ['label' => 'Password', 'required' => true, 'maxLength' => 200],
        ];
        $errors = Validator::validate($rules, $body);
        if ($errors !== []) {
            RateLimiter::add($bucket, $request->ip(), $window);
            Response::fail($errors[0], 422, ['errors' => $errors]);
        }

        $token = Auth::login(
            \Ardson\App::config(),
            (string) ($body['user'] ?? ''),
            (string) ($body['password'] ?? '')
        );
        if ($token === null) {
            RateLimiter::add($bucket, $request->ip(), $window);
            Response::fail('Invalid email or password.', 401);
        }

        Logger::record('info', 'Signed in', 'admin console', 'Session token issued');

        Response::ok([
            'message' => 'Signed in. Welcome back.',
            'data' => [
                'token' => $token,
                'user' => Auth::user(),
                'expiresIn' => '12h',
            ],
        ]);
    });

    $router->post('/v1/admin/logout', static function (): void {
        Auth::logout();
        Response::ok(['message' => 'Signed out.']);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Dashboard                                                         */
    /* ---------------------------------------------------------------- */

    $router->get('/v1/admin/stats', static function (): void {
        $stats = [
            'openJobs' => (int) Db::value("SELECT COUNT(*) FROM `jobs` WHERE `status` = 'open'"),
            'totalJobs' => (int) Db::value('SELECT COUNT(*) FROM `jobs`'),
            'seafarers' => (int) Db::value('SELECT COUNT(*) FROM `seafarers`'),
            'crewRequests' => (int) Db::value('SELECT COUNT(*) FROM `crew_requests`'),
            'openRequests' => (int) Db::value("SELECT COUNT(*) FROM `crew_requests` WHERE `status` NOT IN ('fulfilled','closed')"),
            'unreadContacts' => (int) Db::value("SELECT COUNT(*) FROM `contacts` WHERE `status` = 'unread'"),
            'subscribers' => (int) Db::value('SELECT COUNT(*) FROM `subscribers`'),
            'users' => (int) Db::value('SELECT COUNT(*) FROM `admin_users`'),
            'errors' => (int) Db::value("SELECT COUNT(*) FROM `logs` WHERE `level` = 'error'"),
            'insights' => (int) Db::value("SELECT COUNT(*) FROM `insights` WHERE `status` = 'published'"),
        ];

        $seafarers = array_slice(Store::listSeafarers(), -5);
        $recentSeafarers = [];
        foreach (array_reverse($seafarers) as $record) {
            $recentSeafarers[] = [
                'reference' => $record['reference'],
                'name' => $record['name'],
                'rank' => $record['applied_rank'],
                'created_at' => $record['created_at'],
            ];
        }

        $requests = array_slice(Store::listCrewRequests(), -5);
        $recentRequests = [];
        foreach (array_reverse($requests) as $record) {
            $recentRequests[] = [
                'reference' => $record['reference'],
                'company' => $record['company_name'],
                'vessel' => $record['vessel_type'],
                'status' => $record['status'],
                'created_at' => $record['created_at'],
            ];
        }

        $jobs = array_slice(Store::listAllJobs(), -5);
        $recentJobs = [];
        foreach (array_reverse($jobs) as $job) {
            $recentJobs[] = [
                'id' => $job['id'],
                'title' => $job['title'],
                'principal' => $job['principal'],
                'status' => $job['status'],
            ];
        }

        Response::ok(['data' => [
            'stats' => $stats,
            'recentSeafarers' => $recentSeafarers,
            'recentRequests' => $recentRequests,
            'recentJobs' => $recentJobs,
        ]]);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Jobs                                                              */
    /* ---------------------------------------------------------------- */

    $jobRules = [
        'title' => ['label' => 'Position title', 'required' => true, 'minLength' => 3, 'maxLength' => 120],
        'category' => ['label' => 'Department', 'required' => true, 'enum' => ['deck', 'engine', 'hotel']],
        'vessel_type' => [
            'label' => 'Vessel type',
            'required' => true,
            'enum' => ['Container', 'Tanker', 'Bulk', 'LNG', 'Offshore', 'Cruise'],
        ],
        'principal' => ['label' => 'Principal', 'required' => true, 'minLength' => 3, 'maxLength' => 140],
        'vessel_name' => ['label' => 'Vessel name', 'maxLength' => 80],
        'flag_state' => ['label' => 'Flag state', 'maxLength' => 60],
        'joining_date' => ['label' => 'Joining date', 'type' => 'date'],
        'contract_duration' => ['label' => 'Contract duration', 'maxLength' => 60],
        'salary_min' => ['label' => 'Minimum salary', 'type' => 'number', 'min' => 0],
        'salary_max' => ['label' => 'Maximum salary', 'type' => 'number', 'min' => 0],
        'salary_currency' => ['label' => 'Salary currency', 'maxLength' => 8],
        'status' => ['label' => 'Status', 'enum' => ['open', 'closed', 'filled']],
    ];

    $jobPatchRules = array_map(static function (array $rule): array {
        unset($rule['required']);
        return $rule;
    }, $jobRules);

    $router->get('/v1/admin/jobs', static function ($params, $request): void {
        $jobs = Store::listAllJobs();
        $status = strtolower((string) $request->query('status', ''));
        $category = strtolower((string) $request->query('category', ''));
        if (in_array($status, ['open', 'closed', 'filled'], true)) {
            $jobs = array_values(array_filter($jobs, static fn(array $job): bool => $job['status'] === $status));
        }
        if (in_array($category, ['deck', 'engine', 'hotel'], true)) {
            $jobs = array_values(array_filter($jobs, static fn(array $job): bool => $job['category'] === $category));
        }
        Response::ok(['count' => count($jobs), 'data' => $jobs]);
    }, $auth);

    $router->get('/v1/admin/jobs/{id}', static function (array $params): void {
        $job = Store::getJob($params['id']);
        if ($job === null) {
            Response::fail('Vacancy not found.', 404);
        }
        Response::ok(['data' => $job]);
    }, $auth);

    $router->post('/v1/admin/jobs', static function ($params, $request) use ($jobRules): void {
        $body = $request->body();
        Validator::check($jobRules, $body);
        $job = Store::createJob($body);
        Response::ok([
            'message' => 'Vacancy "' . $job['title'] . '" published.',
            'data' => $job,
        ], 201);
    }, $auth);

    $router->patch('/v1/admin/jobs/{id}', static function (array $params, $request) use ($jobPatchRules): void {
        $body = $request->body();
        Validator::check($jobPatchRules, $body);
        $job = Store::updateJob($params['id'], $body);
        if ($job === null) {
            Response::fail('Vacancy not found.', 404);
        }
        Response::ok(['message' => 'Vacancy updated.', 'data' => $job]);
    }, $auth);

    $router->delete('/v1/admin/jobs/{id}', static function (array $params): void {
        if (!Store::deleteJob($params['id'])) {
            Response::fail('Vacancy not found.', 404);
        }
        Response::ok(['message' => 'Vacancy removed.']);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Insights                                                          */
    /* ---------------------------------------------------------------- */

    $router->get('/v1/admin/insights', static function ($params, $request): void {
        $status = strtolower((string) $request->query('status', ''));
        $opts = [];
        if (in_array($status, ['published', 'draft'], true)) {
            $opts['status'] = $status;
        }
        $articles = Store::listInsights($opts);
        Response::ok(['count' => count($articles), 'data' => $articles]);
    }, $auth);

    $router->get('/v1/admin/insights/{id}', static function (array $params): void {
        $article = Store::getInsight($params['id']);
        if ($article === null) {
            Response::fail('Article not found.', 404);
        }
        Response::ok(['data' => $article]);
    }, $auth);

    $router->post('/v1/admin/insights', static function ($params, $request): void {
        $body = $request->body();
        if (!isset($body['title']) || trim((string) $body['title']) === '') {
            Response::fail('Title is required.', 400);
        }
        $article = Store::createInsight($body);
        if ($article === null) {
            Response::fail('An article with that slug already exists.', 409);
        }
        Logger::record('info', 'Created article', (string) $article['slug'], (string) $article['title']);
        Response::ok([
            'message' => 'Article "' . $article['title'] . '" created.',
            'data' => $article,
        ], 201);
    }, $auth);

    $router->patch('/v1/admin/insights/{id}', static function (array $params, $request): void {
        $body = $request->body();
        try {
            $article = Store::updateInsight($params['id'], $body);
        } catch (\DomainException $e) {
            Response::fail('Another article already uses that slug.', 409);
        }
        if ($article === null) {
            Response::fail('Article not found.', 404);
        }
        Logger::record('info', 'Updated article', (string) $article['slug'], implode(', ', array_keys($body)));
        Response::ok(['message' => 'Article updated.', 'data' => $article]);
    }, $auth);

    $router->delete('/v1/admin/insights/{id}', static function (array $params): void {
        $article = Store::getInsight($params['id']);
        if ($article === null) {
            Response::fail('Article not found.', 404);
        }
        Store::deleteInsight($params['id']);
        Logger::record('warning', 'Deleted article', (string) $article['slug'], (string) $article['title']);
        Response::ok(['message' => 'Article removed.']);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Seafarers                                                         */
    /* ---------------------------------------------------------------- */

    $router->get('/v1/admin/seafarers', static function ($params, $request): void {
        $records = array_reverse(Store::listSeafarers());
        $rank = strtolower((string) $request->query('rank', ''));
        if ($rank !== '') {
            $records = array_values(array_filter(
                $records,
                static fn(array $record): bool => strpos(strtolower($record['applied_rank']), $rank) !== false
            ));
        }
        Response::ok(['count' => count($records), 'data' => $records]);
    }, $auth);

    $router->patch('/v1/admin/seafarers/{id}', static function (array $params, $request): void {
        $body = $request->body();
        $rules = [
            'status' => [
                'label' => 'Status',
                'required' => true,
                'enum' => ['new', 'screening', 'verified', 'rejected', 'proposed'],
            ],
            'notes' => ['label' => 'Notes', 'maxLength' => 2000],
        ];
        Validator::check($rules, $body);

        $notes = array_key_exists('notes', $body) && is_string($body['notes']) ? $body['notes'] : null;
        $record = Store::updateSeafarerStatus(
            $params['id'],
            (string) $body['status'],
            $notes,
            Auth::user() ?? 'system'
        );
        if ($record === null) {
            Response::fail('Seafarer not found.', 404);
        }

        Logger::record(
            'info',
            'Seafarer status → ' . $record['status'],
            (string) $record['reference'],
            (string) ($record['notes'] ?? '')
        );

        Response::ok(['message' => 'Seafarer updated.', 'data' => $record]);
    }, $auth);

    $router->get('/v1/admin/seafarers/{id}/cv', static function (array $params): void {
        $record = Store::getSeafarer($params['id']);
        if ($record === null || empty($record['cv_file'])) {
            Response::fail('CV not found.', 404);
        }

        $dir = Storage::cvDir();
        $path = Storage::safeJoin($dir, (string) $record['cv_file']);
        if ($path === null) {
            Response::fail('Invalid CV path.', 400);
        }
        if (!is_file($path)) {
            Response::fail('CV file missing on disk.', 404);
        }

        $extension = strtolower((string) pathinfo((string) $record['cv_file'], PATHINFO_EXTENSION));
        $base = preg_replace('/[^A-Za-z0-9_.-]/', '_', (string) ($record['name'] ?: $record['id'])) ?? 'CV';
        $filename = 'CV-' . $base . ($extension !== '' ? '.' . $extension : '');

        Logger::record('info', 'Downloaded CV', (string) ($record['reference'] ?: $record['id']), '');

        if (Cipher::enabled()) {
            try {
                $bytes = Cipher::decryptFile($path);
            } catch (\RuntimeException $e) {
                Response::fail('Could not decrypt the CV.', 500);
            }
            Response::raw(200, $bytes, [
                'Content-Type' => 'application/octet-stream',
                'Content-Disposition' => 'attachment; filename="' . str_replace('"', '', $filename) . '"',
            ]);
        }

        $mime = [
            'pdf' => 'application/pdf',
            'doc' => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ][$extension] ?? 'application/octet-stream';

        header('Content-Type: ' . $mime);
        header('Content-Disposition: attachment; filename="' . str_replace('"', '', $filename) . '"');
        header('Content-Length: ' . (string) filesize($path));
        header('Cache-Control: no-store');
        readfile($path);
        exit;
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Crew requests                                                     */
    /* ---------------------------------------------------------------- */

    $crewStatuses = ['new', 'emergency', 'contacted', 'shortlisting', 'proposed', 'fulfilled', 'closed'];

    $router->get('/v1/admin/crew-requests', static function (): void {
        $records = array_reverse(Store::listCrewRequests());
        Response::ok(['count' => count($records), 'data' => $records]);
    }, $auth);

    $router->patch('/v1/admin/crew-requests/{id}', static function (array $params, $request) use ($crewStatuses): void {
        $body = $request->body();
        if (array_key_exists('status', $body) && !in_array((string) $body['status'], $crewStatuses, true)) {
            Response::fail('Unknown crew request status.', 400);
        }
        $record = Store::updateCrewRequest($params['id'], $body);
        if ($record === null) {
            Response::fail('Crew request not found.', 404);
        }
        Logger::record('info', 'Updated crew request', (string) $record['reference'], implode(', ', array_keys($body)));
        Response::ok(['data' => $record]);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Contacts                                                          */
    /* ---------------------------------------------------------------- */

    $contactStatuses = ['unread', 'read', 'replied', 'archived'];

    $router->get('/v1/admin/contacts', static function (): void {
        $records = Store::listContacts();
        Response::ok(['count' => count($records), 'data' => $records]);
    }, $auth);

    $router->patch('/v1/admin/contacts/{id}/read', static function (array $params): void {
        $record = Store::markContactRead($params['id']);
        if ($record === null) {
            Response::fail('Message not found.', 404);
        }
        Response::ok(['data' => $record]);
    }, $auth);

    $router->patch('/v1/admin/contacts/{id}', static function (array $params, $request) use ($contactStatuses): void {
        $body = $request->body();
        if (array_key_exists('status', $body) && !in_array((string) $body['status'], $contactStatuses, true)) {
            Response::fail('Unknown message status.', 400);
        }
        $record = Store::updateContact($params['id'], $body);
        if ($record === null) {
            Response::fail('Message not found.', 404);
        }
        Logger::record('info', 'Updated message', (string) $record['email'], implode(', ', array_keys($body)));
        Response::ok(['data' => $record]);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Newsletter                                                        */
    /* ---------------------------------------------------------------- */

    $router->get('/v1/admin/subscribers', static function (): void {
        $subscribers = Store::listSubscribers();
        Response::ok(['count' => count($subscribers), 'data' => $subscribers]);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Settings                                                          */
    /* ---------------------------------------------------------------- */

    $settingsSections = ['site', 'hero', 'help', 'profile_button', 'help_button', 'pages', 'blocks'];

    $router->get('/v1/admin/settings', static function (): void {
        Response::ok(['data' => Settings::get()]);
    }, $auth);

    $router->patch('/v1/admin/settings/{section}', static function (array $params, $request) use ($settingsSections): void {
        $section = $params['section'];
        if (!in_array($section, $settingsSections, true)) {
            Response::fail('Unknown settings section.', 400);
        }
        $body = $request->body();
        $settings = Settings::update($section, $body);
        if ($settings === null) {
            Response::fail('Unknown settings section.', 400);
        }

        Logger::record(
            'info',
            'Updated ' . $section . ' settings',
            'website settings',
            implode(', ', array_keys($body))
        );

        $message = $section === 'site'
            ? 'Website settings saved.'
            : preg_replace('/_/', ' ', $section, 1) . ' settings saved.';

        Response::ok(['message' => $message, 'data' => $settings]);
    }, $auth);

    $router->post('/v1/admin/settings/blocks/{key}/reset', static function (array $params): void {
        $settings = Settings::resetBlock($params['key']);
        Logger::record('warning', 'Reset content block', (string) $params['key'], '');
        Response::ok(['message' => 'Section restored.', 'data' => $settings]);
    }, $auth);

    $router->post('/v1/admin/settings/{section}/reset', static function (array $params) use ($settingsSections): void {
        $section = $params['section'];
        if ($section !== 'all' && !in_array($section, $settingsSections, true)) {
            Response::fail('Unknown settings section.', 400);
        }
        $settings = Settings::reset($section);
        Logger::record('warning', 'Reset settings', $section, '');
        Response::ok(['message' => 'Defaults restored.', 'data' => $settings]);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Hero slides                                                       */
    /* ---------------------------------------------------------------- */

    $slideKeys = [
        'type', 'image', 'video', 'video_fallback', 'poster', 'duration',
        'eyebrow', 'title', 'title_accent', 'lede', 'badge_title', 'badge_text',
    ];

    $router->get('/v1/admin/hero-slides', static function (): void {
        $slides = Settings::slides();
        Response::ok(['count' => count($slides), 'data' => $slides]);
    }, $auth);

    $router->post('/v1/admin/hero-slides', static function ($params, $request): void {
        $body = $request->body();
        $slides = Settings::slides();

        $existing = [];
        foreach ($slides as $slide) {
            $existing[(string) ($slide['id'] ?? '')] = true;
        }
        do {
            $id = 'slide-' . str_pad((string) Db::nextCounter('heroSlideSeq'), 3, '0', STR_PAD_LEFT);
        } while (isset($existing[$id]));

        $type = in_array((string) ($body['type'] ?? ''), ['image', 'video', 'text'], true)
            ? (string) $body['type']
            : 'image';

        $slide = ['id' => $id, 'type' => $type];
        foreach (['image', 'video', 'video_fallback', 'poster', 'eyebrow', 'title', 'title_accent', 'lede', 'badge_title', 'badge_text'] as $key) {
            $slide[$key] = is_string($body[$key] ?? null) ? $body[$key] : '';
        }
        $slide['duration'] = is_numeric($body['duration'] ?? null) ? $body['duration'] + 0 : 7000;

        $slides[] = $slide;
        Settings::saveSlides($slides);

        Logger::record('info', 'Created hero slide', $id, (string) ($slide['title'] ?? ''));
        Response::ok(['message' => 'Slide added.', 'data' => $slide], 201);
    }, $auth);

    $router->patch('/v1/admin/hero-slides/{id}', static function (array $params, $request) use ($slideKeys): void {
        $body = $request->body();
        $slides = Settings::slides();
        $found = false;

        foreach ($slides as $index => $slide) {
            if ((string) ($slide['id'] ?? '') !== $params['id']) {
                continue;
            }
            $found = true;
            foreach ($slideKeys as $key) {
                if (!array_key_exists($key, $body)) {
                    continue;
                }
                if ($key === 'type') {
                    $slide['type'] = in_array((string) $body['type'], ['image', 'video', 'text'], true)
                        ? (string) $body['type']
                        : 'image';
                } else {
                    $slide[$key] = $body[$key];
                }
            }
            $slides[$index] = $slide;
            break;
        }

        if (!$found) {
            Response::fail('Slide not found.', 404);
        }

        Settings::saveSlides($slides);
        Logger::record('info', 'Updated hero slide', (string) $params['id'], implode(', ', array_keys($body)));
        Response::ok(['message' => 'Slide updated.', 'data' => $slides[$index]]);
    }, $auth);

    $router->delete('/v1/admin/hero-slides/{id}', static function (array $params): void {
        $slides = Settings::slides();
        $kept = array_values(array_filter(
            $slides,
            static fn(array $slide): bool => (string) ($slide['id'] ?? '') !== $params['id']
        ));
        if (count($kept) === count($slides)) {
            Response::fail('Slide not found.', 404);
        }
        Settings::saveSlides($kept);
        Logger::record('warning', 'Deleted hero slide', (string) $params['id'], '');
        Response::ok(['message' => 'Slide removed.']);
    }, $auth);

    $router->post('/v1/admin/hero-slides/reorder', static function ($params, $request): void {
        $body = $request->body();
        $order = $body['order'] ?? null;
        $slides = Settings::slides();

        if (!is_array($order)) {
            Response::fail('Order must list every slide id once.', 400);
        }

        $byId = [];
        foreach ($slides as $slide) {
            $byId[(string) ($slide['id'] ?? '')] = $slide;
        }
        $reordered = [];
        foreach ($order as $id) {
            $key = (string) $id;
            if (!isset($byId[$key])) {
                Response::fail('Order must list every slide id once.', 400);
            }
            $reordered[] = $byId[$key];
            unset($byId[$key]);
        }
        if (count($reordered) !== count($slides)) {
            Response::fail('Order must list every slide id once.', 400);
        }

        Settings::saveSlides($reordered);
        Logger::record('info', 'Reordered hero slides', '', '');
        Response::ok(['message' => 'Slide order saved.', 'data' => $reordered]);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Admin users                                                       */
    /* ---------------------------------------------------------------- */

    $router->get('/v1/admin/users', static function (): void {
        $users = Store::listUsers();
        Response::ok(['count' => count($users), 'data' => $users]);
    }, $auth);

    $router->post('/v1/admin/users', static function ($params, $request): void {
        $body = $request->body();
        $name = trim((string) ($body['name'] ?? ''));
        $email = strtolower(trim((string) ($body['email'] ?? '')));

        if ($name === '' || $email === '') {
            Response::fail('Name and email are required.', 400);
        }
        if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email)) {
            Response::fail('Enter a valid email address.', 400);
        }
        if (Store::getUserByEmail($email) !== null) {
            Response::fail('A user with that email already exists.', 409);
        }
        $role = (string) ($body['role'] ?? 'viewer');
        if (Store::getRoleBySlug($role) === null) {
            Response::fail('Unknown role.', 400);
        }

        $user = Store::createUser(['name' => $name, 'email' => $email, 'role' => $role]);
        Logger::record('info', 'Invited user', $email, '');
        Response::ok(['message' => 'Invitation sent to ' . $email . '.', 'data' => $user], 201);
    }, $auth);

    $router->patch('/v1/admin/users/{id}', static function (array $params, $request): void {
        $body = $request->body();
        if (array_key_exists('email', $body)) {
            $email = strtolower(trim((string) $body['email']));
            $other = Store::getUserByEmail($email);
            if ($other !== null && $other['id'] !== $params['id']) {
                Response::fail('Another user already uses that email.', 409);
            }
        }
        if (array_key_exists('role', $body) && Store::getRoleBySlug((string) $body['role']) === null) {
            Response::fail('Unknown role.', 400);
        }

        $user = Store::updateUser($params['id'], $body);
        if ($user === null) {
            Response::fail('User not found.', 404);
        }
        Logger::record('info', 'Updated user', $user['email'], implode(', ', array_keys($body)));
        Response::ok(['message' => 'User updated.', 'data' => $user]);
    }, $auth);

    $router->delete('/v1/admin/users/{id}', static function (array $params): void {
        $user = Store::getUser($params['id']);
        if ($user === null) {
            Response::fail('User not found.', 404);
        }
        $adminUser = (string) (\Ardson\App::cfg('admin.user', 'admin@ardsonmaritime.com'));
        if ($user['email'] === $adminUser) {
            Response::fail('The primary administrator cannot be removed.', 400);
        }
        Store::deleteUser($params['id']);
        Logger::record('warning', 'Removed user', $user['email'], '');
        Response::ok(['message' => 'User removed.']);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Roles                                                             */
    /* ---------------------------------------------------------------- */

    $router->get('/v1/admin/roles', static function () use ($permissions): void {
        $roles = Store::listRoles();
        Response::ok(['count' => count($roles), 'data' => $roles, 'permissions' => $permissions]);
    }, $auth);

    $router->post('/v1/admin/roles', static function ($params, $request): void {
        $body = $request->body();
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '') {
            Response::fail('Role name is required.', 400);
        }
        foreach (Store::listRoles() as $role) {
            if (strcasecmp($role['name'], $name) === 0) {
                Response::fail('A role with that name already exists.', 409);
            }
        }
        $role = Store::createRole($body);
        Logger::record('info', 'Created role', $role['name'], '');
        Response::ok(['message' => 'Role "' . $role['name'] . '" created.', 'data' => $role], 201);
    }, $auth);

    $router->patch('/v1/admin/roles/{id}', static function (array $params, $request): void {
        $existing = Store::getRole($params['id']);
        if ($existing === null) {
            Response::fail('Role not found.', 404);
        }
        if (!empty($existing['locked'])) {
            Response::fail('The Super Admin role is locked and cannot be edited.', 400);
        }
        $role = Store::updateRole($params['id'], $request->body());
        Logger::record('info', 'Updated role', $role['name'], implode(', ', array_keys($request->body())));
        Response::ok(['message' => 'Role updated.', 'data' => $role]);
    }, $auth);

    $router->delete('/v1/admin/roles/{id}', static function (array $params): void {
        $role = Store::getRole($params['id']);
        if ($role === null) {
            Response::fail('Role not found.', 404);
        }
        if (!empty($role['locked'])) {
            Response::fail('The Super Admin role cannot be deleted.', 400);
        }
        $inUse = (int) Db::value('SELECT COUNT(*) FROM `admin_users` WHERE `role` = ?', [$role['slug']]);
        if ($inUse > 0) {
            Response::fail('Reassign users on this role before deleting it.', 409);
        }
        Store::deleteRole($params['id']);
        Response::ok(['message' => 'Role removed.']);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Logs                                                              */
    /* ---------------------------------------------------------------- */

    $logLevels = ['all', 'info', 'warning', 'error'];

    $router->get('/v1/admin/logs', static function ($params, $request) use ($logLevels): void {
        $level = strtolower((string) $request->query('level', 'all'));
        if (!in_array($level, $logLevels, true)) {
            Response::fail('Unknown log level.', 400);
        }
        $sql = 'SELECT * FROM `logs` ORDER BY `seq` DESC';
        $paramsSql = [];
        if ($level !== 'all') {
            $sql = 'SELECT * FROM `logs` WHERE `level` = ? ORDER BY `seq` DESC';
            $paramsSql = [$level];
        }
        $rows = Db::all($sql, $paramsSql);
        $data = array_map(static function (array $row): array {
            return [
                'id' => (string) $row['id'],
                'level' => (string) $row['level'],
                'actor' => (string) $row['actor'],
                'action' => (string) $row['action'],
                'target' => (string) $row['target'],
                'detail' => (string) $row['detail'],
                'created_at' => (string) $row['created_at'],
            ];
        }, $rows);

        $summary = [
            'info' => (int) Db::value("SELECT COUNT(*) FROM `logs` WHERE `level` = 'info'"),
            'warning' => (int) Db::value("SELECT COUNT(*) FROM `logs` WHERE `level` = 'warning'"),
            'error' => (int) Db::value("SELECT COUNT(*) FROM `logs` WHERE `level` = 'error'"),
        ];

        Response::ok(['count' => count($data), 'data' => $data, 'summary' => $summary]);
    }, $auth);

    $router->delete('/v1/admin/logs', static function ($params, $request) use ($logLevels): void {
        $level = strtolower((string) $request->query('level', 'all'));
        if (!in_array($level, $logLevels, true)) {
            Response::fail('Unknown log level.', 400);
        }
        if ($level === 'all') {
            $removed = Db::delete('logs', '1 = 1');
        } else {
            $removed = Db::delete('logs', '`level` = ?', [$level]);
        }
        Logger::record('warning', 'Cleared logs', $level, $removed . ' entries removed');

        $noun = $removed === 1 ? 'entry' : 'entries';
        Response::ok([
            'message' => 'Cleared ' . $removed . ' log ' . $noun . '.',
            'data' => ['removed' => $removed],
        ]);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Backups                                                           */
    /* ---------------------------------------------------------------- */

    $router->get('/v1/admin/backups', static function (): void {
        $backups = Backups::list();
        Response::ok(['count' => count($backups), 'data' => $backups]);
    }, $auth);

    $router->post('/v1/admin/backups', static function (): void {
        $meta = Backups::create(Auth::user() ?? 'system');
        Response::ok([
            'message' => 'Backup ' . $meta['filename'] . ' created.',
            'data' => $meta,
        ], 201);
    }, $auth);

    $router->get('/v1/admin/backups/{id}/download', static function (array $params): void {
        $payload = Backups::payload($params['id']);
        if ($payload === null) {
            Response::fail('Backup not found.', 404);
        }
        $meta = Backups::meta($params['id']);
        $filename = $meta['filename'] ?? 'ardson-backup.json';
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        Response::raw(200, is_string($json) ? $json : '{}', [
            'Content-Type' => 'application/json; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="' . str_replace('"', '', $filename) . '"',
        ]);
    }, $auth);

    $router->post('/v1/admin/backups/{id}/restore', static function (array $params): void {
        $meta = Backups::restore($params['id'], Auth::user() ?? 'system');
        if ($meta === null) {
            Response::fail('Backup not found.', 404);
        }
        Response::ok([
            'message' => 'Backup restored. Live data has been replaced.',
            'data' => $meta,
        ]);
    }, $auth);

    $router->delete('/v1/admin/backups/{id}', static function (array $params): void {
        if (!Backups::delete($params['id'])) {
            Response::fail('Backup not found.', 404);
        }
        Logger::record('warning', 'Deleted backup', (string) $params['id'], '');
        Response::ok(['message' => 'Backup deleted.']);
    }, $auth);

    /* ---------------------------------------------------------------- */
    /* Hero media upload                                                 */
    /* ---------------------------------------------------------------- */

    $router->post('/v1/admin/uploads/hero', static function ($params, $request): void {
        $file = $request->file('file');
        if ($file === null) {
            Response::fail('Choose an image or video to upload.', 400);
        }

        $ext = strtolower((string) pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff', 'gif', 'mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'];
        if (!in_array($ext, $allowed, true)) {
            Response::fail('Upload a JPG, PNG, WebP, MP4, MOV, or WebM file.', 400);
        }

        $max = (int) \Ardson\App::cfg('uploads.max_media_bytes', 100 * 1024 * 1024);
        if ((int) ($file['size'] ?? 0) > $max) {
            Response::fail('Upload failed: File too large', 400);
        }

        try {
            $media = Media::processUpload($file);
        } catch (\RuntimeException $e) {
            Logger::file('[media] ' . $e->getMessage());
            Response::fail('Could not process that file. Try a different image or video.', 500);
        }

        Logger::record(
            'info',
            'Uploaded hero media',
            (string) ($media['url'] ?? ''),
            (string) ($media['type'] ?? '') . ' · ' . round(((int) ($media['bytes'] ?? 0)) / 1024) . ' KB'
        );

        Response::ok(['message' => 'Media uploaded and compressed.', 'data' => $media], 201);
    }, $auth);
};
