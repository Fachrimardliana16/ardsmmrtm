/**
 * Ardson Maritime — site settings applier.
 *
 * Reads /api/v1/settings (written from the admin console) and applies
 * brand, contact, social, and the hero slideshow to the current page.
 *
 * The HTML keeps sensible static defaults, so the site still renders
 * correctly when the API is unreachable (static hosting, cold start).
 *
 * Hero slideshow supports 1..N slides. Each slide can be an image,
 * a muted background video, or text-only. Transitions: fade, slide, zoom.
 */
(function () {
    'use strict';

    const API = (window.ARDSON_CONFIG && window.ARDSON_CONFIG.apiBase) || '/api/v1';

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const esc = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    /**
     * Admin-authored links and media URLs are html-escaped elsewhere, but
     * escaping does not stop a `javascript:` URL. Only allow normal web,
     * mail and phone schemes plus relative paths.
     */
    function safeUrl(value, fallback = '#') {
        const url = String(value == null ? '' : value).trim();
        if (!url) return fallback;
        const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(url);
        if (hasScheme && !/^(https?:|mailto:|tel:)/i.test(url)) return fallback;
        return url;
    }

    /**
     * Rich text comes from the admin console. Use the shared allowlist
     * sanitizer; if it failed to load, fall back to plain escaped text so
     * the page never renders raw markup.
     */
    const sanitizeHtml = (html) => (
        window.ArdsonSanitize ? window.ArdsonSanitize.html(html) : esc(html)
    );

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** Set text on every matching element. An empty string clears the text. */
    function setText(sel, value) {
        if (value == null) return;
        $$(sel).forEach((el) => { el.textContent = String(value); });
    }

    /** Set an attribute on every matching element, skipping empty values. */
    function setAttr(sel, attr, value) {
        if (value == null || value === '') return;
        $$(sel).forEach((el) => el.setAttribute(attr, String(value)));
    }

    /** Scoped text setter for block headings and cards. */
    function setTextIn(root, sel, value) {
        if (value == null) return;
        const el = root.querySelector(sel);
        if (el) el.textContent = String(value);
    }

    function applySiteMap(site) {
        if (site.latitude == null || site.longitude == null) return;
        const lat = Number(site.latitude);
        const lng = Number(site.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const d = 0.08;
        const src = 'https://www.openstreetmap.org/export/embed.html?bbox='
            + (lng - d).toFixed(4) + '%2C' + (lat - d).toFixed(4) + '%2C'
            + (lng + d).toFixed(4) + '%2C' + (lat + d).toFixed(4)
            + '&layer=mapnik&marker=' + lat + '%2C' + lng;
        $$('[data-site-map]').forEach((el) => el.setAttribute('src', src));
    }

    function applyCanonical(site) {
        if (!site.site_url) return;
        // Vacancy and article pages set their own canonical from the query
        // string; leave it alone so it is not overwritten by /job or /insight.
        if (/(job|insight)\.html?$/i.test(window.location.pathname) && window.location.search) return;
        const base = String(site.site_url).replace(/\/+$/, '');
        const path = window.location.pathname || '/';
        let clean = /\/index\.html?$/i.test(path) ? path.replace(/index\.html?$/i, '') : path;
        clean = clean.replace(/\.html?$/i, '');
        const url = base + (clean === '/' ? '/' : clean);
        setAttr('link[rel="canonical"]', 'href', url);
        setAttr('meta[property="og:url"]', 'content', url);
    }

    /**
     * Keep the JSON-LD graph in step with Settings → Website. The static
     * build seeds it, then this rewrites name, contact, address, geo, and
     * social profiles from live settings.
     */
    function applyStructuredData(site) {
        const name = [site.name, site.tagline].filter(Boolean).join(' ').trim();
        const base = String(site.site_url || '').replace(/\/+$/, '');
        const social = Object.values(site.social || {}).filter(Boolean);
        const latitude = site.latitude != null ? Number(site.latitude) : null;
        const longitude = site.longitude != null ? Number(site.longitude) : null;

        $$('script[type="application/ld+json"]').forEach((script) => {
            let json;
            try { json = JSON.parse(script.textContent); } catch (_e) { return; }
            const nodes = Array.isArray(json['@graph']) ? json['@graph'] : [json];
            nodes.forEach((node) => {
                if (!node || !['Organization', 'EmploymentAgency', 'WebSite', 'CollectionPage'].includes(node['@type'])) return;
                if (name) node.name = name;
                if (base) node.url = base;
                if (site.email) node.email = site.email;
                if (site.phone_link) node.telephone = site.phone_link;
                if (node.address) {
                    node.address = {
                        ...node.address,
                        streetAddress: site.address || node.address.streetAddress,
                        addressLocality: site.city || node.address.addressLocality,
                        addressRegion: site.region || node.address.addressRegion,
                        addressCountry: site.country || node.address.addressCountry
                    };
                }
                if (node.geo && Number.isFinite(latitude) && Number.isFinite(longitude)) {
                    node.geo = { ...node.geo, latitude, longitude };
                }
                if (social.length) node.sameAs = social;
            });
            script.textContent = JSON.stringify(json);
        });
    }

    function applySite(site) {
        if (!site) return;

        setText('[data-site-name]', site.name);
        setText('[data-site-tagline]', site.tagline);

        // Lettered brand mark falls back to the first letter of the name.
        const mark = site.logo ? null : (site.name || 'A').trim().charAt(0).toUpperCase();
        if (mark) setText('[data-site-mark]', mark);
        if (site.name) {
            const footerName = [site.name, site.tagline].filter(Boolean).join(' ');
            setText('[data-site-footer-name]', footerName);
            setAttr('.brand', 'aria-label', footerName);
        }

        if (site.description) {
            setAttr('meta[name="description"]', 'content', site.description);
            setAttr('meta[property="og:description"]', 'content', site.description);
            setAttr('meta[name="twitter:description"]', 'content', site.description);
            setText('[data-site-description]', site.description);
        }
        if (site.name) {
            setAttr('meta[property="og:site_name"]', 'content', site.name);
        }

        if (site.favicon) {
            setAttr('link[data-site-favicon]', 'href', site.favicon);
            setAttr('link[rel="apple-touch-icon"]', 'href', site.favicon);
        }

        if (site.logo) {
            $$('[data-site-mark]').forEach((el) => {
                const logo = safeUrl(site.logo, '');
                if (!logo) return;
                const img = document.createElement('img');
                img.src = logo;
                img.alt = '';
                img.loading = 'lazy';
                img.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:inherit';
                el.textContent = '';
                el.appendChild(img);
            });
        }

        if (site.email) {
            setText('[data-site-email]', site.email);
            setAttr('[data-site-email-link]', 'href', 'mailto:' + site.email);
            setAttr('[data-contact-email]', 'href', 'mailto:' + site.email);
            setText('[data-contact-email]', site.email);
        }

        if (site.phone) {
            setText('[data-site-phone]', site.phone);
            setText('[data-contact-phone]', site.phone);
        }
        if (site.phone_link) {
            const tel = 'tel:' + site.phone_link;
            setAttr('[data-site-phone-link]', 'href', tel);
            setAttr('[data-contact-phone]', 'href', tel);
            // Some pages render the duty-line number as an anchor tagged
            // directly with data-site-phone; keep those hrefs in sync too.
            $$('[data-site-phone]').forEach((el) => {
                if (el.tagName === 'A') el.setAttribute('href', tel);
            });
            setAttr('[data-contact-whatsapp]', 'href', 'https://wa.me/' + site.phone_link.replace(/[^\d]/g, ''));
            setText('[data-contact-whatsapp]', site.phone);
        }

        if (site.address) {
            setText('[data-site-address]', site.address);
            setText('[data-contact-address]', site.address);
        }
        if (site.hours) setText('[data-site-hours]', site.hours);

        if (site.city) setAttr('meta[name="geo.placename"]', 'content', site.city + (site.region ? ', ' + site.region : ''));
        if (site.latitude != null && site.longitude != null) {
            setAttr('meta[name="geo.position"]', 'content', site.latitude + ';' + site.longitude);
            setAttr('meta[name="ICBM"]', 'content', site.latitude + ', ' + site.longitude);
        }

        const social = site.social || {};
        Object.keys(social).forEach((key) => {
            const url = social[key];
            $$('[data-social="' + key + '"]').forEach((el) => {
                if (url) {
                    el.setAttribute('href', url);
                    el.setAttribute('rel', 'noopener noreferrer');
                    el.setAttribute('target', '_blank');
                    el.removeAttribute('aria-disabled');
                } else {
                    el.setAttribute('href', '#');
                    el.setAttribute('aria-disabled', 'true');
                }
            });
        });

        applySiteMap(site);
        applyCanonical(site);
        applyStructuredData(site);
    }

    /* ------------------------------------------------------------
       Hero slideshow
       ------------------------------------------------------------ */

    /** Replace only the leading text node so trailing icons survive. */
    function setLabel(el, label) {
        if (!label) return;
        const textNode = Array.from(el.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim() !== '');
        if (textNode) {
            textNode.textContent = ' ' + label + ' ';
        } else {
            el.insertBefore(document.createTextNode(label), el.firstChild);
        }
    }

    /** Admin toggles are stored as 1/0, but older payloads may use true/false. */
    function flagOn(value) {
        return !(value === false || value === 0 || value === '0' || value === 'false');
    }

    /**
     * Hide the hero badge when both of its lines are empty, so clearing
     * badge copy in the admin console removes it from the public hero.
     */
    function syncHeroBadge(root) {
        const badge = $('.hero__badge', root);
        if (!badge) return;
        const title = $('[data-hero-badge-title]', root);
        const text = $('[data-hero-badge-text]', root);
        const hasCopy = Boolean((title && title.textContent.trim()) || (text && text.textContent.trim()));
        badge.hidden = !hasCopy;
    }

    function applyHeroFallback(hero) {
        const root = $('[data-hero]');
        if (!root) return;
        const img = $('[data-hero-image]', root);
        if (img && hero.image) {
            const src = safeUrl(hero.image, '');
            if (src) {
                img.setAttribute('src', src);
                img.setAttribute('srcset', src);
            }
        }
        setText('[data-hero-eyebrow]', hero.eyebrow);
        setText('[data-hero-title]', hero.title);
        setText('[data-hero-accent]', hero.title_accent);
        setText('[data-hero-lede]', hero.lede);
        setText('[data-hero-badge-title]', hero.badge_title);
        setText('[data-hero-badge-text]', hero.badge_text);
        syncHeroBadge(root);
        setHeroControls(root, hero);
    }

    function setHeroControls(root, hero) {
        const primary = $('[data-hero-primary]', root);
        if (primary) {
            setLabel(primary, hero.primary_label);
            if (hero.primary_href && hero.primary_href !== '#') primary.setAttribute('href', safeUrl(hero.primary_href));
        }
        const secondary = $('[data-hero-secondary]', root);
        if (secondary) {
            setLabel(secondary, hero.secondary_label);
            if (hero.secondary_href && hero.secondary_href !== '#') {
                const link = document.createElement('a');
                link.className = secondary.className;
                link.href = safeUrl(hero.secondary_href);
                link.setAttribute('data-hero-secondary', '');
                link.textContent = hero.secondary_label || secondary.textContent.trim();
                secondary.replaceWith(link);
            }
        }
    }

    /** Build one slide element. Returns a container ready to mount. */
    function buildSlide(slide) {
        const el = document.createElement('div');
        el.className = 'hero-slide hero-slide--' + (slide.type || 'image');
        el.setAttribute('data-slide-type', slide.type || 'image');
        el.setAttribute('role', 'group');
        el.setAttribute('aria-roledescription', 'slide');

        if (slide.type === 'video' && slide.video) {
            const video = document.createElement('video');
            video.className = 'hero-slide__media';
            video.setAttribute('autoplay', '');
            video.setAttribute('loop', '');
            video.setAttribute('muted', '');
            video.setAttribute('playsinline', '');
            video.setAttribute('preload', 'metadata');
            if (slide.poster) {
                video.setAttribute('poster', safeUrl(slide.poster));
            }
            const source = document.createElement('source');
            source.setAttribute('src', safeUrl(slide.video));
            source.setAttribute('type', 'video/webm');
            video.appendChild(source);
            if (slide.video_fallback) {
                const fallback = document.createElement('source');
                fallback.setAttribute('src', safeUrl(slide.video_fallback));
                fallback.setAttribute('type', 'video/mp4');
                video.appendChild(fallback);
            }
            el.appendChild(video);
        } else if (slide.type !== 'text') {
            const img = document.createElement('img');
            img.className = 'hero-slide__media';
            if (slide.image) {
                const src = safeUrl(slide.image, '');
                if (src) {
                    img.setAttribute('src', src);
                    if (src.includes('.webp')) {
                        img.setAttribute('srcset', src.replace(/\.webp$/, '-1200.webp') + ' 1200w, ' + src + ' 2400w');
                        img.setAttribute('sizes', '100vw');
                    }
                }
            }
            img.setAttribute('alt', '');
            img.setAttribute('loading', 'eager');
            img.setAttribute('fetchpriority', 'high');
            el.appendChild(img);
        }

        // Every slide keeps its own scrim so videos and text-only slides look consistent.
        const scrim = document.createElement('span');
        scrim.className = 'hero-slide__scrim';
        el.appendChild(scrim);

        return el;
    }

    function applyHeroSlides(root, hero, slides) {
        const bg = $('[data-hero-slides]', root);
        if (!bg) return;

        const transition = ['fade', 'slide', 'zoom'].includes(hero.transition) ? hero.transition : 'fade';
        root.setAttribute('data-hero-transition', transition);

        // Wipe the static image placeholder before inserting live slides.
        bg.innerHTML = '';

        slides.forEach((slide) => bg.appendChild(buildSlide(slide)));

        const dots = $('[data-hero-dots]', root);
        if (dots) {
            dots.innerHTML = '';
            const showDots = flagOn(hero.show_dots) && slides.length > 1;
            dots.hidden = !showDots;
            if (showDots) {
                slides.forEach((_, i) => {
                    const dot = document.createElement('button');
                    dot.type = 'button';
                    dot.className = 'hero-dot';
                    dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
                    dot.setAttribute('data-slide-dot', String(i));
                    dots.appendChild(dot);
                });
            }
        }

        // Arrows sit on either side of the dots row, so hide/show them
        // individually (rather than hiding a wrapping container).
        const showArrows = flagOn(hero.show_arrows) && slides.length > 1;
        const prevBtn = $('[data-hero-prev]', root);
        const nextBtn = $('[data-hero-next]', root);
        if (prevBtn) prevBtn.hidden = !showArrows;
        if (nextBtn) nextBtn.hidden = !showArrows;

        new HeroSlider(root, slides, hero);
    }

    class HeroSlider {
        constructor(root, slides, options) {
            this.root = root;
            this.slides = slides;
            this.options = options;
            this.current = 0;
            this.timer = null;
            this.hovering = false;
            this.reduced = reduceMotion;

            this.bg = $('[data-hero-slides]', root);
            this.dots = $$('[data-slide-dot]', root);
            this.prevBtn = $('[data-hero-prev]', root);
            this.nextBtn = $('[data-hero-next]', root);

            this.copyEl = $('[data-hero-eyebrow]', root)?.closest('.hero__copy');

            this.bind();
            this.goTo(0, true);
        }

        bind() {
            this.dots.forEach((dot) => {
                dot.addEventListener('click', () => {
                    const idx = Number(dot.getAttribute('data-slide-dot'));
                    this.goTo(idx);
                    this.restartTimer();
                });
            });

            if (this.prevBtn) this.prevBtn.addEventListener('click', () => { this.prev(); this.restartTimer(); });
            if (this.nextBtn) this.nextBtn.addEventListener('click', () => { this.next(); this.restartTimer(); });

            // Pause when the user is about to interact with the hero.
            this.root.addEventListener('mouseenter', () => { this.hovering = true; });
            this.root.addEventListener('mouseleave', () => { this.hovering = false; });
            this.root.addEventListener('focusin', () => { this.hovering = true; });
            this.root.addEventListener('focusout', () => { this.hovering = false; });

            // Touch swipe.
            let touchStartX = null;
            this.root.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].clientX;
            }, { passive: true });
            this.root.addEventListener('touchend', (e) => {
                if (touchStartX == null) return;
                const dx = e.changedTouches[0].clientX - touchStartX;
                if (Math.abs(dx) > 40) { dx > 0 ? this.prev() : this.next(); }
                touchStartX = null;
            }, { passive: true });

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) this.stopTimer();
                else this.startTimer();
            });
        }

        goTo(idx, instant) {
            const len = this.slides.length;
            if (!len) return;
            this.current = (idx + len) % len;
            const slide = this.slides[this.current];

            const nodes = $$('.hero-slide', this.bg);
            nodes.forEach((el, i) => {
                const on = i === this.current;
                el.classList.toggle('is-active', on);
                el.setAttribute('aria-hidden', on ? 'false' : 'true');
                const video = el.querySelector('video');
                if (video) {
                    if (on) {
                        const playPromise = video.play();
                        if (playPromise && playPromise.catch) playPromise.catch(() => {});
                    } else {
                        video.pause();
                        if (video.currentTime > 0) video.currentTime = 0;
                    }
                }
            });

            // Cross-fade the text.
            if (this.copyEl) {
                this.copyEl.classList.remove('is-swapping');
                // Force a reflow so the fade-out restarts.
                void this.copyEl.offsetWidth;
                this.copyEl.classList.add('is-swapping');
            }
            setText('[data-hero-eyebrow]', slide.eyebrow);
            setText('[data-hero-title]', slide.title);
            setText('[data-hero-accent]', slide.title_accent);
            setText('[data-hero-lede]', slide.lede);
            setText('[data-hero-badge-title]', slide.badge_title);
            setText('[data-hero-badge-text]', slide.badge_text);
            syncHeroBadge(this.root);
            if (this.copyEl) {
                requestAnimationFrame(() => this.copyEl.classList.remove('is-swapping'));
            }

            this.dots.forEach((dot, i) => {
                dot.classList.toggle('is-active', i === this.current);
                dot.setAttribute('aria-current', i === this.current ? 'true' : 'false');
            });

            this.startTimer();
        }

        next() { this.goTo(this.current + 1); }
        prev() { this.goTo(this.current - 1); }

        startTimer() {
            this.stopTimer();
            if (!flagOn(this.options.autoplay) || this.slides.length < 2) return;
            if (this.reduced) return;
            const slide = this.slides[this.current];
            const duration = Number(slide.duration) || 7000;
            this.timer = setTimeout(() => {
                if (this.hovering && flagOn(this.options.pause_on_hover)) {
                    this.startTimer();
                    return;
                }
                this.next();
            }, duration);
        }

        stopTimer() {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        }

        restartTimer() {
            this.stopTimer();
            this.startTimer();
        }
    }

    function applyHero(hero) {
        if (!hero) return;
        const root = $('[data-hero]');
        if (!root) return;

        setHeroControls(root, hero);

        const slides = Array.isArray(hero.slides) ? hero.slides.filter((s) => {
            if (s.type === 'video') return Boolean(s.video);
            if (s.type === 'text') return true;
            return Boolean(s.image);
        }) : [];

        if (slides.length) {
            applyHeroSlides(root, hero, slides);
        } else {
            applyHeroFallback(hero);
        }
    }

    /* ------------------------------------------------------------
       Reusable content blocks (editable in the admin console)
       ------------------------------------------------------------ */

    const CHECK_SVG = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';

    const TRUST_ICONS = [
        '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l7 3v5c0 4.4-2.9 8.4-7 10-4.1-1.6-7-5.6-7-10V6l7-3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/></svg>',
        '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l9 5-9 5-9-5 9-5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 13l9 5 9-5"/></svg>',
        '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 11l2 2 4-4"/></svg>',
        '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/></svg>'
    ];

    const STEP_ICONS = [
        '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 2"/></svg>',
        '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
        '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l18-8-8 18-2-8-8-2z"/></svg>',
        '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>'
    ];

    function applyBlockHead(key, block) {
        if (!block) return;
        const head = $('[data-blockhead="' + key + '"]');
        if (!head) return;
        setTextIn(head, '.eyebrow', block.eyebrow);
        setTextIn(head, 'h2', block.title);
        setTextIn(head, 'p', block.lede);
        const link = $('[data-blockhead-link="' + key + '"]');
        if (link) {
            if (block.link_label) setLabel(link, block.link_label);
            if (block.link_href) link.setAttribute('href', safeUrl(block.link_href));
        }
    }

    function applyAudience(block) {
        applyBlockHead('audience', block);
        const root = $('[data-block="audience"]');
        if (!root || !Array.isArray(block?.items)) return;
        root.innerHTML = block.items.map((item, i) => {
            const id = item.key || (i === 0 ? 'seafarers' : 'principals');
            const modal = id === 'principals' ? 'principal-modal' : 'seafarer-modal';
            const bullets = (item.bullets || []).map((bullet) => {
                const linkified = id === 'principals' && /emergency/i.test(bullet)
                    ? '<a href="emergency.html" style="color:inherit;text-decoration:none">' + esc(bullet) + '</a>'
                    : esc(bullet);
                return '<li>' + CHECK_SVG + ' ' + linkified + '</li>';
            }).join('');
            return `
                <div id="${esc(id)}" class="audience__card reveal is-visible">
                    <div>
                        <span class="audience__tag">${esc(item.tag)}</span>
                        ${item.image ? `<div class="audience__media"><img src="${esc(safeUrl(item.image, ''))}" alt="" loading="lazy"></div>` : ''}
                        <h3>${esc(item.title)}</h3>
                        <p>${esc(item.text)}</p>
                        <ul class="feature-list">${bullets}</ul>
                    </div>
                    <div class="audience__actions">
                        <button type="button" data-open-modal="${modal}" class="btn btn--primary btn--block">${esc(item.primary_label)}</button>
                        <a href="${esc(safeUrl(item.secondary_href, '#'))}" class="btn btn--ghost btn--block btn--sm">${esc(item.secondary_label)}</a>
                    </div>
                </div>`;
        }).join('');
    }

    function applyTrust(block) {
        applyBlockHead('trust', block);
        const root = $('[data-block="trust"]');
        if (!root || !Array.isArray(block?.items)) return;
        root.innerHTML = block.items.map((item, i) => `
            <div class="trust-tile">
                <span class="trust-tile__icon" aria-hidden="true">${TRUST_ICONS[i % TRUST_ICONS.length]}</span>
                <strong>${esc(item.title)}</strong>
                <span>${esc(item.text)}</span>
            </div>`).join('');
    }

    function applyTraining(block) {
        applyBlockHead('training', block);
        const root = $('[data-block="training"]');
        if (!root || !Array.isArray(block?.items)) return;
        root.innerHTML = block.items.map((item) => `
            <div class="training-item reveal is-visible">
                <div>
                    <span class="training-item__num">${esc(item.num)}</span>
                    <h3>${esc(item.title)}</h3>
                    <p>${esc(item.text)}</p>
                </div>
                <a href="${esc(safeUrl(item.link_href, '#'))}">${esc(item.link_label || 'Explore programme')} &rarr;</a>
            </div>`).join('');
    }

    function applyFaq(block) {
        applyBlockHead('faq', block);
        const root = $('[data-block="faq"]');
        if (!root || !Array.isArray(block?.items)) return;
        root.innerHTML = block.items.map((item) => `
            <div class="feat-card reveal is-visible">
                <h3>${esc(item.title)}</h3>
                <p>${esc(item.text)}</p>
            </div>`).join('');
    }

    function applySteps(key, block, variant) {
        applyBlockHead(key, block);
        const root = $('[data-block="' + key + '"]');
        if (!root || !Array.isArray(block?.items)) return;
        if (variant === 'emergency') {
            root.innerHTML = block.items.map((item, i) => `
                <div class="feat-card reveal is-visible">
                    <div class="feat-card__icon" aria-hidden="true">${STEP_ICONS[i % STEP_ICONS.length]}</div>
                    <h3>${esc(item.title)}</h3>
                    <p>${esc(item.text)}</p>
                </div>`).join('');
            return;
        }
        root.innerHTML = block.items.map((item) => `
            <div class="step reveal is-visible">
                <h3>${esc(item.title)}</h3>
                <p>${esc(item.text)}</p>
            </div>`).join('');
    }

    function applyBlocks(blocks) {
        if (!blocks) return;
        applyAudience(blocks.audience);
        applyTrust(blocks.trust);
        applyTraining(blocks.training);
        applyFaq(blocks.faq);
        applySteps('stepsSeafarers', blocks.stepsSeafarers);
        applySteps('stepsPrincipals', blocks.stepsPrincipals);
        applySteps('stepsEmergency', blocks.stepsEmergency, 'emergency');
    }

    /* ------------------------------------------------------------
       Per-page overrides (Settings → Pages)
       ------------------------------------------------------------ */

    function pageSlug() {
        const file = (window.location.pathname.split('/').pop() || 'index.html');
        return file.replace(/\.html?$/i, '') || 'index';
    }

    function applyPageContent(pages) {
        // Job and article detail pages own their metadata (set by pages.js
        // from the record they fetched), so do not override them here.
        if (/(job|insight)\.html?$/i.test(window.location.pathname) && window.location.search) return;
        const data = pages && pages[pageSlug()];
        if (!data) return;

        if (data.title) {
            document.title = data.title;
            setAttr('meta[property="og:title"]', 'content', data.title);
            setAttr('meta[name="twitter:title"]', 'content', data.title);
        }
        if (data.description != null && data.description !== '') {
            setAttr('meta[name="description"]', 'content', data.description);
            setAttr('meta[property="og:description"]', 'content', data.description);
            setAttr('meta[name="twitter:description"]', 'content', data.description);
        }

        const hero = $('.page-hero');
        if (hero) {
            setTextIn(hero, '.eyebrow', data.eyebrow);
            setTextIn(hero, 'h1', data.heading);
            setTextIn(hero, '.lede', data.lede);
        }

        if (data.body && data.body.trim()) {
            const clean = sanitizeHtml(data.body);
            $$('[data-legal-body]').forEach((el) => { el.innerHTML = clean; });
        }
    }

    /* ------------------------------------------------------------
       Help centre copy
       ------------------------------------------------------------ */

    function applyHelp(help) {
        if (!help) return;
        setText('[data-help-eyebrow]', help.eyebrow);
        setText('[data-help-title]', help.title);
        setText('[data-help-lede]', help.lede);
        setText('[data-help-contact]', help.contact_note);
    }

    async function init() {
        try {
            const res = await fetch(API + '/settings', { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            const payload = await res.json();
            const data = payload && payload.data;
            if (!data) return;
            applySite(data.site);
            applyHelp(data.help);
            applyHero(data.hero);
            applyBlocks(data.blocks);
            applyPageContent(data.pages);
        } catch (_err) {
            /* Static defaults remain in place. */
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
