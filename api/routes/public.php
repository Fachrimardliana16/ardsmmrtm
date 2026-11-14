<?php

declare(strict_types=1);

use Ardson\Clock;
use Ardson\FileSignature;
use Ardson\Notifier;
use Ardson\Response;
use Ardson\Storage;
use Ardson\Store;
use Ardson\Validator;
use Ardson\VirusScan;

/** @var \Ardson\Router $router */
return static function ($router): void {
    $publicLimit = ['max' => 20, 'window' => 600, 'bucket' => 'public-forms'];

    $router->get('/v1/health', static function (): void {
        Response::ok([
            'service' => 'ardson-maritime-api',
            'time' => Clock::isoNow(),
        ]);
    });

    /* ---------------------------------------------------------------- */
    /* Vacancies                                                        */
    /* ---------------------------------------------------------------- */

    $router->get('/v1/jobs', static function ($params, $request): void {
        $category = strtolower((string) $request->query('category', ''));
        if (!in_array($category, ['deck', 'engine', 'hotel'], true)) {
            $category = '';
        }
        $jobs = Store::listJobs($category !== '' ? $category : null);
        Response::ok(['count' => count($jobs), 'data' => $jobs]);
    });

    $router->get('/v1/jobs/{id}', static function (array $params): void {
        $job = Store::getJob($params['id']);
        if ($job === null) {
            Response::fail('Vacancy not found', 404);
        }
        Response::ok(['data' => $job]);
    });

    /* ---------------------------------------------------------------- */
    /* Insights                                                         */
    /* ---------------------------------------------------------------- */

    $router->get('/v1/insights', static function ($params, $request): void {
        $tag = $request->query('tag');
        $opts = ['status' => 'published'];
        if (is_string($tag) && $tag !== '') {
            $opts['tag'] = $tag;
        }
        $articles = Store::listInsights($opts);
        Response::ok(['count' => count($articles), 'data' => $articles]);
    });

    $router->get('/v1/insights/{slug}', static function (array $params): void {
        $article = Store::getInsightBySlug($params['slug']);
        if ($article === null || $article['status'] !== 'published') {
            Response::fail('Article not found', 404);
        }
        Response::ok(['data' => $article]);
    });

    /* ---------------------------------------------------------------- */
    /* Settings                                                         */
    /* ---------------------------------------------------------------- */

    $router->get('/v1/settings', static function (): void {
        Response::ok(['data' => \Ardson\Settings::get()], 200, [
            'Cache-Control' => 'public, max-age=60, stale-while-revalidate=300',
        ]);
    });

    /* ---------------------------------------------------------------- */
    /* Seafarer registration                                            */
    /* ---------------------------------------------------------------- */

    $router->post('/v1/seafarers/register', static function ($params, $request) use ($publicLimit): void {
        $body = $request->body();
        $file = $request->file('cv_file');

        $savedName = null;
        $savedPath = null;
        $keep = false;
        register_shutdown_function(static function () use (&$savedPath, &$keep): void {
            if (!$keep && $savedPath !== null && is_file($savedPath)) {
                @unlink($savedPath);
            }
        });

        if ($file !== null) {
            try {
                $savedName = Storage::saveUploaded(
                    $file,
                    Storage::cvDir(),
                    'cv-',
                    ['pdf', 'doc', 'docx'],
                    5 * 1024 * 1024
                );
            } catch (\RuntimeException $e) {
                Response::fail($e->getMessage(), 400);
            }

            $savedPath = Storage::cvDir() . '/' . $savedName;
            $extension = strtolower((string) pathinfo($savedName, PATHINFO_EXTENSION));
            if (!FileSignature::isExpected($savedPath, $extension)) {
                Response::fail('The uploaded file is not a valid PDF, DOC, or DOCX document.', 400);
            }
        }

        $rules = [
            'name' => ['label' => 'Full name', 'required' => true, 'minLength' => 3, 'maxLength' => 120],
            'email' => ['label' => 'Email', 'required' => true, 'type' => 'email', 'maxLength' => 160],
            'phone' => [
                'label' => 'Phone / WhatsApp',
                'required' => true,
                'minLength' => 7,
                'maxLength' => 24,
                'pattern' => '/^[+()\d\s-]+$/',
                'patternMessage' => 'Phone number may only contain digits, spaces, +, -, and parentheses.',
            ],
            'applied_rank' => [
                'label' => 'Applied rank',
                'required' => true,
                'enum' => [
                    'Master / Captain',
                    'Chief Officer / 2nd Mate',
                    'Chief Engineer',
                    '2nd Engineer / 3rd Engineer',
                    'Able Seaman (AB) / Bosun',
                    'Oiler / Fitter',
                    'Chief Cook / Steward',
                ],
            ],
            'vessel_experience' => ['label' => 'Vessel experience', 'maxLength' => 60],
            'certifications' => ['label' => 'Certifications', 'type' => 'array'],
        ];

        $errors = Validator::validate($rules, $body);
        if ($errors !== []) {
            Response::fail($errors[0], 422, ['errors' => $errors]);
        }

        $certs = [];
        $rawCerts = $body['certifications'] ?? [];
        if (is_string($rawCerts)) {
            $decoded = json_decode($rawCerts, true);
            $rawCerts = is_array($decoded) ? $decoded : [];
        }
        if (is_array($rawCerts)) {
            foreach ($rawCerts as $cert) {
                if (!is_string($cert)) {
                    continue;
                }
                $cert = trim($cert);
                if ($cert === '') {
                    continue;
                }
                $certs[] = mb_substr($cert, 0, 80, 'UTF-8');
                if (count($certs) >= 20) {
                    break;
                }
            }
        }

        if ($savedPath !== null) {
            try {
                $scan = VirusScan::scan($savedPath);
                if (($scan['scanned'] ?? false) && !($scan['clean'] ?? true)) {
                    Response::fail('The uploaded file failed the virus scan and was rejected.', 400);
                }
                \Ardson\Cipher::encryptFile($savedPath);
            } catch (\RuntimeException $e) {
                Response::fail($e->getMessage() !== '' ? $e->getMessage() : 'Virus scan failed.', 500);
            }
        }

        $record = Store::createSeafarer([
            'name' => (string) ($body['name'] ?? ''),
            'email' => (string) ($body['email'] ?? ''),
            'phone' => (string) ($body['phone'] ?? ''),
            'applied_rank' => (string) ($body['applied_rank'] ?? ''),
            'vessel_experience' => (string) ($body['vessel_experience'] ?? ''),
            'certifications' => $certs,
            'cv_file' => $savedName,
        ]);
        $keep = true;

        Notifier::send('New seafarer registration', [
            'Name: ' . $record['name'],
            'Email: ' . $record['email'],
            'Rank: ' . $record['applied_rank'],
            'Vessel: ' . $record['vessel_experience'],
            'Certificates: ' . implode(', ', $certs),
        ]);

        Response::ok([
            'message' => 'Registration received. Our crewing team will verify your documents within 2 working days.',
            'data' => ['reference' => $record['reference']],
        ], 201);
    }, ['limit' => $publicLimit]);

    /* ---------------------------------------------------------------- */
    /* Principal crew requests                                          */
    /* ---------------------------------------------------------------- */

    $principalRules = [
        'company_name' => ['label' => 'Company name', 'required' => true, 'minLength' => 2, 'maxLength' => 160],
        'email' => ['label' => 'Contact email', 'required' => true, 'type' => 'email', 'maxLength' => 160],
        'vessel_type' => [
            'label' => 'Vessel type',
            'required' => true,
            'enum' => ['Container', 'Tanker', 'Bulk', 'Offshore', 'Cruise'],
        ],
        'joining_date' => ['label' => 'Joining date', 'required' => true, 'type' => 'date'],
        'required_ranks' => ['label' => 'Required ranks', 'required' => true, 'minLength' => 5, 'maxLength' => 2000],
        'contract_duration' => ['label' => 'Contract duration', 'maxLength' => 60],
        'flag_state' => ['label' => 'Flag state', 'maxLength' => 80],
    ];

    $router->post('/v1/principals/crew-request', static function ($params, $request) use ($principalRules): void {
        $body = $request->body();
        Validator::check($principalRules, $body);

        $record = Store::createCrewRequest($body);

        Notifier::send('New principal crew request', [
            'Company: ' . $record['company_name'],
            'Email: ' . $record['email'],
            'Vessel: ' . $record['vessel_type'],
            'Joining: ' . $record['joining_date'],
            'Ranks: ' . $record['required_ranks'],
        ]);

        Response::ok([
            'message' => 'Crew request received. Candidate proposals will be sent within 24 hours.',
            'data' => ['reference' => $record['reference']],
        ], 201);
    }, ['limit' => $publicLimit]);

    $router->post('/v1/principals/emergency', static function ($params, $request) use ($principalRules): void {
        $body = $request->body();
        Validator::check($principalRules, $body);

        $record = Store::createCrewRequest($body);
        $record = Store::markCrewEmergency($record['id'], [
            'port' => is_string($body['port'] ?? null) ? mb_substr($body['port'], 0, 120) : '',
            'reason' => is_string($body['reason'] ?? null) ? mb_substr($body['reason'], 0, 120) : '',
            'notes' => is_string($body['notes'] ?? null) ? mb_substr($body['notes'], 0, 2000) : '',
        ]) ?? $record;

        Notifier::send('EMERGENCY replacement request', [
            'Company: ' . $record['company_name'],
            'Email: ' . $record['email'],
            'Vessel: ' . $record['vessel_type'],
            'Joining: ' . $record['joining_date'],
            'Ranks: ' . $record['required_ranks'],
            'Port: ' . ($record['port'] ?? ''),
            'Reason: ' . ($record['reason'] ?? ''),
        ]);

        Response::ok([
            'message' => 'Emergency request received. Duty desk will respond within 30 minutes.',
            'data' => ['reference' => $record['reference']],
        ], 201);
    }, ['limit' => $publicLimit]);

    /* ---------------------------------------------------------------- */
    /* Contact + newsletter                                             */
    /* ---------------------------------------------------------------- */

    $router->post('/v1/contact', static function ($params, $request): void {
        $body = $request->body();
        $rules = [
            'name' => ['label' => 'Full name', 'required' => true, 'minLength' => 2, 'maxLength' => 120],
            'email' => ['label' => 'Email', 'required' => true, 'type' => 'email', 'maxLength' => 160],
            'message' => ['label' => 'Message', 'required' => true, 'minLength' => 10, 'maxLength' => 4000],
        ];
        Validator::check($rules, $body);

        $record = Store::createContact($body);

        Notifier::send('New contact message', [
            'From: ' . $record['name'] . ' <' . $record['email'] . '>',
            $record['message'],
        ]);

        Response::ok([
            'message' => 'Message sent. We will reply during working hours (Mon–Sat, 08:00–17:00 WIB).',
        ], 201);
    }, ['limit' => $publicLimit]);

    $router->post('/v1/newsletter', static function ($params, $request) use ($publicLimit): void {
        $body = $request->body();
        $rules = [
            'email' => ['label' => 'Email', 'required' => true, 'type' => 'email', 'maxLength' => 160],
        ];
        Validator::check($rules, $body);

        Store::createSubscriber((string) ($body['email'] ?? ''));

        Response::ok([
            'message' => 'Subscribed. New vacancy alerts will arrive in your inbox.',
        ], 201);
    }, ['limit' => $publicLimit]);
};
