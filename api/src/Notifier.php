<?php

declare(strict_types=1);

namespace Ardson;

final class Notifier
{
    /**
     * Sends every configured channel. Channel failures never propagate.
     *
     * @param list<string> $lines
     * @return list<array<string,mixed>>
     */
    public static function send(string $subject, array $lines): array
    {
        $results = [];
        $results[] = Mailer::send($subject, $lines);
        $results[] = self::whatsapp($subject, $lines);
        return $results;
    }

    /**
     * @param list<string> $lines
     * @return array{delivered:bool,channel:string,reason?:string}
     */
    private static function whatsapp(string $subject, array $lines): array
    {
        $token = (string) App::cfg('whatsapp.token', '');
        $phoneId = (string) App::cfg('whatsapp.phone_id', '');
        $to = (string) App::cfg('whatsapp.to', '');

        if ($token === '' || $phoneId === '' || $to === '') {
            Logger::file('[notifier:whatsapp] (dry run) ' . $subject);
            return ['delivered' => false, 'channel' => 'whatsapp', 'reason' => 'WhatsApp API not configured'];
        }

        $body = "*[Ardson Maritime] " . $subject . "*\n\n" . implode("\n", $lines);
        $payload = json_encode([
            'messaging_product' => 'whatsapp',
            'to' => $to,
            'type' => 'text',
            'text' => ['body' => $body],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $url = 'https://graph.facebook.com/v19.0/' . rawurlencode($phoneId) . '/messages';
        $headers = [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ];

        try {
            if (function_exists('curl_init')) {
                $handle = curl_init($url);
                curl_setopt_array($handle, [
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => $payload,
                    CURLOPT_HTTPHEADER => $headers,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 15,
                ]);
                $response = curl_exec($handle);
                $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
                $error = curl_error($handle);
                curl_close($handle);
                if ($response === false) {
                    throw new \RuntimeException($error !== '' ? $error : 'request failed');
                }
            } else {
                $context = stream_context_create([
                    'http' => [
                        'method' => 'POST',
                        'header' => implode("\r\n", $headers),
                        'content' => $payload,
                        'timeout' => 15,
                        'ignore_errors' => true,
                    ],
                ]);
                $response = @file_get_contents($url, false, $context);
                $status = 0;
                if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
                    $status = (int) $m[1];
                }
                if ($response === false) {
                    throw new \RuntimeException('request failed');
                }
            }

            if ($status < 200 || $status >= 300) {
                throw new \RuntimeException('WhatsApp send failed: ' . $status . ' ' . substr((string) $response, 0, 300));
            }

            return ['delivered' => true, 'channel' => 'whatsapp'];
        } catch (\Throwable $e) {
            Logger::file('[notifier:whatsapp] ' . $e->getMessage());
            return ['delivered' => false, 'channel' => 'whatsapp', 'reason' => $e->getMessage()];
        }
    }
}
