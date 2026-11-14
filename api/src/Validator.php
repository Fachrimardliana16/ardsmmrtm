<?php

declare(strict_types=1);

namespace Ardson;

/**
 * Declarative validator with the same rules and messages as the Node
 * middleware (api/src/middleware/validate.js there).
 */
final class Validator
{
    /**
     * @param array<string,array<string,mixed>> $rules
     * @param array<string,mixed> $body
     * @return list<string> errors, empty when valid
     */
    public static function validate(array $rules, array $body): array
    {
        $errors = [];

        foreach ($rules as $field => $rule) {
            $label = (string) ($rule['label'] ?? $field);
            $raw = $body[$field] ?? null;
            $value = is_string($raw) ? trim($raw) : $raw;

            if (!empty($rule['required']) && ($value === null || $value === '' || $value === [])) {
                $errors[] = $label . ' is required.';
                continue;
            }
            if ($value === null || $value === '') {
                continue;
            }

            $type = (string) ($rule['type'] ?? '');
            if ($type === 'email' && !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/', (string) $value)) {
                $errors[] = $label . ' must be a valid email address.';
            }
            if ($type === 'date' && !Clock::isDate((string) $value)) {
                $errors[] = $label . ' must be a valid date.';
            }
            if ($type === 'array') {
                if (is_string($value)) {
                    $parsed = json_decode($value, true);
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        $errors[] = $label . ' must be a valid list.';
                    } elseif (!is_array($parsed)) {
                        $errors[] = $label . ' must be a list.';
                    }
                } elseif (!is_array($value)) {
                    $errors[] = $label . ' must be a list.';
                }
            }
            if ($type === 'number') {
                if (!is_numeric($value)) {
                    $errors[] = $label . ' must be a number.';
                } else {
                    $number = (float) $value;
                    if (isset($rule['min']) && $number < (float) $rule['min']) {
                        $errors[] = $label . ' must be at least ' . $rule['min'] . '.';
                    }
                    if (isset($rule['max']) && $number > (float) $rule['max']) {
                        $errors[] = $label . ' must be at most ' . $rule['max'] . '.';
                    }
                }
            }

            if (isset($rule['minLength'])) {
                $length = mb_strlen((string) $value, 'UTF-8');
                if ($length < (int) $rule['minLength']) {
                    $errors[] = $label . ' must be at least ' . $rule['minLength'] . ' characters.';
                }
            }
            if (isset($rule['maxLength'])) {
                $length = mb_strlen((string) $value, 'UTF-8');
                if ($length > (int) $rule['maxLength']) {
                    $errors[] = $label . ' must be at most ' . $rule['maxLength'] . ' characters.';
                }
            }

            if (isset($rule['pattern']) && is_string($rule['pattern'])) {
                $matched = @preg_match($rule['pattern'], (string) $value);
                if ($matched !== 1) {
                    $errors[] = (string) ($rule['patternMessage'] ?? ($label . ' has an invalid format.'));
                }
            }

            if (isset($rule['enum']) && is_array($rule['enum'])) {
                $allowed = array_map('strval', $rule['enum']);
                if (!in_array((string) $value, $allowed, true)) {
                    $errors[] = $label . ' must be one of: ' . implode(', ', $allowed) . '.';
                }
            }
        }

        return $errors;
    }

    /**
     * Validates and answers 422 on failure.
     *
     * @param array<string,array<string,mixed>> $rules
     * @param array<string,mixed> $body
     */
    public static function check(array $rules, array $body): void
    {
        $errors = self::validate($rules, $body);
        if ($errors !== []) {
            Response::fail($errors[0], 422, ['errors' => $errors]);
        }
    }
}
