<?php

declare(strict_types=1);

namespace Ardson;

final class FileSignature
{
    /** Checks the magic bytes of a CV before validation runs. */
    public static function isExpected(string $path, string $extension): bool
    {
        $handle = @fopen($path, 'rb');
        if ($handle === false) {
            return false;
        }
        $head = fread($handle, 8);
        fclose($handle);
        if (!is_string($head) || strlen($head) < 2) {
            return false;
        }

        $extension = strtolower(ltrim($extension, '.'));

        if ($extension === 'pdf') {
            return strncmp($head, "%PDF-", 5) === 0;
        }
        if ($extension === 'doc') {
            return $head === "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1";
        }
        if ($extension === 'docx') {
            return strncmp($head, "PK\x03\x04", 4) === 0 || strncmp($head, "PK\x05\x06", 4) === 0;
        }
        return false;
    }
}
