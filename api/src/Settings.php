<?php

declare(strict_types=1);

namespace Ardson;

/**
 * Website settings stored as one JSON document, with the same merge and
 * reset semantics as the Node store.
 */
final class Settings
{
    /** @var array<string,mixed>|null */
    private static ?array $defaults = null;

    /** @return array<string,mixed> */
    public static function defaults(): array
    {
        if (self::$defaults === null) {
            $file = API_ROOT . '/data/settings-default.json';
            $raw = is_file($file) ? file_get_contents($file) : false;
            $decoded = is_string($raw) ? json_decode($raw, true) : null;
            self::$defaults = is_array($decoded) ? $decoded : [];
        }
        return self::$defaults;
    }

    /** @return array<string,mixed> */
    public static function get(): array
    {
        $row = Db::one('SELECT `data` FROM `settings` WHERE `id` = 1');
        if ($row === null) {
            return self::defaults();
        }
        $decoded = json_decode((string) $row['data'], true);
        return is_array($decoded) ? $decoded : self::defaults();
    }

    /** @param array<string,mixed> $settings */
    public static function save(array $settings): void
    {
        $json = json_encode($settings, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $exists = Db::value('SELECT COUNT(*) FROM `settings` WHERE `id` = 1');
        if ((int) $exists === 0) {
            Db::insert('settings', ['id' => 1, 'data' => $json]);
        } else {
            Db::run('UPDATE `settings` SET `data` = ? WHERE `id` = 1', [$json]);
        }
    }

    /**
     * Returns null for an unknown section, matching store.updateSettings.
     *
     * @param array<string,mixed> $patch
     * @return array<string,mixed>|null
     */
    public static function update(string $section, array $patch): ?array
    {
        foreach (['__proto__', 'constructor', 'prototype'] as $blocked) {
            unset($patch[$blocked]);
        }

        $settings = self::get();

        switch ($section) {
            case 'site':
                $current = is_array($settings['site'] ?? null) ? $settings['site'] : [];
                $merged = array_merge($current, $patch);
                $social = is_array($patch['social'] ?? null) ? $patch['social'] : null;
                if ($social !== null) {
                    $merged['social'] = array_merge(
                        is_array($current['social'] ?? null) ? $current['social'] : [],
                        $social
                    );
                }
                $settings['site'] = $merged;
                break;

            case 'hero':
            case 'help':
            case 'profile_button':
            case 'help_button':
                $current = is_array($settings[$section] ?? null) ? $settings[$section] : [];
                $settings[$section] = array_merge($current, $patch);
                break;

            case 'pages':
            case 'blocks':
                $current = is_array($settings[$section] ?? null) ? $settings[$section] : [];
                foreach ($patch as $key => $value) {
                    if ($value === null) {
                        unset($current[$key]);
                    } else {
                        $current[$key] = $value;
                    }
                }
                $settings[$section] = $current;
                break;

            default:
                return null;
        }

        self::save($settings);
        return $settings;
    }

    /** @return array<string,mixed> */
    public static function reset(string $section): array
    {
        $defaults = self::defaults();
        if ($section === 'all' || !array_key_exists($section, $defaults)) {
            $settings = $defaults;
        } else {
            $settings = self::get();
            $settings[$section] = $defaults[$section];
        }
        self::save($settings);
        return $settings;
    }

    /** @return array<string,mixed> */
    public static function resetBlock(string $key): array
    {
        $defaults = self::defaults();
        $settings = self::get();
        $defaultBlocks = is_array($defaults['blocks'] ?? null) ? $defaults['blocks'] : [];
        if (array_key_exists($key, $defaultBlocks)) {
            $blocks = is_array($settings['blocks'] ?? null) ? $settings['blocks'] : [];
            $blocks[$key] = $defaultBlocks[$key];
            $settings['blocks'] = $blocks;
            self::save($settings);
        }
        return $settings;
    }

    /** @return list<array<string,mixed>> */
    public static function slides(): array
    {
        $settings = self::get();
        $slides = $settings['hero']['slides'] ?? [];
        return is_array($slides) ? array_values($slides) : [];
    }

    /** @param list<array<string,mixed>> $slides */
    public static function saveSlides(array $slides): void
    {
        $settings = self::get();
        if (!isset($settings['hero']) || !is_array($settings['hero'])) {
            $settings['hero'] = [];
        }
        $settings['hero']['slides'] = array_values($slides);
        self::save($settings);
    }
}
