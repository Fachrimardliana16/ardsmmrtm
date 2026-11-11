/**
 * Minimal allowlist HTML sanitizer shared by the public site and the
 * admin console.
 *
 * Rich text (legal pages, article bodies) is written in the admin console
 * and rendered with innerHTML. Even though only signed-in staff can write
 * it, a compromised or careless admin account should not be able to inject
 * executable markup into the public site. This strips scripts, event
 * handlers and javascript: URLs while keeping normal formatting.
 */
(function () {
    'use strict';

    const ALLOWED_TAGS = new Set([
        'p', 'div', 'span', 'br', 'hr', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i',
        'ul', 'ol', 'li', 'a', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'figure', 'figcaption', 'img'
    ]);
    const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

    function sanitizeHtml(html) {
        const template = document.createElement('template');
        template.innerHTML = String(html == null ? '' : html);
        const walk = (node) => {
            Array.from(node.children).forEach((el) => {
                const tag = el.tagName.toLowerCase();
                if (!ALLOWED_TAGS.has(tag)) {
                    // Unwrap unknown containers, then revisit the inserted
                    // children so a nested handler cannot slip through.
                    el.replaceWith(...el.childNodes);
                    walk(node);
                    return;
                }
                Array.from(el.attributes).forEach((attr) => {
                    const name = attr.name.toLowerCase();
                    const value = attr.value.trim();
                    if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
                        el.removeAttribute(attr.name);
                    } else if (URL_ATTRS.has(name) && /^\s*(javascript|data|vbscript):/i.test(value)) {
                        el.removeAttribute(attr.name);
                    }
                });
                walk(el);
            });
        };
        walk(template.content);
        return template.innerHTML;
    }

    window.ArdsonSanitize = { html: sanitizeHtml, ALLOWED_TAGS };
})();
