<?php

declare(strict_types=1);

namespace Ardson;

/**
 * Minimal SMTP client. No Composer dependency, so it works on any shared
 * host; uses PHP mail() only as an explicit fallback when configured.
 */
final class Mailer
{
    /**
     * @return array{delivered:bool,channel:string,reason?:string}
     */
    public static function send(string $subject, array $lines): array
    {
        $host = (string) App::cfg('mail.host', '');
        if ($host === '') {
            Logger::file('[notifier:email] (dry run) ' . $subject . ' · ' . count($lines) . ' fields');
            return ['delivered' => false, 'channel' => 'email', 'reason' => 'SMTP not configured'];
        }

        $from = (string) App::cfg('mail.from', 'no-reply@ardsonmaritime.com');
        $fromName = (string) App::cfg('mail.from_name', 'Ardson Maritime');
        $to = (string) App::cfg('mail.to', 'ardsonmaritime@outlook.com');
        $text = "[Ardson Maritime] " . $subject . "\r\n\r\n" . implode("\r\n", $lines);

        try {
            self::smtp([
                'host' => $host,
                'port' => (int) App::cfg('mail.port', 587),
                'user' => (string) App::cfg('mail.user', ''),
                'pass' => (string) App::cfg('mail.pass', ''),
                'secure' => (string) App::cfg('mail.secure', 'tls'),
                'from' => $from,
                'from_name' => $fromName,
                'to' => $to,
            ], $subject, $text);
            return ['delivered' => true, 'channel' => 'email'];
        } catch (\Throwable $e) {
            Logger::file('[notifier:email] send failed: ' . $e->getMessage());
            return ['delivered' => false, 'channel' => 'email', 'reason' => $e->getMessage()];
        }
    }

    /** @param array<string,mixed> $cfg */
    private static function smtp(array $cfg, string $subject, string $text): void
    {
        $host = (string) $cfg['host'];
        $port = (int) $cfg['port'];
        $secure = strtolower((string) $cfg['secure']);
        $prefix = $secure === 'ssl' ? 'ssl://' : 'tcp://';

        $errno = 0;
        $errstr = '';
        $socket = @stream_socket_client($prefix . $host . ':' . $port, $errno, $errstr, 20);
        if ($socket === false) {
            throw new \RuntimeException($errstr !== '' ? $errstr : 'SMTP connection failed');
        }
        stream_set_timeout($socket, 20);

        self::expect($socket, [220]);
        self::command($socket, 'EHLO ardsonmaritime.com', [250]);

        if ($secure === 'tls') {
            self::command($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new \RuntimeException('SMTP STARTTLS failed');
            }
            self::command($socket, 'EHLO ardsonmaritime.com', [250]);
        }

        if ((string) $cfg['user'] !== '') {
            self::command($socket, 'AUTH LOGIN', [334]);
            self::command($socket, base64_encode((string) $cfg['user']), [334]);
            self::command($socket, base64_encode((string) $cfg['pass']), [235]);
        }

        self::command($socket, 'MAIL FROM:<' . $cfg['from'] . '>', [250]);
        self::command($socket, 'RCPT TO:<' . $cfg['to'] . '>', [250, 251]);
        self::command($socket, 'DATA', [354]);

        $headers = [
            'From: ' . self::encodeName((string) $cfg['from_name']) . ' <' . $cfg['from'] . '>',
            'To: <' . $cfg['to'] . '>',
            'Subject: ' . self::encodeHeader($subject),
            'Date: ' . date('r'),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@ardsonmaritime.com>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];

        $data = implode("\r\n", $headers) . "\r\n\r\n" . $text;
        // Dot-stuffing per RFC 5321.
        $data = preg_replace('/^\./m', '..', $data);

        self::command($socket, $data . "\r\n.", [250]);
        self::command($socket, 'QUIT', [221]);
        fclose($socket);
    }

    /** @param resource $socket */
    private static function command($socket, string $command, array $expected): string
    {
        fwrite($socket, $command . "\r\n");
        return self::expect($socket, $expected);
    }

    /** @param resource $socket */
    private static function expect($socket, array $codes): string
    {
        $response = '';
        while (($line = fgets($socket, 515)) !== false) {
            $response .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }
        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $codes, true)) {
            throw new \RuntimeException('SMTP error: ' . trim($response));
        }
        return $response;
    }

    private static function encodeHeader(string $value): string
    {
        if (preg_match('/[^\x20-\x7E]/', $value)) {
            return '=?UTF-8?B?' . base64_encode($value) . '?=';
        }
        return $value;
    }

    private static function encodeName(string $value): string
    {
        return '"' . str_replace(['"', "\r", "\n"], '', $value) . '"';
    }
}
