<?php

declare(strict_types=1);

namespace Ardson;

final class VirusScan
{
    /**
     * @return array{scanned:bool,clean:bool,engine:string,detail?:string,reason?:string}
     */
    public static function scan(string $path): array
    {
        $host = (string) App::cfg('clamav.host', '');
        $port = (int) App::cfg('clamav.port', 3310);
        $strict = (bool) App::cfg('security.virus_scan_strict', true);

        if ($host !== '') {
            try {
                return self::viaClamd($path, $host, $port);
            } catch (\Throwable $e) {
                if ($strict) {
                    throw new \RuntimeException('Virus scan failed: ' . $e->getMessage());
                }
                return [
                    'scanned' => false,
                    'clean' => true,
                    'engine' => 'none',
                    'reason' => 'clamd unreachable: ' . $e->getMessage(),
                ];
            }
        }

        foreach (['clamdscan', 'clamscan'] as $binary) {
            $result = self::viaCli($binary, $path);
            if ($result !== null) {
                return $result;
            }
        }

        if ($strict) {
            throw new \RuntimeException('Virus scan required but no scanner is configured.');
        }

        return [
            'scanned' => false,
            'clean' => true,
            'engine' => 'none',
            'reason' => 'Virus scanning not configured. Set CLAMAV_HOST or install clamscan/clamdscan.',
        ];
    }

    /** @return array{scanned:bool,clean:bool,engine:string,detail:string} */
    private static function viaClamd(string $path, string $host, int $port): array
    {
        $errno = 0;
        $errstr = '';
        $socket = @stream_socket_client(
            'tcp://' . $host . ':' . $port,
            $errno,
            $errstr,
            5
        );
        if ($socket === false) {
            throw new \RuntimeException($errstr !== '' ? $errstr : 'connection refused');
        }
        stream_set_timeout($socket, 30);

        fwrite($socket, "zINSTREAM\0");

        $handle = @fopen($path, 'rb');
        if ($handle === false) {
            fclose($socket);
            throw new \RuntimeException('could not read upload');
        }
        while (!feof($handle)) {
            $chunk = fread($handle, 8192);
            if ($chunk === false || $chunk === '') {
                break;
            }
            fwrite($socket, pack('N', strlen($chunk)));
            fwrite($socket, $chunk);
        }
        fclose($handle);
        fwrite($socket, pack('N', 0));

        $response = stream_get_contents($socket);
        fclose($socket);

        $text = trim((string) $response);
        $clean = strpos($text, 'OK') !== false && strpos($text, 'FOUND') === false;

        return [
            'scanned' => true,
            'clean' => $clean,
            'engine' => 'clamd',
            'detail' => $text,
        ];
    }

    /** @return array{scanned:bool,clean:bool,engine:string,detail:string}|null */
    private static function viaCli(string $binary, string $path): ?array
    {
        if (!function_exists('proc_open')) {
            return null;
        }

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = @proc_open([$binary, $path], $descriptors, $pipes);
        if (!is_resource($process)) {
            return null;
        }

        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]) ?: '';
        stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($process);

        if ($code === 0) {
            return ['scanned' => true, 'clean' => true, 'engine' => $binary, 'detail' => trim($stdout)];
        }
        if ($code === 1) {
            return ['scanned' => true, 'clean' => false, 'engine' => $binary, 'detail' => trim($stdout)];
        }
        return null;
    }
}
