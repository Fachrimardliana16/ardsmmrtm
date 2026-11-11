/**
 * Ardson Maritime — Inner page scripts
 * Active nav, job detail renderer, article detail renderer, reveal.
 * Loaded only on non-home pages (home keeps js/app.js).
 */
(function () {
    'use strict';

    const API_BASE = (window.ARDSON_CONFIG && window.ARDSON_CONFIG.apiBase) || '/api/v1';

    /* Canonical job seeds (mirror of server/src/data/store.js SEED_JOBS). */
    const SEED_JOBS = [
        { id: 'AM-JOB-1001', title: 'Master / Captain', category: 'deck', vessel_type: 'Container', vessel_name: 'Pacific Line', principal: 'Pacific Shipping Ltd.', flag_state: 'Singapore', salary_min: 8200, salary_max: 9000, salary_currency: 'USD', contract_duration: '4 months', joining_date: '2026-12-05', status: 'open' },
        { id: 'AM-JOB-1002', title: 'Chief Engineer', category: 'engine', vessel_type: 'Tanker', vessel_name: 'Horizon', principal: 'Horizon Tankers S.A.', flag_state: 'Greece', salary_min: 9500, salary_max: 10200, salary_currency: 'USD', contract_duration: '3 months', joining_date: '2026-12-12', status: 'open' },
        { id: 'AM-JOB-1003', title: 'Able Seaman (AB)', category: 'deck', vessel_type: 'Bulk', vessel_name: 'Global Fleet', principal: 'Global Maritime Fleet', flag_state: 'Japan', salary_min: 1800, salary_max: 2100, salary_currency: 'USD', contract_duration: '6 months', joining_date: '2026-11-28', status: 'open' },
        { id: 'AM-JOB-1004', title: 'Chief Cook', category: 'hotel', vessel_type: 'Cruise', vessel_name: 'Royal Ocean', principal: 'Royal Ocean Cruises', flag_state: 'USA', salary_min: 2400, salary_max: 2800, salary_currency: 'USD', contract_duration: '5 months', joining_date: '2026-12-20', status: 'open' },
        { id: 'AM-JOB-1005', title: '2nd Engineer', category: 'engine', vessel_type: 'Offshore', vessel_name: 'Trident', principal: 'Trident Offshore Services', flag_state: 'UAE', salary_min: 4500, salary_max: 5200, salary_currency: 'USD', contract_duration: '4 months', joining_date: '2026-12-01', status: 'open' },
        { id: 'AM-JOB-1006', title: '2nd Officer', category: 'deck', vessel_type: 'LNG', vessel_name: 'Trans-Global', principal: 'Trans-Global Shipping', flag_state: 'United Kingdom', salary_min: 5000, salary_max: 5800, salary_currency: 'USD', contract_duration: '4 months', joining_date: '2026-12-08', status: 'open' }
    ];

    const $ = (s, p = document) => p.querySelector(s);
    const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

    const escapeHtml = (s) => (s == null ? '' : String(s))
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const money = (n, c = 'USD') => c + ' ' + Number(n).toLocaleString('en-US');

    /** Vessel names arrive bare ("Horizon") or prefixed ("MV Horizon"). */
    const vesselLabel = (name) => {
        if (!name) return '';
        const clean = String(name).trim();
        return /^(MV|MT|M\/V|M\/T)\s/i.test(clean) ? clean : 'MV ' + clean;
    };

    const formatDate = (iso) => {
        if (!iso) return 'Immediate';
        const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    /* ------------------------------------------------------------
       Active nav (based on data-page on <body>)
       ------------------------------------------------------------ */
    function markActiveNav() {
        const page = document.body.getAttribute('data-page');
        if (!page) return;
        const mark = (rootSel) => {
            $$(`${rootSel} [data-nav-page]`).forEach((a) => {
                if (a.getAttribute('data-nav-page') !== page) return;
                a.classList.add('is-active');
                a.setAttribute('aria-current', 'page');
                const group = a.closest('.nav-group, .mobile-group');
                if (!group) return;
                const toggle = group.querySelector('[data-dropdown-toggle], [data-accordion]');
                if (toggle) toggle.classList.add('is-active');
                if (group.classList.contains('mobile-group')) {
                    const sub = group.querySelector('.mobile-sub');
                    if (sub) sub.classList.add('is-open');
                }
            });
        };
        mark('.main-nav');
        mark('.mobile-menu');
        mark('.header-actions');
    }

    /* ------------------------------------------------------------
       Job detail
       ------------------------------------------------------------ */
    async function loadJobDetail() {
        const root = $('#job-detail');
        if (!root) return;

        const params = new URLSearchParams(window.location.search);
        const id = (params.get('id') || '').trim();
        if (!id) { renderJobMissing(root); return; }

        let job = null;
        try {
            const res = await fetch(API_BASE + '/jobs/' + encodeURIComponent(id), {
                signal: AbortSignal.timeout(8000)
            });
            if (res.ok) {
                const payload = await res.json();
                job = (payload && payload.data) || null;
            }
        } catch (_e) {
            /* network failure — fall through to the seed list */
        }

        if (!job) {
            job = SEED_JOBS.find((j) => j.id === id) || null;
        }

        if (!job) { renderJobMissing(root); return; }
        renderJob(root, job);
        document.title = job.title + ' — Ardson Maritime Career Center';
        const crumb = document.querySelector('.crumb [data-crumb-title]');
        if (crumb) crumb.textContent = job.title;
        const h1 = document.querySelector('.page-hero h1');
        if (h1) h1.textContent = job.title;
        const lede = document.querySelector('.page-hero .lede');
        if (lede) lede.textContent = job.principal
            ? ('Join ' + job.principal + ' as ' + job.title + ' aboard ' + (vesselLabel(job.vessel_name) || job.vessel_type) + '. Free application under MLC 2006.')
            : lede.textContent;
    }

    function renderJob(root, job) {
        const c = job.salary_currency || 'USD';
        const salaryText = (job.salary_min != null && job.salary_max != null)
            ? money(job.salary_min, c) + ' – ' + money(job.salary_max, c)
            : 'Negotiable';

        root.innerHTML = `
            <div class="detail-wrap">
                <div class="detail-main">
                    <div class="prose">
                        <h2>Role overview</h2>
                        <p>
                            Ardson Maritime is looking for a ${escapeHtml(job.title)} to join the
                            ${escapeHtml(job.vessel_type)} fleet operated by ${escapeHtml(job.principal)}.
                            You will be part of a multicultural bridge/engine team and are expected to hold
                            valid STCW 2010 certificates with the flag endorsements required for
                            ${escapeHtml(job.flag_state || 'international')} registration.
                        </p>
                        <p>
                            Contracts run for ${escapeHtml(job.contract_duration || 'the standard rotation')},
                            with joining at ${escapeHtml(formatDate(job.joining_date))}. Sea service on
                            sister tonnage is an advantage. Successful candidates are screened on document
                            authenticity, medical fitness, and Marlins English proficiency before embarkation.
                        </p>

                        <h2>Key responsibilities</h2>
                        <ul>
                            <li>Hold and maintain every certificate required by STCW 2010 for the rank, including flag-state endorsements.</li>
                            <li>Keep a valid, in-date seaman's book, passport, and medical fitness certificate throughout the contract.</li>
                            <li>Work within the Safety Management System and the principal's permit-to-work regime.</li>
                            <li>Support MLC 2006 working and rest hour requirements on board.</li>
                            <li>Hand over systematically to relief crew at the end of the rotation.</li>
                        </ul>

                        <h2>What we look for</h2>
                        <ul>
                            <li>Certificate of Competency (CoC) for ${escapeHtml(job.title)} with STCW endorsements.</li>
                            <li>Minimum 24 months in rank on comparable ${escapeHtml(job.vessel_type)} tonnage.</li>
                            <li>Proficient maritime English (Marlins test pass or equivalent).</li>
                            <li>Willing to sign a ${escapeHtml(job.contract_duration || 'standard')} contract with joining at the stated date.</li>
                        </ul>

                        <h2>What we offer</h2>
                        <ul>
                            <li>Salary range ${escapeHtml(salaryText)} on a ${escapeHtml(job.contract_duration || 'rotational')} contract.</li>
                            <li>Free placement — Ardson Maritime charges no fee to seafarers (MLC 2006).</li>
                            <li>Visa, flag-state endorsement, and ticketing support handled by our mobilisation team.</li>
                            <li>Direct placement with ${escapeHtml(job.principal)}, with re-hire priority for strong reports.</li>
                        </ul>
                    </div>
                </div>

                <aside class="detail-aside">
                    <div class="quickcard">
                        <h2>Vacancy details</h2>
                        <dl>
                            <div class="spec"><dt>Reference</dt><dd>${escapeHtml(job.id)}</dd></div>
                            <div class="spec"><dt>Department</dt><dd class="cap">${escapeHtml(categoryLabel(job.category))}</dd></div>
                            <div class="spec"><dt>Vessel type</dt><dd class="cap">${escapeHtml(job.vessel_type)}</dd></div>
                            <div class="spec"><dt>Vessel</dt><dd>${escapeHtml(vesselLabel(job.vessel_name) || '—')}</dd></div>
                            <div class="spec"><dt>Principal</dt><dd>${escapeHtml(job.principal || '—')}</dd></div>
                            <div class="spec"><dt>Flag state</dt><dd>${escapeHtml(job.flag_state || 'International')}</dd></div>
                            <div class="spec"><dt>Salary</dt><dd class="pay">${escapeHtml(salaryText)}</dd></div>
                            <div class="spec"><dt>Contract</dt><dd>${escapeHtml(job.contract_duration || '—')}</dd></div>
                            <div class="spec"><dt>Joining</dt><dd>${escapeHtml(formatDate(job.joining_date))}</dd></div>
                            <div class="spec"><dt>Status</dt><dd>${escapeHtml((job.status || 'open').charAt(0).toUpperCase() + (job.status || 'open').slice(1))}</dd></div>
                        </dl>
                    </div>
                    <div class="apply-card">
                        <h2>Apply for this role</h2>
                        <p>Register your profile and upload your CV. Our crewing team will contact you within two working days.</p>
                        <button type="button" class="btn btn--primary btn--block" data-open-modal="seafarer-modal"
                            data-apply-title="${escapeHtml(job.title)}" data-apply-rank="${escapeHtml(job.title)}">
                            Apply now
                        </button>
                        <p class="note">Free application under MLC 2006. No agency fee to seafarers.</p>
                    </div>
                </aside>
            </div>
        `;
        wireApplyButton(root);
    }

    function renderJobMissing(root) {
        root.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" stroke-width="1.25" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3.5-3.5"/></svg>
                <h3>We could not find that vacancy</h3>
                <p>The position may have been filled or closed. Browse the current openings or register your profile for direct matching.</p>
                <a href="/jobs" class="btn btn--primary btn--sm">Browse vacancies</a>
            </div>
        `;
    }

    function categoryLabel(cat) {
        if (cat === 'deck') return 'Deck / Nautical';
        if (cat === 'engine') return 'Engine / Technical';
        if (cat === 'hotel') return 'Hotel & Catering';
        return cat || 'Deck';
    }

    function wireApplyButton(scope) {
        $$('[data-apply-title][data-open-modal]', scope).forEach((btn) => {
            btn.addEventListener('click', () => {
                const rank = btn.getAttribute('data-apply-rank') || '';
                const title = btn.getAttribute('data-apply-title') || '';
                const select = $('#seafarer-rank');
                if (select && rank) {
                    const matched = Array.from(select.options).find((o) =>
                        rank.toLowerCase().includes(o.value.split('/')[0].trim().toLowerCase())
                    );
                    if (matched) select.value = matched.value;
                }
                const ctx = $('#apply-context');
                if (ctx) {
                    const label = ctx.querySelector('[data-apply-label]');
                    if (label) label.textContent = title || 'Selected vacancy';
                    ctx.classList.add('is-visible');
                }
            });
        });
    }

    /* ------------------------------------------------------------
       Article detail
       ------------------------------------------------------------ */
    const ARTICLES = [
        {
            slug: 'navigating-career-opportunities-in-global-shipping',
            title: 'Navigating career opportunities in global shipping',
            tag: 'Career guide',
            date: '24 September 2026',
            read: '5 min read',
            image: 'https://images.unsplash.com/photo-1516214104703-d870798883c5?auto=format&fit=crop&q=80&w=1600',
            lede: 'International shipping underpins world trade. Learn how deck and engine officers can move into tanker and LNG fleets for long-term growth.',
            body: `<h2>Where the demand sits today</h2>
<p>The global fleet keeps growing faster than the pipeline of qualified officers, and that gap is most obvious in tanker, gas carrier, and offshore tonnage. Shipping companies that once hired almost exclusively from Europe and the Philippines now source heavily from Indonesia, India, and Eastern Europe. For an Indonesian officer with a clean record and current certificates, that means more choice of vessels, flags, and salary packages than at any point in the last decade.</p>
<p>Container shipping remains the largest single employer of deck and engine officers, but it is also the most cyclical. Tanker and LNG contracts tend to be longer and less exposed to the same demand swings, which is one reason we see officers use a container contract as a first step and then move into tankers once they have a couple of years of sea time behind them.</p>
<h2>Building a credible seafaring CV</h2>
<p>Ship managers read a CV for two things: can this person actually do the rank, and will they pass the principal's screening. Both come down to how clearly the sea service is laid out. Every contract should show the vessel type, gross tonnage, engine or kW, rank held, dates, and the flag state. Photocopies of the seaman's book and the discharge book do more for an application than a page of self-description.</p>
<h3>Certificates that open doors</h3>
<ul>
<li>Certificate of Competency for the target rank, with STCW 2010 endorsements.</li>
<li>Advanced tanker and gas qualifications (CoP) if you are aiming at tankers or LNG.</li>
<li>MCU or equivalent medical fitness, ideally dated within the last twelve months.</li>
<li>A Marlins test result or documented English proficiency, which most European principals now require.</li>
</ul>
<h2>From rating to officer</h2>
<p>ABLE Seaman and Oiler who plan to sit for the officer-of-the-watch exam should tell their crewing agency early. Some principals fund OOW training and exams for ratings who have already proven themselves on board, especially on tankers where the bridge team is small and continuity is valuable.</p>
<h2>Questions to ask before signing</h2>
<p>Before accepting any contract, confirm the wage in writing, the currency, the contract length, the joining port, and who pays for the flight and visa. A reputable manning agency under MLC 2006 will not charge you a recruitment fee, will give you a written contract in English, and will not ask you to sign anything you have not read. If a middleman asks for cash up front, walk away.</p>`
        },
        {
            slug: 'stcw-and-medical-document-checklist-for-2026',
            title: 'STCW and medical document checklist for 2026',
            tag: 'Certification',
            date: '20 September 2026',
            read: '4 min read',
            image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=1600',
            lede: 'Avoid joining delays by keeping flag state endorsements, yellow fever certificates, seaman\'s book renewals, and MLC contract verification current.',
            body: `<h2>Why documents fail at the gangway</h2>
<p>The most common reason a seafarer misses a joining date is not a lack of experience. It is a certificate that lapsed three weeks before travel, a missing flag endorsement, or a medical certificate signed by a clinic the principal does not recognise. Almost every one of those is preventable with a checklist and a renewal diary.</p>
<h2>The core set every officer should keep valid</h2>
<ul>
<li><strong>Certificate of Competency (CoC)</strong> for the rank held, plus the STCW 2010 endorsements for the flag state of the vessel you are joining.</li>
<li><strong>Seaman's book</strong>, with at least six blank pages and validity extending past the contract end date.</li>
<li><strong>Passport</strong>, also valid past the contract end date and ideally past twelve months beyond it.</li>
<li><strong>Medical fitness certificate</strong> from a clinic approved by the flag state or the principal, normally valid for twelve months or two years depending on the issuing authority.</li>
<li><strong>Basic Safety Training (BST)</strong>, refreshed within the past five years as required by STCW 2010.</li>
</ul>
<h2>Special certificates for special tonnage</h2>
<p>Tanker officers need the appropriate Oil, Chemical, or Liquefied Gas familiarisation and advanced training certificates. Liquefied gas tonnage also expects a basic and advanced gas tanker certificate. Cruise and passenger vessel officers should confirm crowd management and crisis management requirements with the principal before joining.</p>
<h3>Medical and travel documents</h3>
<ul>
<li>Yellow fever vaccination, if the itinerary includes countries on the WHO list.</li>
<li>Marlins test result, or another recognised English proficiency certificate.</li>
<li>A signed contract under MLC 2006, with wages, duration, and repatriation costs clearly stated.</li>
</ul>
<h2>Working with a manning agency</h2>
<p>A legitimate agency under MLC 2006 does not charge seafarers a placement fee. We review every document against the principal's requirements before a candidate is proposed, tell you which certificates are about to lapse, and coordinate the visa, flag endorsement, and ticket. That is the standard Ardson Maritime holds itself to for every placement.</p>`
        },
        {
            slug: 'how-indonesian-seafarers-can-stand-out-to-international-principals',
            title: 'How Indonesian seafarers can stand out to international principals',
            tag: 'Career guide',
            date: '12 August 2026',
            read: '5 min read',
            image: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?auto=format&fit=crop&q=80&w=1600',
            lede: 'Maritime English, document hygiene, and sea-service records separate strong candidates from the rest of the pool.',
            body: `<h2>English is the working language</h2>
<p>Almost every international principal now uses the Marlins test, or an equivalent, as part of the screening process. A score of 75% or above on Marlins is the practical threshold for officers joining European-owned tonnage. Crew who prepare for Marlins properly pass it on the first attempt, and that single score often decides whether an application gets forwarded.</p>
<h2>Document hygiene</h2>
<p>Principals screen applications against a shortlist of documents. Having them current, legible, and easy to find removes friction from the process. We advise every candidate to keep a single PDF folder with:</p>
<ul>
<li>Passport and seaman's book.</li>
<li>Certificate of Competency and STCW endorsements.</li>
<li>Medical fitness certificate.</li>
<li>Latest Marlins test result.</li>
<li>Sea service letters from each principal.</li>
<li>Up-to-date CV, with each contract on one row.</li>
</ul>
<h2>Reputation compounds</h2>
<p>Sea service on a well-known principal, with a clean discharge and a good reference, is worth more than a higher salary offer elsewhere. Re-hire priority is the fastest route to a better rank and a longer contract. Officers who treat each contract as a long-term audition do better over a career than those who chase the highest short-term pay.</p>`
        }
    ];

    function loadArticleDetail() {
        const root = $('#article-detail');
        if (!root) return;
        const slug = (new URLSearchParams(window.location.search).get('slug') || '').trim();
        if (!slug) {
            root.innerHTML = '<p style="color:var(--muted)">Article not found.</p>';
            return;
        }

        const render = (article) => {
            document.title = article.title + ' — Ardson Maritime Insight';
            const h1 = document.querySelector('.page-hero h1');
            if (h1) h1.textContent = article.title;
            const lede = document.querySelector('.page-hero .lede');
            if (lede) lede.textContent = article.lede || '';
            const crumbTitle = document.querySelector('.crumb [data-crumb-title]');
            if (crumbTitle) crumbTitle.textContent = article.title;

            root.innerHTML = `
                <div class="article-meta">
                    <span class="tag">${escapeHtml(article.tag)}</span>
                    <span>${escapeHtml(article.date)} · ${escapeHtml(article.read)}</span>
                </div>
                ${article.image ? `<div class="article-media"><img src="${escapeHtml(article.image)}" alt="" loading="eager"></div>` : ''}
                <div class="prose">${article.body}</div>
            `;
        };

        const fallback = () => {
            const article = ARTICLES.find((a) => a.slug === slug);
            if (!article) {
                root.innerHTML = '<p style="color:var(--muted)">Article not found.</p>';
                return;
            }
            render(article);
        };

        fetch(API_BASE + '/insights/' + encodeURIComponent(slug), {
            signal: AbortSignal.timeout(6000)
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((payload) => {
                const data = payload && payload.data;
                if (!data || data.status !== 'published') return fallback();
                render({
                    title: data.title,
                    tag: data.tag,
                    date: data.date,
                    read: data.read,
                    image: data.image,
                    lede: data.lede,
                    body: data.body
                });
            })
            .catch(fallback);
    }

    /* ------------------------------------------------------------
       Reveal (safe on every page, no-op if no .reveal)
       ------------------------------------------------------------ */
    function initReveal() {
        const reveals = $$('.reveal');
        if (!reveals.length) return;
        if (!('IntersectionObserver' in window)) {
            reveals.forEach((el) => el.classList.add('is-visible'));
            return;
        }
        const obs = new IntersectionObserver((entries, o) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add('is-visible');
                    o.unobserve(e.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        reveals.forEach((el) => obs.observe(el));
    }

    /* ------------------------------------------------------------
       Seafarer profile (local draft; the API has no auth yet)
       ------------------------------------------------------------ */
    const PROFILE_KEY = 'ardson_profile';

    function readProfile() {
        try {
            return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
        } catch (_e) {
            return {};
        }
    }

    function writeProfile(data) {
        try { localStorage.setItem(PROFILE_KEY, JSON.stringify(data)); } catch (_e) { /* private mode */ }
    }

    function initProfile() {
        const form = $('#profile-form');
        if (!form) return;
        const data = readProfile();

        const fields = ['name', 'email', 'phone', 'applied_rank', 'vessel_experience', 'sea_service_months'];
        fields.forEach((key) => {
            const input = form.elements[key];
            if (input && data[key] != null) input.value = data[key];
        });
        const certs = Array.isArray(data.cert) ? data.cert : [];
        $$('input[name="cert"]', form).forEach((box) => { box.checked = certs.includes(box.value); });

        const renderSummary = () => {
            const name = $('#profile-name') ? $('#profile-name').value.trim() : '';
            const initial = $('#profile-initial') ? $('#profile-initial') : $('[data-profile-initial]');
            if (initial) initial.textContent = (name || 'S').charAt(0).toUpperCase();

            const filled = fields.filter((key) => form.elements[key] && String(form.elements[key].value).trim() !== '').length;
            const checked = $$('input[name="cert"]:checked', form).length;
            const pct = Math.min(100, Math.round(((filled / fields.length) * 70) + ((checked / 6) * 30)));

            const set = (sel, value) => { const el = $(sel); if (el) el.textContent = value; };
            set('[data-profile-ref]', data.reference || (name ? 'Draft · local' : '—'));
            set('[data-profile-status]', pct >= 90 ? 'Ready for matching' : pct >= 50 ? 'In progress' : 'Incomplete');
            set('[data-profile-complete]', pct + '%');
            set('[data-profile-updated]', data.updated_at ? new Date(data.updated_at).toLocaleDateString('en-GB') : '—');
        };

        form.addEventListener('input', renderSummary);
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const payload = {};
            fields.forEach((key) => {
                const input = form.elements[key];
                if (input) payload[key] = input.value.trim();
            });
            payload.cert = $$('input[name="cert"]:checked', form).map((b) => b.value);
            payload.reference = data.reference || '';
            payload.updated_at = new Date().toISOString();
            writeProfile(payload);
            Object.assign(data, payload);

            const toast = document.getElementById('toast-container');
            if (toast && window.ARDON_TOAST) window.ARDON_TOAST('Profile saved on this device.', 'success');
            else if (toast) {
                const el = document.createElement('div');
                el.className = 'toast-item toast-item--success';
                el.setAttribute('role', 'status');
                el.innerHTML = '<span class="toast-item__msg">Profile saved on this device.</span>';
                toast.appendChild(el);
                setTimeout(() => el.remove(), 3600);
            }
            renderSummary();
        });

        renderSummary();
    }

    /* ------------------------------------------------------------
       Maritime Insight listing — pulls published articles from the
       API so the admin console controls what appears here.
       ------------------------------------------------------------ */
    function loadInsightList() {
        const grid = $('[data-insights-grid]');
        if (!grid) return;

        const formatDate = (iso) => {
            const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
            if (Number.isNaN(d.getTime())) return iso || '';
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        };

        fetch(API_BASE + '/insights', { signal: AbortSignal.timeout(6000) })
            .then((res) => (res.ok ? res.json() : null))
            .then((payload) => {
                const list = (payload && payload.data) || [];
                if (!list.length) return; // keep the static fallback cards

                grid.innerHTML = list.map((article) => `
                    <article class="insight reveal">
                        ${article.image ? `<div class="insight__media"><img src="${escapeHtml(article.image)}" alt="" loading="lazy"></div>` : ''}
                        <div class="insight__body">
                            <div class="insight__meta">
                                <span>${escapeHtml(article.tag)}</span>
                                <span>${escapeHtml(formatDate(article.date))} · ${escapeHtml(article.read)}</span>
                            </div>
                            <h3>${escapeHtml(article.title)}</h3>
                            <p>${escapeHtml(article.lede)}</p>
                            <a href="insight.html?slug=${encodeURIComponent(article.slug)}" class="link-arrow">
                                Read article
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>
                            </a>
                        </div>
                    </article>
                `).join('');

                $$('.reveal', grid).forEach((el) => el.classList.add('is-visible'));
            })
            .catch(() => { /* keep the static fallback cards */ });
    }

    function init() {
        markActiveNav();
        initReveal();
        loadJobDetail();
        loadArticleDetail();
        loadInsightList();
        initProfile();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
