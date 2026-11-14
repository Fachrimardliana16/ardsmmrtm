<?php

declare(strict_types=1);

namespace Ardson;

final class Clock
{
    public static function isoNow(): string
    {
        return (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    }

    public static function dateNow(): string
    {
        return gmdate('Y-m-d');
    }

    public static function year(): string
    {
        return gmdate('Y');
    }

    /** Parses the permissive date formats the browser/Node accepted. */
    public static function isDate(string $value): bool
    {
        if (trim($value) === '') {
            return false;
        }
        $timestamp = strtotime($value);
        return $timestamp !== false;
    }
}
