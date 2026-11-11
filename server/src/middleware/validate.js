/**
 * Minimal declarative validator — no external dependency.
 *
 * Rule shape:
 *   { field: { label, required, type, minLength, maxLength, pattern, patternMessage, enum } }
 */

function validate(rules) {
    return (req, res, next) => {
        const errors = [];
        const body = req.body || {};

        Object.keys(rules).forEach((field) => {
            const rule = rules[field];
            const raw = body[field];
            const value = typeof raw === 'string' ? raw.trim() : raw;

            if (rule.required && (value === undefined || value === null || value === '')) {
                errors.push(rule.label + ' is required.');
                return;
            }
            if (value === undefined || value === null || value === '') return;

            if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value))) {
                errors.push(rule.label + ' must be a valid email address.');
            }
            if (rule.type === 'date' && Number.isNaN(Date.parse(String(value)))) {
                errors.push(rule.label + ' must be a valid date.');
            }
            if (rule.type === 'array') {
                try {
                    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                    if (!Array.isArray(parsed)) errors.push(rule.label + ' must be a list.');
                } catch (_e) {
                    errors.push(rule.label + ' must be a valid list.');
                }
            }
            if (rule.type === 'number') {
                const num = Number(value);
                if (Number.isNaN(num)) errors.push(rule.label + ' must be a number.');
                else {
                    if (rule.min !== undefined && num < rule.min) {
                        errors.push(rule.label + ' must be at least ' + rule.min + '.');
                    }
                    if (rule.max !== undefined && num > rule.max) {
                        errors.push(rule.label + ' must be at most ' + rule.max + '.');
                    }
                }
            }
            if (rule.minLength && String(value).length < rule.minLength) {
                errors.push(rule.label + ' must be at least ' + rule.minLength + ' characters.');
            }
            if (rule.maxLength && String(value).length > rule.maxLength) {
                errors.push(rule.label + ' must be at most ' + rule.maxLength + ' characters.');
            }
            if (rule.pattern && !rule.pattern.test(String(value))) {
                errors.push(rule.patternMessage || rule.label + ' has an invalid format.');
            }
            if (rule.enum && !rule.enum.includes(String(value))) {
                errors.push(rule.label + ' must be one of: ' + rule.enum.join(', ') + '.');
            }
        });

        if (errors.length) {
            return res.status(422).json({ ok: false, message: errors[0], errors });
        }
        next();
    };
}

module.exports = { validate };