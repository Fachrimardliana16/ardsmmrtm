/**
 * Ardson Maritime Career Center — Client Application
 * Vanilla ES6+, no external UI framework.
 */
(function () {
    'use strict';

    document.documentElement.classList.add('js-ready');

    const API_BASE = (window.ARDSON_CONFIG && window.ARDSON_CONFIG.apiBase) || '/api/v1';
    const MAX_FILE_BYTES = 5 * 1024 * 1024;
    const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];

    const SEED_JOBS = [
        {
            id: 'AM-JOB-1001',
            title: 'Master / Captain',
            category: 'deck',
            vessel_type: 'Container',
            vessel_name: 'Pacific Line',
            principal: 'Pacific Shipping Ltd.',
            flag_state: 'Singapore',
            salary_min: 8200,
            salary_max: 9000,
            salary_currency: 'USD',
            contract_duration: '4 months',
            joining_date: '2026-12-05',
            status: 'open'
        },
        {
            id: 'AM-JOB-1002',
            title: 'Chief Engineer',
            category: 'engine',
            vessel_type: 'Tanker',
            vessel_name: 'Horizon',
            principal: 'Horizon Tankers S.A.',
            flag_state: 'Greece',
            salary_min: 9500,
            salary_max: 10200,
            salary_currency: 'USD',
            contract_duration: '3 months',
            joining_date: '2026-12-12',
            status: 'open'
        },
        {
            id: 'AM-JOB-1003',
            title: 'Able Seaman (AB)',
            category: 'deck',
            vessel_type: 'Bulk',
            vessel_name: 'Global Fleet',
            principal: 'Global Maritime Fleet',
            flag_state: 'Japan',
            salary_min: 1800,
            salary_max: 2100,
            salary_currency: 'USD',
            contract_duration: '6 months',
            joining_date: '2026-11-28',
            status: 'open'
        },
        {
            id: 'AM-JOB-1004',
            title: 'Chief Cook',
            category: 'hotel',
            vessel_type: 'Cruise',
            vessel_name: 'Royal Ocean',
            principal: 'Royal Ocean Cruises',
            flag_state: 'USA',
            salary_min: 2400,
            salary_max: 2800,
            salary_currency: 'USD',
            contract_duration: '5 months',
            joining_date: '2026-12-20',
            status: 'open'
        },
        {
            id: 'AM-JOB-1005',
            title: '2nd Engineer',
            category: 'engine',
            vessel_type: 'Offshore',
            vessel_name: 'Trident',
            principal: 'Trident Offshore Services',
            flag_state: 'UAE',
            salary_min: 4500,
            salary_max: 5200,
            salary_currency: 'USD',
            contract_duration: '4 months',
            joining_date: '2026-12-01',
            status: 'open'
        },
        {
            id: 'AM-JOB-1006',
            title: '2nd Officer',
            category: 'deck',
            vessel_type: 'LNG',
            vessel_name: 'Trans-Global',
            principal: 'Trans-Global Shipping',
            flag_state: 'United Kingdom',
            salary_min: 5000,
            salary_max: 5800,
            salary_currency: 'USD',
            contract_duration: '4 months',
            joining_date: '2026-12-08',
            status: 'open'
        }
    ];

    const state = {
        jobs: [],
        activeCategory: 'all',
        selectedJobForApply: null,
        mobileMenuOpen: false
    };

    const $ = (selector, parent = document) => parent.querySelector(selector);
    const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function money(amount, currency = 'USD') {
        return currency + ' ' + Number(amount).toLocaleString('en-US');
    }

    /** Vessel names arrive either bare ("Horizon") or prefixed ("MV Horizon"). */
    function vesselLabel(name) {
        if (!name) return '';
        const clean = String(name).trim();
        return /^(MV|MT|M\/V|M\/T)\s/i.test(clean) ? clean : 'MV ' + clean;
    }

    function formatDate(iso) {
        if (!iso) return 'Immediate';
        const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function showToast(message, variant = 'info', duration = 4000) {
        const container = $('#toast-container');
        if (!container) return;
        const item = document.createElement('div');
        item.className = 'toast-item toast-item--' + variant;
        item.textContent = message;
        container.appendChild(item);

        setTimeout(() => {
            item.classList.add('is-leaving');
            item.addEventListener('transitionend', () => item.remove(), { once: true });
            setTimeout(() => item.remove(), 400);
        }, duration);
    }

    async function apiRequest(endpoint, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        try {
            const res = await fetch(API_BASE + endpoint, { credentials: 'same-origin', ...options, signal: controller.signal });
            clearTimeout(timeout);
            const contentType = res.headers.get('content-type') || '';
            const data = contentType.includes('application/json') ? await res.json() : await res.text();
            if (!res.ok) {
                const message = (data && data.message) || 'Request failed (' + res.status + ')';
                const err = new Error(message);
                err.status = res.status;
                err.data = data;
                throw err;
            }
            return data;
        } catch (e) {
            clearTimeout(timeout);
            throw e;
        }
    }

    /* ------------------------------------------------------------
       NAVIGATION
       ------------------------------------------------------------ */
    function closeMobileMenu() {
        const menu = $('#mobile-menu');
        const btn = $('#mobile-menu-btn');
        if (!menu || !btn) return;
        menu.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        state.mobileMenuOpen = false;
        const icon = $('#menu-icon');
        if (icon) icon.setAttribute('d', 'M4 7h16M4 12h16M4 17h16');
    }

    function initNavigation() {
        const header = $('#site-header');
        if (header) {
            let lastY = window.scrollY;
            let ticking = false;

            const update = () => {
                const y = window.scrollY;
                header.classList.toggle('is-scrolled', y > 20);

                // Hide when scrolling down past the header, reveal on scroll up.
                const goingDown = y > lastY;
                const pastThreshold = y > header.offsetHeight + 40;

                if (goingDown && pastThreshold) {
                    header.classList.add('is-hidden');
                    // Don't leave a dropdown open behind a hidden header.
                    $$('[data-dropdown-toggle]').forEach(b => b.setAttribute('aria-expanded', 'false'));
                } else if (!goingDown) {
                    header.classList.remove('is-hidden');
                }

                lastY = y;
                ticking = false;
            };

            window.addEventListener('scroll', () => {
                if (!ticking) {
                    window.requestAnimationFrame(update);
                    ticking = true;
                }
            }, { passive: true });

            update();
        }

        const menuBtn = $('#mobile-menu-btn');
        const menu = $('#mobile-menu');
        const menuIcon = $('#menu-icon');
        if (menuBtn && menu) {
            menuBtn.addEventListener('click', () => {
                state.mobileMenuOpen = !state.mobileMenuOpen;
                menu.classList.toggle('is-open', state.mobileMenuOpen);
                menuBtn.setAttribute('aria-expanded', String(state.mobileMenuOpen));
                if (menuIcon) {
                    menuIcon.setAttribute(
                        'd',
                        state.mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 7h16M4 12h16M4 17h16'
                    );
                }
            });

            $$('#mobile-menu a').forEach(a => {
                a.addEventListener('click', () => closeMobileMenu());
            });
        }

        $$('[data-dropdown-toggle]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const current = btn.getAttribute('aria-expanded') === 'true';
                $$('[data-dropdown-toggle]').forEach(b => b.setAttribute('aria-expanded', 'false'));
                btn.setAttribute('aria-expanded', String(!current));
            });
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nav-group')) {
                $$('[data-dropdown-toggle]').forEach(b => b.setAttribute('aria-expanded', 'false'));
            }
        });

        $$('[data-accordion]').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-accordion');
                const target = document.getElementById(targetId);
                if (!target) return;
                const open = target.classList.toggle('is-open');
                btn.setAttribute('aria-expanded', String(open));
            });
        });
    }

    /* ------------------------------------------------------------
       SCROLL REVEAL
       ------------------------------------------------------------ */
    function initReveal() {
        const reveals = $$('.reveal');
        if (!reveals.length) return;
        if (!('IntersectionObserver' in window)) {
            reveals.forEach(el => el.classList.add('is-visible'));
            return;
        }
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        reveals.forEach(el => observer.observe(el));
    }

    /* ------------------------------------------------------------
       MODALS
       ------------------------------------------------------------ */
    let lastActiveElement = null;

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        lastActiveElement = document.activeElement;
        closeMobileMenu();
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        const focusable = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal);
        if (focusable.length) {
            setTimeout(() => focusable[0].focus(), 60);
        }
    }

    function closeModal(id) {
        const modal = typeof id === 'string' ? document.getElementById(id) : id;
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
            lastActiveElement.focus();
        }
    }

    function initModals() {
        // Delegated: buttons injected after load (job detail, empty states)
        // open modals too, without re-binding.
        document.addEventListener('click', (e) => {
            const trigger = e.target.closest('[data-open-modal]');
            if (trigger) {
                e.preventDefault();
                openModal(trigger.getAttribute('data-open-modal'));
                return;
            }
            const closer = e.target.closest('[data-modal-close]');
            if (closer) {
                closeModal(closer.getAttribute('data-modal-close'));
            }
        });

        $$('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal(modal);
            });
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeModal(modal);
                if (e.key === 'Tab') {
                    const focusables = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal)
                        .filter(el => !el.disabled && el.offsetParent !== null);
                    if (!focusables.length) return;
                    const first = focusables[0];
                    const last = focusables[focusables.length - 1];
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            });
        });
    }

    /* ------------------------------------------------------------
       JOB BOARD
       ------------------------------------------------------------ */
    function jobCardHtml(job) {
        const currency = job.salary_currency || 'USD';
        const salaryText = (job.salary_min != null && job.salary_max != null)
            ? money(job.salary_min, currency) + ' – ' + money(job.salary_max, currency)
            : 'Negotiable';
        const vesselParts = [job.vessel_type, vesselLabel(job.vessel_name)]
            .filter(Boolean)
            .map(escapeHtml)
            .join(' · ');

        return `
            <article class="job-card" data-category="${escapeHtml(job.category)}" data-id="${escapeHtml(job.id)}">
                <div class="job-card__top">
                    <div>
                        <h3 class="job-card__rank">${escapeHtml(job.title)}</h3>
                        <p class="job-card__vessel">${vesselParts}</p>
                    </div>
                    <div class="job-card__pay">
                        <strong>${escapeHtml(salaryText)}</strong>
                        <span>${escapeHtml(job.contract_duration || 'Standard contract')}</span>
                    </div>
                </div>
                <p class="job-card__principal">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3.5 9h17M3.5 15h17M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18"/></svg>
                    Hiring by ${escapeHtml(job.principal)} · ${escapeHtml(job.flag_state || 'International')}
                </p>
                <div class="job-card__meta">
                    <span>Joining: ${escapeHtml(formatDate(job.joining_date))}</span>
                    <span>Free application</span>
                </div>
                <div class="job-card__actions">
                    <a href="job.html?id=${encodeURIComponent(job.id)}" class="btn btn--ghost btn--block btn--sm">View details</a>
                    <button type="button" class="btn btn--soft btn--block btn--sm" data-apply data-apply-title="${escapeHtml(job.title)}" data-apply-rank="${escapeHtml(job.title)}">
                        Apply now
                    </button>
                </div>
            </article>
        `;
    }

    function renderJobs() {
        const container = $('#job-cards-container');
        if (!container) return;

        // The home page shows a short preview; jobs.html shows the full board.
        const limit = Number(container.getAttribute('data-limit')) || 0;
        const open = state.jobs.filter(job => (job.status || 'open') === 'open');
        const visible = limit > 0 ? open.slice(0, limit) : open;

        container.innerHTML = visible.map(jobCardHtml).join('');
        applyJobFilter(state.activeCategory);

        container.querySelectorAll('[data-apply]').forEach(btn => {
            btn.addEventListener('click', () => {
                const jobTitle = btn.getAttribute('data-apply-title') || '';
                const rank = btn.getAttribute('data-apply-rank') || jobTitle;
                openApply(rank, jobTitle);
            });
        });
    }

    function applyJobFilter(category) {
        state.activeCategory = category;
        const cards = $$('.job-card', $('#job-cards-container'));
        let visibleCount = 0;
        cards.forEach(card => {
            const cardCat = card.getAttribute('data-category');
            const show = (category === 'all' || cardCat === category);
            card.classList.toggle('is-hidden', !show);
            if (show) visibleCount++;
        });

        const countEl = $('#job-count-visible');
        if (countEl) countEl.textContent = String(visibleCount);
        const emptyEl = $('#jobs-empty');
        if (emptyEl) emptyEl.classList.toggle('is-visible', visibleCount === 0);

        $$('#job-tabs button').forEach(btn => {
            const isActive = btn.getAttribute('data-tab') === category;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
        });
    }

    async function loadJobs() {
        const skeleton = $('#jobs-loading');
        if (skeleton) skeleton.style.display = 'grid';
        try {
            const res = await apiRequest('/jobs');
            state.jobs = (res && Array.isArray(res.data) && res.data.length) ? res.data : SEED_JOBS;
        } catch (_err) {
            state.jobs = SEED_JOBS;
        } finally {
            if (skeleton) skeleton.style.display = 'none';
            const params = new URLSearchParams(window.location.search);
            const q = (params.get('q') || '').trim().toLowerCase();
            if (q) {
                state.jobs = state.jobs.filter((job) => {
                    const hay = [job.title, job.rank, job.vessel, job.location, job.category]
                        .filter(Boolean).join(' ').toLowerCase();
                    return hay.includes(q);
                });
            }
            renderJobs();
        }
    }

    function initJobBoard() {
        // Only fetch the board where a container exists.
        if (!$('#job-cards-container')) return;
        $$('#job-tabs button').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.getAttribute('data-tab') || 'all';
                applyJobFilter(cat);
            });
        });
        loadJobs();
    }

    function openApply(rank, jobTitle) {
        state.selectedJobForApply = { rank, title: jobTitle };
        const rankSelect = $('#seafarer-rank');
        if (rankSelect && rank) {
            const matched = Array.from(rankSelect.options).find(opt =>
                rank.toLowerCase().includes(opt.value.split('/')[0].trim().toLowerCase())
            );
            if (matched) rankSelect.value = matched.value;
        }
        const contextBox = $('#apply-context');
        if (contextBox) {
            const label = contextBox.querySelector('[data-apply-label]');
            if (label) label.textContent = jobTitle || 'Selected vacancy';
            contextBox.classList.add('is-visible');
        }
        openModal('seafarer-modal');
    }

    /* ------------------------------------------------------------
       FILE UPLOAD (CV)
       ------------------------------------------------------------ */
    function initFileUpload() {
        const fileInput = $('#cv-file-input');
        const dropzone = $('#cv-dropzone');
        const label = $('#cv-file-label');
        if (!fileInput || !dropzone) return;

        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });

        ['dragenter', 'dragover'].forEach(name => {
            dropzone.addEventListener(name, (e) => {
                e.preventDefault();
                dropzone.classList.add('is-dragover');
            });
        });
        ['dragleave', 'drop'].forEach(name => {
            dropzone.addEventListener(name, (e) => {
                e.preventDefault();
                dropzone.classList.remove('is-dragover');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files && files.length) {
                fileInput.files = files;
                updateLabel(files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
                updateLabel(fileInput.files[0]);
            }
        });

        function updateLabel(file) {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                showToast('Only PDF, DOC, or DOCX files are accepted.', 'error');
                fileInput.value = '';
                if (label) label.textContent = 'Click to choose a file or drag it here';
                return;
            }
            if (file.size > MAX_FILE_BYTES) {
                showToast('File exceeds 5MB limit.', 'error');
                fileInput.value = '';
                if (label) label.textContent = 'Click to choose a file or drag it here';
                return;
            }
            if (label) {
                const mb = (file.size / (1024 * 1024)).toFixed(2);
                label.textContent = file.name + ' (' + mb + ' MB)';
            }
        }
    }

    /* ------------------------------------------------------------
       FORMS
       ------------------------------------------------------------ */
    function setBusy(form, busy, originalText = '') {
        const btn = form.querySelector('button[type="submit"]');
        if (!btn) return;
        btn.disabled = busy;
        if (busy) {
            btn.dataset.prevText = btn.textContent;
            btn.textContent = 'Sending...';
        } else {
            btn.textContent = originalText || btn.dataset.prevText || 'Submit';
        }
    }

    function checkedValues(name, root = document) {
        return $$(`input[name="${name}"]:checked`, root).map(i => i.value);
    }

    function initForms() {
        // Seafarer registration
        const seafarerForm = $('#seafarer-form');
        if (seafarerForm) {
            seafarerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = ($('#seafarer-name')?.value || '').trim();
                const email = ($('#seafarer-email')?.value || '').trim();
                const phone = ($('#seafarer-phone')?.value || '').trim();
                const rank = ($('#seafarer-rank')?.value || '').trim();
                const consent = $('#consent-check')?.checked;

                if (!name || !email || !phone || !rank) {
                    showToast('Please fill in all required fields.', 'error');
                    return;
                }
                if (!consent) {
                    showToast('Please consent to personal data processing under Indonesia PDP Law.', 'error');
                    return;
                }

                setBusy(seafarerForm, true);
                try {
                    const fd = new FormData(seafarerForm);
                    const certs = checkedValues('certifications', seafarerForm);
                    fd.delete('certifications');
                    fd.append('certifications', JSON.stringify(certs));

                    const res = await apiRequest('/seafarers/register', { method: 'POST', body: fd });
                    const ref = (res && res.data && res.data.reference) ? ' Ref: ' + res.data.reference : '';
                    showToast('Registration received.' + ref + ' We will contact you within 2 working days.', 'success', 6000);
                    seafarerForm.reset();
                    const label = $('#cv-file-label');
                    if (label) label.textContent = 'Click to choose a file or drag it here';
                    const ctx = $('#apply-context');
                    if (ctx) ctx.classList.remove('is-visible');
                    closeModal('seafarer-modal');
                } catch (err) {
                    const msg = (err.data && err.data.message) || err.message || 'Submission failed. Please try again.';
                    showToast(msg, 'error');
                } finally {
                    setBusy(seafarerForm, false);
                }
            });
        }

        // Principal crew request
        const principalForm = $('#principal-form');
        if (principalForm) {
            principalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const company = ($('#principal-company')?.value || '').trim();
                const email = ($('#principal-email')?.value || '').trim();
                const vessel = ($('#principal-vessel')?.value || '').trim();
                const joining = ($('#principal-joining')?.value || '').trim();
                const ranks = ($('#principal-ranks')?.value || '').trim();

                if (!company || !email || !vessel || !joining || !ranks) {
                    showToast('Please complete all required fields.', 'error');
                    return;
                }

                setBusy(principalForm, true);
                try {
                    const payload = {
                        company_name: company,
                        email,
                        vessel_type: vessel,
                        joining_date: joining,
                        required_ranks: ranks,
                        contract_duration: ($('#principal-duration')?.value || '').trim(),
                        flag_state: ($('#principal-flag')?.value || '').trim()
                    };
                    const res = await apiRequest('/principals/crew-request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const ref = (res && res.data && res.data.reference) ? ' Ref: ' + res.data.reference : '';
                    showToast('Crew request received.' + ref + ' Proposals will follow within 24 hours.', 'success', 6000);
                    principalForm.reset();
                    closeModal('principal-modal');
                } catch (err) {
                    const msg = (err.data && err.data.message) || err.message || 'Submission failed. Please try again.';
                    showToast(msg, 'error');
                } finally {
                    setBusy(principalForm, false);
                }
            });
        }

        // Contact form
        const contactForm = $('#contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = ($('#contact-name')?.value || '').trim();
                const email = ($('#contact-email')?.value || '').trim();
                const message = ($('#contact-message')?.value || '').trim();

                if (!name || !email || !message) {
                    showToast('Please fill out all contact fields.', 'error');
                    return;
                }

                setBusy(contactForm, true);
                try {
                    await apiRequest('/contact', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, message })
                    });
                    showToast('Message sent. We will reply during working hours.', 'success');
                    contactForm.reset();
                } catch (err) {
                    const msg = (err.data && err.data.message) || err.message || 'Failed to send message.';
                    showToast(msg, 'error');
                } finally {
                    setBusy(contactForm, false);
                }
            });
        }

        // Emergency replacement form
        const emergencyForm = $('#emergency-form');
        if (emergencyForm) {
            emergencyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const company_name = ($('#em-company')?.value || '').trim();
                const email = ($('#em-email')?.value || '').trim();
                const vessel_type = $('#em-vessel')?.value || '';
                const joining_date = $('#em-join')?.value || '';
                const required_ranks = ($('#em-ranks')?.value || '').trim();
                const port = ($('#em-port')?.value || '').trim();
                const reason = $('#em-reason')?.value || '';
                const notes = ($('#em-notes')?.value || '').trim();

                if (!company_name || !email || !vessel_type || !joining_date || !required_ranks) {
                    showToast('Please fill out company, email, vessel, joining date, and rank.', 'error');
                    return;
                }

                setBusy(emergencyForm, true);
                try {
                    await apiRequest('/principals/emergency', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ company_name, email, vessel_type, joining_date, required_ranks, port, reason, notes })
                    });
                    showToast('Emergency request sent. Duty desk will respond within 30 minutes.', 'success');
                    emergencyForm.reset();
                } catch (err) {
                    const msg = (err.data && err.data.message) || err.message || 'Failed to send emergency request.';
                    showToast(msg, 'error');
                } finally {
                    setBusy(emergencyForm, false);
                }
            });
        }

        // Newsletter form
        const newsletterForm = $('#newsletter-form');
        if (newsletterForm) {
            newsletterForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = ($('#newsletter-email')?.value || '').trim();
                if (!email) {
                    showToast('Please enter an email address.', 'error');
                    return;
                }
                setBusy(newsletterForm, true);
                try {
                    await apiRequest('/newsletter', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    showToast('Subscribed. Thank you!', 'success');
                    newsletterForm.reset();
                } catch (err) {
                    const msg = (err.data && err.data.message) || err.message || 'Subscription failed.';
                    showToast(msg, 'error');
                } finally {
                    setBusy(newsletterForm, false);
                }
            });
        }
    }

    function initInquiryButtons() {
        $$('[data-inquiry]').forEach(btn => {
            btn.addEventListener('click', () => {
                const message = btn.getAttribute('data-inquiry');
                showToast(message, 'info', 4500);
            });
        });
    }

    function initYear() {
        $$('[data-year]').forEach(el => {
            el.textContent = String(new Date().getFullYear());
        });
    }

    function initHeroSearch() {
        const form = $('.hero-search');
        if (!form) return;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = ($('.hero-search__input', form)?.value || '').trim();
            const url = q ? `jobs.html?q=${encodeURIComponent(q)}` : 'jobs.html';
            window.location.href = url;
        });
    }

    function initHeroStats() {
        const nums = $$('.hero-stat__num[data-count]');
        if (!nums.length) return;
        const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const finalise = (el) => {
            const target = Number(el.getAttribute('data-count')) || 0;
            const suffix = el.getAttribute('data-suffix') || '';
            el.textContent = target.toLocaleString('en-US') + suffix;
        };
        if (prefersReduced) { nums.forEach(finalise); return; }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                io.unobserve(el);
                const target = Number(el.getAttribute('data-count')) || 0;
                const suffix = el.getAttribute('data-suffix') || '';
                const dur = 1200;
                const start = performance.now();
                const step = (now) => {
                    const t = Math.min(1, (now - start) / dur);
                    const eased = 1 - Math.pow(1 - t, 3);
                    const val = Math.round(target * eased);
                    el.textContent = val.toLocaleString('en-US') + suffix;
                    if (t < 1) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            });
        }, { threshold: 0.4 });
        nums.forEach((el) => {
            el.textContent = '0' + (el.getAttribute('data-suffix') || '');
            io.observe(el);
        });
    }

    function init() {
        initNavigation();
        initReveal();
        initModals();
        initJobBoard();
        initHeroSearch();
        initHeroStats();
        initFileUpload();
        initForms();
        initInquiryButtons();
        initYear();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();