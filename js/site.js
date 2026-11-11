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

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** Set text on every matching element, skipping empty values. */
    function setText(sel, value) {
        if (value == null || value === '') return;
        $$(sel).forEach((el) => { el.textContent = String(value); });
    }

    /** Set an attribute on every matching element, skipping empty values. */
    function setAttr(sel, attr, value) {
        if (value == null || value === '') return;
        $$(sel).forEach((el) => el.setAttribute(attr, String(value)));
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
        }

        if (site.favicon) {
            setAttr('link[data-site-favicon]', 'href', site.favicon);
            setAttr('link[rel="apple-touch-icon"]', 'href', site.favicon);
        }

        if (site.logo) {
            $$('[data-site-mark]').forEach((el) => {
                const img = document.createElement('img');
                img.src = site.logo;
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
            setAttr('[data-site-phone-link]', 'href', 'tel:' + site.phone_link);
            setAttr('[data-contact-phone]', 'href', 'tel:' + site.phone_link);
            setAttr('[data-contact-whatsapp]', 'href', 'https://wa.me/' + site.phone_link.replace(/[^\d]/g, ''));
            setText('[data-contact-whatsapp]', site.phone);
        }

        if (site.address) {
            setText('[data-site-address]', site.address);
            setText('[data-contact-address]', site.address);
        }

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

    function applyHeroFallback(hero) {
        const root = $('[data-hero]');
        if (!root) return;
        const img = $('[data-hero-image]', root);
        if (img && hero.image) {
            img.setAttribute('src', hero.image);
            img.setAttribute('srcset', hero.image);
        }
        setText('[data-hero-eyebrow]', hero.eyebrow);
        setText('[data-hero-title]', hero.title);
        setText('[data-hero-accent]', hero.title_accent);
        setText('[data-hero-lede]', hero.lede);
        setText('[data-hero-badge-title]', hero.badge_title);
        setText('[data-hero-badge-text]', hero.badge_text);
        setHeroControls(root, hero);
    }

    function setHeroControls(root, hero) {
        const primary = $('[data-hero-primary]', root);
        if (primary) {
            setLabel(primary, hero.primary_label);
            if (hero.primary_href && hero.primary_href !== '#') primary.setAttribute('href', hero.primary_href);
        }
        const secondary = $('[data-hero-secondary]', root);
        if (secondary) {
            setLabel(secondary, hero.secondary_label);
            if (hero.secondary_href && hero.secondary_href !== '#') {
                const link = document.createElement('a');
                link.className = secondary.className;
                link.href = hero.secondary_href;
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
                video.setAttribute('poster', slide.poster);
            }
            const source = document.createElement('source');
            source.setAttribute('src', slide.video);
            source.setAttribute('type', 'video/webm');
            video.appendChild(source);
            if (slide.video_fallback) {
                const fallback = document.createElement('source');
                fallback.setAttribute('src', slide.video_fallback);
                fallback.setAttribute('type', 'video/mp4');
                video.appendChild(fallback);
            }
            el.appendChild(video);
        } else if (slide.type !== 'text') {
            const img = document.createElement('img');
            img.className = 'hero-slide__media';
            if (slide.image) {
                img.setAttribute('src', slide.image);
                if (slide.image.includes('.webp')) {
                    img.setAttribute('srcset', slide.image.replace(/\.webp$/, '-1200.webp') + ' 1200w, ' + slide.image + ' 2400w');
                    img.setAttribute('sizes', '100vw');
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
            const showDots = hero.show_dots !== false && slides.length > 1;
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
        const showArrows = hero.show_arrows !== false && slides.length > 1;
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
            if (!this.options.autoplay || this.slides.length < 2) return;
            if (this.reduced) return;
            const slide = this.slides[this.current];
            const duration = Number(slide.duration) || 7000;
            this.timer = setTimeout(() => {
                if (this.hovering && this.options.pause_on_hover) {
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
       Help centre copy + header help/profile buttons
       ------------------------------------------------------------ */

    function applyHelp(help) {
        if (!help) return;
        setText('[data-help-eyebrow]', help.eyebrow);
        setText('[data-help-title]', help.title);
        setText('[data-help-lede]', help.lede);
        setText('[data-help-contact]', help.contact_note);
    }

    /**
     * Show or hide the header help + profile icon buttons and set their
     * destination from the admin-managed settings.
     */
    function applyHeaderButtons(settings) {
        /** Treat 0 / false / '0' as off; undefined or 1 / true as on. */
        const isOff = (v) => v === false || v === 0 || v === '0';

        const helpBtn = $('[data-header-help]');
        if (helpBtn) {
            const hb = settings.help_button || {};
            helpBtn.hidden = isOff(hb.enabled);
            if (!helpBtn.hidden) {
                const label = hb.label || helpBtn.getAttribute('data-default-label') || 'Help';
                helpBtn.setAttribute('title', label);
                helpBtn.setAttribute('aria-label', label);
                const href = hb.href || helpBtn.getAttribute('data-default-href') || 'help.html';
                if (href) {
                    helpBtn.setAttribute('href', href);
                    helpBtn.setAttribute('data-nav-page', 'help');
                    helpBtn.removeAttribute('disabled');
                } else {
                    helpBtn.setAttribute('href', '#');
                    helpBtn.setAttribute('disabled', '');
                }
            }
        }
        const profileBtn = $('[data-header-profile]');
        if (profileBtn) {
            const pb = settings.profile_button || {};
            profileBtn.hidden = isOff(pb.enabled);
            if (profileBtn.hidden) return;
            const label = pb.label || profileBtn.getAttribute('data-default-label') || 'My profile';
            profileBtn.setAttribute('title', label);
            profileBtn.setAttribute('aria-label', label);
            const mode = pb.mode || 'profile';
            if (mode === 'modal') {
                profileBtn.setAttribute('href', '#');
                profileBtn.setAttribute('data-open-modal', 'seafarer-modal');
                profileBtn.removeAttribute('data-nav-page');
            } else if (mode === 'hidden') {
                profileBtn.hidden = true;
            } else {
                profileBtn.setAttribute('href', pb.href || profileBtn.getAttribute('data-default-href') || 'profile.html');
                profileBtn.setAttribute('data-nav-page', 'profile');
                profileBtn.removeAttribute('data-open-modal');
            }
        }
    }

    async function init() {
        try {
            const res = await fetch(API + '/settings', { headers: { Accept: 'application/json' } });
            if (!res.ok) return;
            const payload = await res.json();
            const data = payload && payload.data;
            if (!data) return;
            applySite(data.site);
            applyHeaderButtons(data);
            applyHelp(data.help);
            applyHero(data.hero);
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
