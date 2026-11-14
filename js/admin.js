/* ============================================================
   Ardson Maritime — Admin Console
   Vanilla ES6, IIFE. Talks to /api/v1/admin/* with a Bearer token.
   ============================================================ */
(() => {
    'use strict';

    const CFG = window.ARDSON_ADMIN_CONFIG || { apiBase: '/api/v1/admin', login: 'login.html' };
    const API = (CFG.apiBase || '/api/v1/admin').replace(/\/$/, '');
    const TOKEN_KEY = 'ardson_admin_token';

    const getToken = () => sessionStorage.getItem(TOKEN_KEY)
        || window.ARDSON_ADMIN_TOKEN
        || '';
    const setToken = (t) => { sessionStorage.setItem(TOKEN_KEY, t); };
    const clearToken = () => { sessionStorage.removeItem(TOKEN_KEY); };

    /* ------------------------------------------------------------
       State
       ------------------------------------------------------------ */
    const state = {
        jobs: [],
        seafarers: [],
        requests: [],
        contacts: [],
        subscribers: [],
        settings: null,
        users: [],
        roles: [],
        permissions: [],
        backups: [],
        logs: [],
        logSummary: { info: 0, warning: 0, error: 0 },
        logLevel: 'all',
        filters: {
            jobs: '', seafarers: '', requests: '', insights: '',
            status: '', category: '', insightStatus: '',
            seafarerStatus: '', requestStatus: '', messageStatus: 'all'
        },
        editingJobId: null,
        editingInsightId: null,
        editingSlideId: null,
        insights: [],
        heroSlides: []
    };

    /* ------------------------------------------------------------
       Utilities
       ------------------------------------------------------------ */
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const escapeHtml = (str) => String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    /** Rich text previews must never execute markup from stored data. */
    const sanitizeHtml = (html) => (
        window.ArdsonSanitize ? window.ArdsonSanitize.html(html) : escapeHtml(html)
    );

    const money = (min, max) => {
        if (min == null && max == null) return '<span style="color:var(--muted)">Negotiable</span>';
        const fmt = (n) => Number(n).toLocaleString('en-US');
        if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
        return fmt(min ?? max);
    };

    const formatDate = (iso) => {
        if (!iso) return '<span style="color:var(--muted)">—</span>';
        const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
        if (Number.isNaN(d.getTime())) return escapeHtml(iso);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const statusBadge = (status) => {
        const map = {
            open: 'badge--open',
            filled: 'badge--filled',
            closed: 'badge--muted',
            pending_verification: 'badge--pending',
            received: 'badge--unread',
            unread: 'badge--unread',
            read: 'badge--read',
            emergency: 'badge--unread'
        };
        const cls = map[status] || 'badge--muted';
        const label = String(status || 'unknown').replace(/_/g, ' ');
        return `<span class="badge ${cls}"><span class="badge__dot"></span>${escapeHtml(label)}</span>`;
    };

    function showToast(message, variant = 'info', duration = 4200) {
        const container = $('#toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast-item toast-item--${variant}`;
        el.setAttribute('role', variant === 'error' ? 'alert' : 'status');
        el.innerHTML = `
            <span class="toast-item__msg">${escapeHtml(message)}</span>
            <button type="button" class="toast-item__close" aria-label="Dismiss notification">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
            </button>`;
        const remove = () => {
            el.classList.add('is-leaving');
            setTimeout(() => el.remove(), 320);
        };
        el.querySelector('.toast-item__close').addEventListener('click', remove);
        container.appendChild(el);
        if (duration) setTimeout(remove, duration);
    }

    /* ------------------------------------------------------------
       API
       ------------------------------------------------------------ */
    async function api(path, { method = 'GET', body = null } = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
            const opts = { method, signal: controller.signal, headers: { Authorization: `Bearer ${getToken()}` } };
            if (body) {
                opts.headers['Content-Type'] = 'application/json';
                opts.body = JSON.stringify(body);
            }
            const res = await fetch(`${API}${path}`, opts);
            const data = await res.json().catch(() => ({}));
            if (res.status === 401 && path !== '/login') {
                clearToken();
                showToast('Session expired. Redirecting to sign in…', 'error');
                setTimeout(() => window.location.replace(CFG.login || 'login.html'), 1200);
            }
            return { ok: res.ok, status: res.status, data };
        } catch (err) {
            if (err.name === 'AbortError') {
                return { ok: false, status: 0, data: { message: 'Request timed out. Please try again.' } };
            }
            return { ok: false, status: 0, data: { message: 'Could not reach the API. Please check the connection.' } };
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * CVs are personal data, so the API requires an Authorization header.
     * A plain <a href> cannot send one (and putting the token in the URL
     * would leak it into history/logs), so fetch the file as a blob and
     * hand it to the browser as a download.
     */
    async function downloadCv(id) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
            const res = await fetch(`${API}/seafarers/${encodeURIComponent(id)}/cv`, {
                headers: { Authorization: `Bearer ${getToken()}` },
                signal: controller.signal
            });
            if (res.status === 401) {
                clearToken();
                showToast('Session expired. Redirecting to sign in…', 'error');
                setTimeout(() => window.location.replace(CFG.login || 'login.html'), 1200);
                return;
            }
            if (!res.ok) {
                showToast('Could not download that CV.', 'error');
                return;
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = /filename="?([^";]+)"?/i.exec(disposition);
            const filename = match ? match[1] : `CV-${id}`;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            const message = err.name === 'AbortError'
                ? 'The download timed out. Please try again.'
                : 'Could not reach the API. Please check the connection.';
            showToast(message, 'error');
        } finally {
            clearTimeout(timer);
        }
    }

    /* ------------------------------------------------------------
       Views
       ------------------------------------------------------------ */
    function switchView(name) {
        $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
        $$('[data-view]').forEach((link) => link.classList.toggle('is-active', link.dataset.view === name));
        window.location.hash = name;
        loadView(name);
    }

    function loadView(name) {
        switch (name) {
            case 'dashboard': return loadDashboard();
            case 'jobs': return loadJobs();
            case 'seafarers': return loadSeafarers();
            case 'requests': return loadRequests();
            case 'contacts': return loadContacts();
            case 'subscribers': return loadSubscribers();
            case 'settings': return loadSettings();
            case 'insights': return loadInsights();
            case 'users': return loadUsers();
            case 'roles': return loadRoles();
            case 'backups': return loadBackups();
            case 'logs': return loadLogs();
            default: return loadDashboard();
        }
    }

    /* ------------------------------------------------------------
       Dashboard
       ------------------------------------------------------------ */
    async function loadDashboard() {
        const { ok, data } = await api('/stats');
        if (!ok || !data?.data) {
            showToast(data?.message || 'Could not load dashboard.', 'error');
            return;
        }
        const stats = data.data.stats;
        $$('[data-metric]').forEach((el) => { el.textContent = String(stats[el.dataset.metric] ?? 0); });
        const totalHint = $('[data-metric-hint="totalJobs"]');
        if (totalHint) totalHint.textContent = `${stats.totalJobs} total published`;
        const openHint = $('[data-metric-hint="openRequests"]');
        if (openHint) openHint.textContent = String(stats.openRequests ?? stats.crewRequests ?? 0);
        $$('[data-health]').forEach((el) => { el.textContent = String(stats[el.dataset.health] ?? 0); });
        updateNavCounts(stats);

        const seaList = $('[data-recent="seafarers"]');
        const reqList = $('[data-recent="requests"]');
        const jobList = $('[data-recent="jobs"]');
        if (seaList) {
            const items = data.data.recentSeafarers || [];
            seaList.innerHTML = items.length
                ? items.map((s) => `
                    <div class="mini-item">
                        <div>
                            <strong>${escapeHtml(s.name || 'Unknown')}</strong>
                            <span class="sub">${escapeHtml(s.rank || s.applied_rank || '—')}</span>
                        </div>
                        <span class="mini-item__meta">${escapeHtml(s.reference || '')}</span>
                    </div>`).join('')
                : '<div class="mini-item mini-item--empty"><span>No registrations yet.</span></div>';
        }
        if (reqList) {
            const items = data.data.recentRequests || [];
            reqList.innerHTML = items.length
                ? items.map((r) => `
                    <div class="mini-item">
                        <div>
                            <strong>${escapeHtml(r.company || 'Unknown')}</strong>
                            <span class="sub">${escapeHtml(r.vessel || '—')}</span>
                        </div>
                        <span class="mini-item__meta">${statusBadge(r.status || 'new')}</span>
                    </div>`).join('')
                : '<div class="mini-item mini-item--empty"><span>No requests yet.</span></div>';
        }
        if (jobList) {
            const items = data.data.recentJobs || [];
            jobList.innerHTML = items.length
                ? items.map((j) => `
                    <div class="mini-item">
                        <div>
                            <strong>${escapeHtml(j.title || 'Untitled')}</strong>
                            <span class="sub">${escapeHtml(j.principal || '—')}</span>
                        </div>
                        <span class="mini-item__meta">${statusBadge(j.status || 'open')}</span>
                    </div>`).join('')
                : '<div class="mini-item mini-item--empty"><span>No vacancies yet.</span></div>';
        }
    }

    function updateGreeting() {
        const email = sessionStorage.getItem('ardson_admin_user') || 'admin@ardsonmaritime.com';
        const handle = String(email).split('@')[0].replace(/[._-]+/g, ' ');
        const first = handle.split(' ').filter(Boolean)[0] || 'Admin';
        const name = first.charAt(0).toUpperCase() + first.slice(1);
        $$('[data-admin-firstname]').forEach((el) => { el.textContent = name; });

        const now = new Date();
        const greeting = now.getHours() < 12 ? 'Good morning' : (now.getHours() < 18 ? 'Good afternoon' : 'Good evening');
        $$('.admin-greeting').forEach((el) => {
            const label = el.childNodes[0];
            if (label && label.nodeType === Node.TEXT_NODE) label.textContent = `${greeting}, `;
        });
        const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        $$('[data-admin-datetime]').forEach((el) => { el.textContent = `${dateStr} · ${timeStr}`; });
    }

    function startClock() {
        updateGreeting();
        setInterval(updateGreeting, 1000);
    }

    function updateNavCounts(stats) {
        const map = {
            jobs: stats.openJobs,
            seafarers: stats.seafarers,
            requests: stats.crewRequests,
            unread: stats.unreadContacts,
            subscribers: stats.subscribers,
            users: stats.users,
            errors: stats.errors,
            insights: stats.insights
        };
        Object.entries(map).forEach(([key, value]) => {
            const badge = $(`[data-nav-count="${key}"]`);
            if (!badge) return;
            badge.textContent = String(value ?? 0);
            // Zero counts read as quiet; non-zero read as active.
            badge.style.opacity = value > 0 ? '1' : '0.45';
        });
    }

    /* ------------------------------------------------------------
       Jobs
       ------------------------------------------------------------ */
    async function loadJobs() {
        const { ok, data } = await api('/jobs');
        if (!ok) return showToast(data?.message || 'Could not load vacancies.', 'error');
        state.jobs = data.data || [];
        renderJobs();
    }

    function renderJobs() {
        const tbody = $('[data-table="jobs"]');
        const empty = $('[data-table-empty="jobs"]');
        if (!tbody) return;

        const q = state.filters.jobs.toLowerCase();
        const status = state.filters.status;
        const category = state.filters.category;

        const rows = state.jobs.filter((job) => {
            if (status && job.status !== status) return false;
            if (category && job.category !== category) return false;
            if (q) {
                const hay = `${job.title} ${job.vessel_type} ${job.vessel_name || ''} ${job.principal}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        tbody.innerHTML = rows.map((job) => `
            <tr data-row-id="${escapeHtml(job.id)}" tabindex="0">
                <td>
                    <strong>${escapeHtml(job.title)}</strong>
                    <span class="sub">${escapeHtml(job.category || '')}</span>
                </td>
                <td>
                    ${escapeHtml(job.vessel_type)}
                    ${job.vessel_name ? `<span class="sub">${escapeHtml(/^mv\b/i.test(job.vessel_name) ? job.vessel_name : `MV ${job.vessel_name}`)}</span>` : ''}
                    ${job.flag_state ? `<span class="sub">Flag: ${escapeHtml(job.flag_state)}</span>` : ''}
                </td>
                <td>${escapeHtml(job.principal)}</td>
                <td>${money(job.salary_min, job.salary_max)}</td>
                <td>${formatDate(job.joining_date)}</td>
                <td>${statusBadge(job.status)}</td>
                <td>
                    <div class="cell-actions">
                        <button type="button" class="btn btn--soft btn--sm" data-edit-job="${escapeHtml(job.id)}">Edit</button>
                        <button type="button" class="btn btn--ghost btn--sm" data-toggle-status="${escapeHtml(job.id)}">${job.status === 'open' ? 'Close' : 'Reopen'}</button>
                        <button type="button" class="btn btn--ghost btn--danger btn--sm" data-delete-job="${escapeHtml(job.id)}">Delete</button>
                    </div>
                </td>
            </tr>`).join('');

        if (empty) empty.hidden = rows.length > 0;

        $$('[data-edit-job]', tbody).forEach((b) => b.addEventListener('click', () => openJobEditor(b.dataset.editJob)));
        $$('[data-toggle-status]', tbody).forEach((b) => b.addEventListener('click', () => toggleJobStatus(b.dataset.toggleStatus)));
        $$('[data-delete-job]', tbody).forEach((b) => b.addEventListener('click', () => deleteJob(b.dataset.deleteJob)));
    }

    function openJobEditor(jobId) {
        const modal = $('#job-modal');
        const form = $('#job-form');
        if (!modal || !form) return;
        state.editingJobId = jobId || null;
        form.dataset.jobId = jobId || '';

        const eyebrow = $('#job-modal-eyebrow');
        const title = $('#job-modal-title');
        if (jobId) {
            const job = state.jobs.find((j) => j.id === jobId);
            if (!job) return showToast('Vacancy not found.', 'error');
            eyebrow.textContent = 'Edit vacancy';
            title.textContent = `Update ${job.title}`;
            $('#job-title').value = job.title || '';
            $('#job-category').value = job.category || 'deck';
            $('#job-vessel-type').value = job.vessel_type || 'Container';
            $('#job-vessel-name').value = job.vessel_name || '';
            $('#job-principal').value = job.principal || '';
            $('#job-flag').value = job.flag_state || '';
            $('#job-salary-min').value = job.salary_min ?? '';
            $('#job-salary-max').value = job.salary_max ?? '';
            $('#job-joining').value = (job.joining_date || '').slice(0, 10);
            $('#job-duration').value = job.contract_duration || '';
            $('#job-status').value = job.status || 'open';
        } else {
            eyebrow.textContent = 'New vacancy';
            title.textContent = 'Publish a position';
            form.reset();
            $('#job-status').value = 'open';
        }

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        setTimeout(() => $('#job-title').focus(), 60);
    }

    function closeJobEditor() {
        const modal = $('#job-modal');
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        state.editingJobId = null;
    }

    async function submitJobForm(e) {
        e.preventDefault();
        const form = $('#job-form');
        if (!form.reportValidity()) return;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';

        // Send cleared fields as empty strings / null so edits can remove
        // values. Omitting them would make PATCH silently keep the old value.
        const optionalNumber = (sel) => {
            const raw = $(sel).value.trim();
            return raw === '' ? null : Number(raw);
        };
        const payload = {
            title: $('#job-title').value.trim(),
            category: $('#job-category').value,
            vessel_type: $('#job-vessel-type').value,
            vessel_name: $('#job-vessel-name').value.trim(),
            principal: $('#job-principal').value.trim(),
            flag_state: $('#job-flag').value.trim(),
            salary_min: optionalNumber('#job-salary-min'),
            salary_max: optionalNumber('#job-salary-max'),
            joining_date: $('#job-joining').value || null,
            contract_duration: $('#job-duration').value.trim(),
            status: $('#job-status').value
        };

        const isEdit = Boolean(state.editingJobId);
        const { ok, data } = await api(
            isEdit ? `/jobs/${encodeURIComponent(state.editingJobId)}` : '/jobs',
            { method: isEdit ? 'PATCH' : 'POST', body: payload }
        );

        if (ok) {
            closeJobEditor();
            showToast(data.message || 'Vacancy saved.', 'success');
            await loadJobs();
            await loadDashboard();
        } else {
            showToast(data?.message || 'Could not save the vacancy.', 'error');
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save vacancy';
    }

    async function toggleJobStatus(jobId) {
        const job = state.jobs.find((j) => j.id === jobId);
        if (!job) return;
        const next = job.status === 'open' ? 'closed' : 'open';
        const { ok, data } = await api(`/jobs/${encodeURIComponent(jobId)}`, { method: 'PATCH', body: { status: next } });
        if (ok) {
            showToast(`Vacancy marked as ${next}.`, 'success');
            await loadJobs();
            await loadDashboard();
        } else {
            showToast(data?.message || 'Could not update the vacancy.', 'error');
        }
    }

    async function deleteJob(jobId) {
        const job = state.jobs.find((j) => j.id === jobId);
        if (!job) return;
        if (!window.confirm(`Delete "${job.title}"? This action cannot be undone.`)) return;
        const { ok, data } = await api(`/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
        if (ok) {
            showToast('Vacancy removed.', 'success');
            await loadJobs();
            await loadDashboard();
        } else {
            showToast(data?.message || 'Could not delete the vacancy.', 'error');
        }
    }

    /* ------------------------------------------------------------
       Maritime Insight articles
       ------------------------------------------------------------ */
    async function loadInsights() {
        const { ok, data } = await api('/insights');
        if (!ok) return showToast(data?.message || 'Could not load articles.', 'error');
        state.insights = data.data || [];
        renderInsights();
    }

    function renderInsights() {
        const tbody = $('[data-table="insights"]');
        const empty = $('[data-table-empty="insights"]');
        if (!tbody) return;

        const q = (state.filters.insights || '').toLowerCase();
        const status = state.filters.insightStatus || '';

        const rows = state.insights.filter((article) => {
            if (status && article.status !== status) return false;
            if (q) {
                const hay = `${article.title} ${article.tag} ${article.slug}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        tbody.innerHTML = rows.map((article) => `
            <tr data-row-id="${escapeHtml(article.id)}" tabindex="0">
                <td>
                    <strong>${escapeHtml(article.title)}</strong>
                    <span class="sub">/${escapeHtml(article.slug)}</span>
                </td>
                <td>${escapeHtml(article.tag || '')}</td>
                <td>${formatDate(article.date)}</td>
                <td>
                    <span class="badge ${article.status === 'published' ? 'badge--open' : 'badge--muted'}">
                        <span class="badge__dot"></span>${escapeHtml(article.status || 'draft')}
                    </span>
                </td>
                <td>
                    <div class="cell-actions">
                        <button type="button" class="btn btn--soft btn--sm" data-edit-insight="${escapeHtml(article.id)}">Edit</button>
                        <button type="button" class="btn btn--ghost btn--sm" data-toggle-insight="${escapeHtml(article.id)}">${article.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                        <button type="button" class="btn btn--ghost btn--danger btn--sm" data-delete-insight="${escapeHtml(article.id)}">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');

        if (empty) empty.hidden = rows.length > 0;

        $$('[data-edit-insight]', tbody).forEach((b) => b.addEventListener('click', () => openInsightEditor(b.dataset.editInsight)));
        $$('[data-toggle-insight]', tbody).forEach((b) => b.addEventListener('click', () => toggleInsightStatus(b.dataset.toggleInsight)));
        $$('[data-delete-insight]', tbody).forEach((b) => b.addEventListener('click', () => deleteInsight(b.dataset.deleteInsight)));
    }

    function openInsightEditor(id) {
        const modal = $('#insight-modal');
        const form = $('#insight-form');
        if (!modal || !form) return;
        state.editingInsightId = id || null;
        form.dataset.insightId = id || '';

        const eyebrow = $('#insight-modal-eyebrow');
        const title = $('#insight-modal-title');
        if (id) {
            const article = state.insights.find((a) => a.id === id);
            if (!article) return showToast('Article not found.', 'error');
            eyebrow.textContent = 'Edit article';
            title.textContent = article.title;
            $('#insight-title').value = article.title || '';
            $('#insight-slug').value = article.slug || '';
            $('#insight-tag').value = article.tag || '';
            $('#insight-date').value = (article.date || '').slice(0, 10);
            $('#insight-read').value = article.read || '';
            $('#insight-status').value = article.status || 'draft';
            $('#insight-image').value = article.image || '';
            $('#insight-lede').value = article.lede || '';
            $('#insight-body').value = article.body || '';
        } else {
            eyebrow.textContent = 'New article';
            title.textContent = 'Write a Maritime Insight article';
            form.reset();
            $('#insight-status').value = 'draft';
            $('#insight-date').value = new Date().toISOString().slice(0, 10);
        }

        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        setTimeout(() => $('#insight-title').focus(), 60);
    }

    function closeInsightEditor() {
        const modal = $('#insight-modal');
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        state.editingInsightId = null;
    }

    async function submitInsightForm(e) {
        e.preventDefault();
        const form = $('#insight-form');
        if (!form.reportValidity()) return;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';

        // Empty strings clear optional fields on edit. The slug keeps its
        // old value when blank because it is part of the public URL.
        const payload = {
            title: $('#insight-title').value.trim(),
            slug: $('#insight-slug').value.trim() || undefined,
            tag: $('#insight-tag').value.trim(),
            date: $('#insight-date').value,
            read: $('#insight-read').value.trim(),
            status: $('#insight-status').value,
            image: $('#insight-image').value.trim(),
            lede: $('#insight-lede').value.trim(),
            body: $('#insight-body').value
        };

        const isEdit = Boolean(state.editingInsightId);
        const { ok, data } = await api(
            isEdit ? `/insights/${encodeURIComponent(state.editingInsightId)}` : '/insights',
            { method: isEdit ? 'PATCH' : 'POST', body: payload }
        );

        if (ok) {
            closeInsightEditor();
            showToast(data.message || 'Article saved.', 'success');
            await loadInsights();
        } else {
            showToast(data?.message || 'Could not save the article.', 'error');
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save article';
    }

    async function toggleInsightStatus(id) {
        const article = state.insights.find((a) => a.id === id);
        if (!article) return;
        const next = article.status === 'published' ? 'draft' : 'published';
        const { ok, data } = await api(`/insights/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: next } });
        if (ok) {
            showToast(`Article marked as ${next}.`, 'success');
            await loadInsights();
        } else {
            showToast(data?.message || 'Could not update the article.', 'error');
        }
    }

    async function deleteInsight(id) {
        const article = state.insights.find((a) => a.id === id);
        if (!article) return;
        if (!window.confirm(`Delete "${article.title}"? This action cannot be undone.`)) return;
        const { ok, data } = await api(`/insights/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (ok) {
            showToast('Article removed.', 'success');
            await loadInsights();
        } else {
            showToast(data?.message || 'Could not delete the article.', 'error');
        }
    }

    /* ------------------------------------------------------------
       Seafarers
       ------------------------------------------------------------ */
    async function loadSeafarers() {
        const { ok, data } = await api('/seafarers');
        if (!ok) return showToast(data?.message || 'Could not load seafarers.', 'error');
        state.seafarers = data.data || [];
        renderSeafarers();
    }

    const SEAFARER_STATUSES = ['new', 'screening', 'verified', 'proposed', 'rejected'];

    function renderSeafarers() {
        const tbody = $('[data-table="seafarers"]');
        const empty = $('[data-table-empty="seafarers"]');
        if (!tbody) return;
        const q = state.filters.seafarers.toLowerCase();
        const status = state.filters.seafarerStatus;
        const rows = state.seafarers.filter((s) => {
            if (status && s.status !== status) return false;
            if (!q) return true;
            const hay = `${s.name} ${s.email} ${s.phone || ''} ${s.applied_rank} ${s.vessel_experience || ''} ${s.reference || ''}`.toLowerCase();
            return hay.includes(q);
        });
        tbody.innerHTML = rows.map((s) => {
            const certs = Array.isArray(s.certifications) ? s.certifications : [];
            const certHtml = certs.length
                ? certs.slice(0, 4).map((c) => `<span class="cert-pill">${escapeHtml(c)}</span>`).join(' ')
                : '<span class="sub">No certificates listed</span>';
            const extra = certs.length > 4 ? `<span class="cert-pill cert-pill--more">+${certs.length - 4}</span>` : '';
            const cvLink = s.cv_file
                ? `<button type="button" class="btn btn--soft btn--sm" data-cv-download="${escapeHtml(s.id)}">CV</button>`
                : '';
            const statusOptions = SEAFARER_STATUSES.map((st) =>
                `<option value="${st}"${st === s.status ? ' selected' : ''}>${st[0].toUpperCase() + st.slice(1)}</option>`).join('');
            return `
            <tr data-row-id="${escapeHtml(s.id)}" tabindex="0">
                <td><strong>${escapeHtml(s.reference || '—')}</strong></td>
                <td>
                    <strong>${escapeHtml(s.name)}</strong>
                    <span class="sub">${escapeHtml(s.email)}</span>
                    <span class="sub">${escapeHtml(s.phone || '')}</span>
                </td>
                <td>
                    <strong>${escapeHtml(s.applied_rank || '—')}</strong>
                    <span class="sub">${escapeHtml(s.vessel_experience || 'No vessel experience')}</span>
                </td>
                <td><div class="cell-certs">${certHtml}${extra}</div></td>
                <td>${formatDate(s.created_at)}</td>
                <td>
                    <select class="status-select status-select--${escapeHtml(s.status || 'new')}" data-seafarer-status-select="${escapeHtml(s.id)}" aria-label="Change status">
                        ${statusOptions}
                    </select>
                </td>
                <td>
                    <div class="cell-actions">
                        <button type="button" class="btn btn--soft btn--sm" data-seafarer-view="${escapeHtml(s.id)}">View</button>
                        ${cvLink}
                    </div>
                </td>
            </tr>`;
        }).join('');
        if (empty) empty.hidden = rows.length > 0;

        $$('[data-seafarer-view]', tbody).forEach((b) => b.addEventListener('click', () => openSeafarerDetail(b.dataset.seafarerView)));
        $$('[data-seafarer-status-select]', tbody).forEach((sel) => sel.addEventListener('change', async () => {
            const id = sel.dataset.seafarerStatusSelect;
            const next = sel.value;
            sel.disabled = true;
            const { ok, data } = await api(`/seafarers/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                body: { status: next }
            });
            if (ok) {
                showToast(`Seafarer marked as ${next}.`, 'success');
                await loadSeafarers();
            } else {
                showToast(data?.message || 'Could not update the seafarer.', 'error');
                sel.disabled = false;
            }
        }));
    }

    function openSeafarerDetail(id) {
        const s = state.seafarers.find((row) => String(row.id) === String(id));
        const modal = $('#seafarer-modal');
        const detail = $('[data-seafarer-detail]');
        if (!s || !modal || !detail) return;
        const certs = Array.isArray(s.certifications) ? s.certifications : [];
        const certHtml = certs.length
            ? `<div class="cell-certs">${certs.map((c) => `<span class="cert-pill">${escapeHtml(c)}</span>`).join(' ')}</div>`
            : '<p class="muted">No certificates on file.</p>';
        const cv = s.cv_file
            ? `<button type="button" class="btn btn--soft btn--sm" data-cv-download="${escapeHtml(s.id)}">Download CV</button>`
            : '<span class="muted">No CV uploaded.</span>';
        $('[data-seafarer-ref]').textContent = s.reference || 'Seafarer profile';
        $('[data-seafarer-title]').textContent = s.name || 'Seafarer';
        $('[data-seafarer-subtitle]').textContent = `${s.applied_rank || 'Rank not stated'} · ${s.vessel_experience || 'No vessel experience'}`;
        detail.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item"><span>Email</span><strong><a href="mailto:${escapeHtml(s.email || '')}">${escapeHtml(s.email || '—')}</a></strong></div>
                <div class="detail-item"><span>Phone</span><strong>${escapeHtml(s.phone || '—')}</strong></div>
                <div class="detail-item"><span>Status</span><strong>${statusBadge(s.status)}</strong></div>
                <div class="detail-item"><span>Submitted</span><strong>${formatDate(s.created_at)}</strong></div>
            </div>
            <div class="detail-block">
                <h3>Certifications</h3>
                ${certHtml}
            </div>
            <div class="detail-block">
                <h3>Documents</h3>
                ${cv}
            </div>
            <div class="detail-block">
                <h3>Screening notes</h3>
                <p class="muted">${s.notes ? escapeHtml(s.notes) : 'No notes yet.'}</p>
                ${s.screened_by ? `<p class="muted-small">${escapeHtml(s.screened_by)} · ${formatDate(s.screened_at)}</p>` : ''}
            </div>
            <div class="inline-form__actions">
                <a class="btn btn--ghost btn--sm" href="mailto:${escapeHtml(s.email || '')}">Email candidate</a>
                <button type="button" class="btn btn--ghost btn--sm" data-modal-close="seafarer-modal">Close</button>
            </div>`;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        detail.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', closeSeafarerDetail));
    }

    function closeSeafarerDetail() {
        const modal = $('#seafarer-modal');
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
    }

    /* ------------------------------------------------------------
       Generic record detail popup for every admin table
       ------------------------------------------------------------ */
    function detailItem(label, value, raw = false) {
        const empty = value == null || value === '';
        const html = empty ? '—' : (raw ? value : escapeHtml(value));
        return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${html}</strong></div>`;
    }

    function detailBlock(title, body, raw = false) {
        if (body == null || body === '') return '';
        const html = raw
            ? `<div class="record-article">${sanitizeHtml(body)}</div>`
            : `<p>${escapeHtml(body)}</p>`;
        return `<div class="detail-block"><h3>${escapeHtml(title)}</h3>${html}</div>`;
    }

    function buildRecordDetail(type, record) {
        const closeBtn = '<button type="button" class="btn btn--ghost btn--sm" data-modal-close="record-modal">Close</button>';
        const actions = (extra = '') => `<div class="inline-form__actions">${extra}${closeBtn}</div>`;

        if (type === 'jobs') {
            const vesselName = record.vessel_name
                ? (/^mv\b/i.test(record.vessel_name) ? record.vessel_name : `MV ${record.vessel_name}`)
                : '';
            const vessel = [record.vessel_type, vesselName].filter(Boolean).join(' · ');
            const salary = record.salary_min == null && record.salary_max == null
                ? 'Negotiable'
                : `${record.salary_currency || 'USD'} ${money(record.salary_min, record.salary_max)}`;
            return {
                eyebrow: 'Vacancy',
                title: record.title || 'Vacancy',
                subtitle: `${record.principal || 'Principal not stated'} · ${record.vessel_type || 'Vessel TBD'}`,
                body: `
                    <div class="detail-grid">
                        ${detailItem('Reference', record.id)}
                        ${detailItem('Department', record.category || '—')}
                        ${detailItem('Vessel', vessel || '—')}
                        ${detailItem('Principal', record.principal)}
                        ${detailItem('Flag state', record.flag_state)}
                        ${detailItem('Monthly salary', salary, true)}
                        ${detailItem('Contract', record.contract_duration)}
                        ${detailItem('Joining date', formatDate(record.joining_date), true)}
                        ${detailItem('Status', statusBadge(record.status || 'open'), true)}
                        ${detailItem('Posted', formatDate(record.posted_at), true)}
                    </div>
                    ${detailBlock('Description', record.description)}
                    ${detailBlock('Requirements', record.requirements)}
                    ${actions()}`
            };
        }

        if (type === 'insights') {
            return {
                eyebrow: 'Maritime Insight',
                title: record.title || 'Article',
                subtitle: `/${record.slug || ''} · ${record.tag || 'Uncategorised'}`,
                body: `
                    <div class="detail-grid">
                        ${detailItem('Status', statusBadge(record.status || 'draft'), true)}
                        ${detailItem('Tag', record.tag)}
                        ${detailItem('Published', formatDate(record.date), true)}
                        ${detailItem('Read time', record.read)}
                        ${detailItem('Created', formatDate(record.created_at), true)}
                    </div>
                    ${detailBlock('Summary', record.lede)}
                    ${detailBlock('Article body', record.body, true)}
                    ${actions(`<a class="btn btn--soft btn--sm" href="../insight.html?slug=${encodeURIComponent(record.slug || '')}" target="_blank" rel="noopener">Open on website</a>`)}`
            };
        }

        if (type === 'requests') {
            return {
                eyebrow: 'Crew request',
                title: record.company_name || 'Crew request',
                subtitle: `${record.reference || record.id || ''} · ${record.vessel_type || 'Vessel TBD'}`,
                body: `
                    <div class="detail-grid">
                        ${detailItem('Reference', record.reference || record.id)}
                        ${detailItem('Company', record.company_name)}
                        ${detailItem('Email', `<a href="mailto:${escapeHtml(record.email || '')}">${escapeHtml(record.email || '—')}</a>`, true)}
                        ${detailItem('Phone', record.phone)}
                        ${detailItem('Vessel type', record.vessel_type)}
                        ${detailItem('Flag state', record.flag_state)}
                        ${detailItem('Contract', record.contract_duration)}
                        ${detailItem('Target joining', formatDate(record.joining_date), true)}
                        ${detailItem('Status', statusBadge(record.status || 'new'), true)}
                        ${detailItem('Submitted', formatDate(record.created_at), true)}
                    </div>
                    ${detailBlock('Ranks required', record.required_ranks)}
                    ${detailBlock('Notes', record.notes)}
                    ${actions(`<a class="btn btn--soft btn--sm" href="mailto:${escapeHtml(record.email || '')}">Email principal</a>`)}`
            };
        }

        if (type === 'contacts') {
            return {
                eyebrow: 'Message',
                title: record.name || 'Message',
                subtitle: record.email || '',
                body: `
                    <div class="detail-grid">
                        ${detailItem('Email', `<a href="mailto:${escapeHtml(record.email || '')}">${escapeHtml(record.email || '—')}</a>`, true)}
                        ${detailItem('Status', statusBadge(record.status || 'read'), true)}
                        ${detailItem('Received', formatDate(record.created_at), true)}
                        ${detailItem('Notes', record.notes)}
                    </div>
                    ${detailBlock('Message', record.message)}
                    ${actions(`<a class="btn btn--soft btn--sm" href="mailto:${encodeURIComponent(record.email || '')}?subject=${encodeURIComponent('Re: your enquiry with Ardson Maritime')}">Reply</a>`)}`
            };
        }

        if (type === 'subscribers') {
            return {
                eyebrow: 'Newsletter subscriber',
                title: record.email || 'Subscriber',
                subtitle: 'Opted in to vacancy alerts and regulation updates.',
                body: `
                    <div class="detail-grid">
                        ${detailItem('Email', `<a href="mailto:${escapeHtml(record.email || '')}">${escapeHtml(record.email || '—')}</a>`, true)}
                        ${detailItem('Subscribed', formatDate(record.subscribed_at), true)}
                    </div>
                    ${actions(`<a class="btn btn--soft btn--sm" href="mailto:${encodeURIComponent(record.email || '')}">Email subscriber</a>`)}`
            };
        }

        if (type === 'users') {
            return {
                eyebrow: 'Console user',
                title: record.name || 'User',
                subtitle: record.email || '',
                body: `
                    <div class="detail-grid">
                        ${detailItem('Email', `<a href="mailto:${escapeHtml(record.email || '')}">${escapeHtml(record.email || '—')}</a>`, true)}
                        ${detailItem('Role', roleName(record.role))}
                        ${detailItem('Status', userStatusBadge(record.status), true)}
                        ${detailItem('Last sign-in', formatDate(record.last_login), true)}
                        ${detailItem('Created', formatDate(record.created_at), true)}
                    </div>
                    ${actions()}`
            };
        }

        if (type === 'backups') {
            const c = record.counts || {};
            return {
                eyebrow: 'Backup snapshot',
                title: record.filename || record.id || 'Backup',
                subtitle: record.id || '',
                body: `
                    <div class="detail-grid">
                        ${detailItem('File', record.filename)}
                        ${detailItem('Backup ID', record.id)}
                        ${detailItem('Size', record.size_kb != null ? `${record.size_kb} KB` : '—')}
                        ${detailItem('Created by', record.created_by)}
                        ${detailItem('Created', formatDate(record.created_at), true)}
                        ${detailItem('Status', record.status)}
                    </div>
                    ${detailBlock('Contents', `${c.jobs ?? 0} vacancies · ${c.seafarers ?? 0} seafarers · ${c.crewRequests ?? 0} crew requests · ${c.contacts ?? 0} messages · ${c.subscribers ?? 0} subscribers · ${c.insights ?? 0} articles`)}
                    ${actions()}`
            };
        }

        if (type === 'logs') {
            return {
                eyebrow: `Log · ${record.level || 'info'}`,
                title: record.action || 'Activity entry',
                subtitle: record.target || '',
                body: `
                    <div class="detail-grid">
                        ${detailItem('Level', record.level || 'info')}
                        ${detailItem('Actor', record.actor || 'system')}
                        ${detailItem('Target', record.target)}
                        ${detailItem('Time', formatDate(record.created_at), true)}
                    </div>
                    ${detailBlock('Detail', record.detail)}
                    ${actions()}`
            };
        }

        return null;
    }

    function openRecordDetail(type, id) {
        if (type === 'seafarers') {
            openSeafarerDetail(id);
            return;
        }
        const list = Array.isArray(state[type]) ? state[type] : [];
        const record = list.find((row) => String(row.id ?? row.email) === String(id));
        const modal = $('#record-modal');
        const body = $('[data-record-body]');
        if (!record || !modal || !body) return;
        const detail = buildRecordDetail(type, record);
        if (!detail) return;

        $('[data-record-eyebrow]').textContent = detail.eyebrow;
        $('[data-record-title]').textContent = detail.title;
        $('[data-record-subtitle]').textContent = detail.subtitle || '';
        body.innerHTML = detail.body;
        body.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', closeRecordDetail));
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        $('.modal__close', modal)?.focus();
    }

    function closeRecordDetail() {
        const modal = $('#record-modal');
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function rowRecordType(row) {
        if (row.classList.contains('log-row')) return 'logs';
        const tbody = row.closest('[data-table]');
        return tbody ? tbody.dataset.table : '';
    }

    function initRecordRows() {
        document.addEventListener('click', (e) => {
            const row = e.target.closest('[data-row-id]');
            if (!row) return;
            if (e.target.closest('button, a, input, select, textarea, label')) return;
            const type = rowRecordType(row);
            if (type) openRecordDetail(type, row.dataset.rowId);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const row = e.target.closest('[data-row-id]');
            if (!row || e.target !== row) return;
            const type = rowRecordType(row);
            if (!type) return;
            e.preventDefault();
            openRecordDetail(type, row.dataset.rowId);
        });
    }

    /* ------------------------------------------------------------
       Crew requests
       ------------------------------------------------------------ */
    async function loadRequests() {
        const { ok, data } = await api('/crew-requests');
        if (!ok) return showToast(data?.message || 'Could not load crew requests.', 'error');
        state.requests = data.data || [];
        renderRequests();
    }

    // `emergency` is set by the public emergency desk, so it must appear in
    // the editor and filter even though it is not a normal next step.
    const REQUEST_STATUSES = ['new', 'emergency', 'contacted', 'shortlisting', 'proposed', 'fulfilled', 'closed'];

    function renderRequests() {
        const tbody = $('[data-table="requests"]');
        const empty = $('[data-table-empty="requests"]');
        if (!tbody) return;
        const q = state.filters.requests.toLowerCase();
        const status = state.filters.requestStatus;
        const rows = state.requests.filter((r) => {
            if (status && r.status !== status) return false;
            if (!q) return true;
            const hay = `${r.company_name} ${r.email} ${r.vessel_type} ${r.required_ranks} ${r.flag_state || ''}`.toLowerCase();
            return hay.includes(q);
        });
        tbody.innerHTML = rows.map((r) => {
            const statusOptions = REQUEST_STATUSES.map((st) =>
                `<option value="${st}"${st === r.status ? ' selected' : ''}>${st[0].toUpperCase() + st.slice(1)}</option>`).join('');
            return `
            <tr data-row-id="${escapeHtml(r.id)}" tabindex="0">
                <td><strong>${escapeHtml(r.reference || '—')}</strong></td>
                <td>
                    <strong>${escapeHtml(r.company_name)}</strong>
                    <span class="sub">${escapeHtml(r.email)}</span>
                </td>
                <td>
                    <strong>${escapeHtml(r.vessel_type || '—')}</strong>
                    <span class="sub">${escapeHtml(r.contract_duration || 'Contract TBD')}</span>
                </td>
                <td><div class="cell-note">${escapeHtml(r.required_ranks)}</div></td>
                <td>${formatDate(r.joining_date)}</td>
                <td>
                    <select class="status-select status-select--${escapeHtml(r.status || 'new')}" data-request-status-select="${escapeHtml(r.id)}" aria-label="Change crew request status">
                        ${statusOptions}
                    </select>
                </td>
                <td>
                    <div class="cell-actions">
                        <button type="button" class="btn btn--soft btn--sm" data-request-to-job="${escapeHtml(r.id)}">Create vacancy</button>
                        <a class="btn btn--ghost btn--sm" href="mailto:${escapeHtml(r.email || '')}">Email</a>
                    </div>
                </td>
            </tr>`;
        }).join('');
        if (empty) empty.hidden = rows.length > 0;

        $$('[data-request-status-select]', tbody).forEach((sel) => sel.addEventListener('change', async () => {
            sel.disabled = true;
            const { ok, data } = await api(`/crew-requests/${encodeURIComponent(sel.dataset.requestStatusSelect)}`, {
                method: 'PATCH',
                body: { status: sel.value }
            });
            if (ok) {
                showToast(`Crew request moved to ${sel.value}.`, 'success');
                await loadRequests();
                await loadDashboard();
            } else {
                showToast(data?.message || 'Could not update the crew request.', 'error');
                sel.disabled = false;
            }
        }));
        $$('[data-request-to-job]', tbody).forEach((b) => b.addEventListener('click', () => {
            const r = state.requests.find((row) => String(row.id) === String(b.dataset.requestToJob));
            if (r) openJobEditorFromRequest(r);
        }));
    }

    function openJobEditorFromRequest(r) {
        openJobEditor(null);
        const form = $('#job-form');
        if (!form) return;
        $('#job-principal').value = r.company_name || '';
        const vesselMap = { container: 'Container', tanker: 'Tanker', bulk: 'Bulk', gas: 'LNG', lng: 'LNG', offshore: 'Offshore', cruise: 'Cruise' };
        const type = String(r.vessel_type || '').toLowerCase();
        const match = Object.keys(vesselMap).find((key) => type.includes(key));
        if (match) $('#job-vessel-type').value = vesselMap[match];
        $('#job-flag').value = r.flag_state === 'TBD' ? '' : (r.flag_state || '');
        $('#job-duration').value = r.contract_duration && r.contract_duration !== 'TBD' ? r.contract_duration : '';
        $('#job-joining').value = (r.joining_date || '').slice(0, 10);
        showToast('Vacancy editor pre-filled from the crew request.', 'info', 2600);
    }

    /* ------------------------------------------------------------
       Contacts
       ------------------------------------------------------------ */
    async function loadContacts() {
        const { ok, data } = await api('/contacts');
        if (!ok) return showToast(data?.message || 'Could not load messages.', 'error');
        state.contacts = data.data || [];
        renderContacts();
    }

    function renderContacts() {
        const tbody = $('[data-table="contacts"]');
        const empty = $('[data-table-empty="contacts"]');
        if (!tbody) return;
        const filter = state.filters.messageStatus || 'all';
        const rows = state.contacts.filter((c) => filter === 'all' || c.status === filter);
        tbody.innerHTML = rows.map((c) => {
            const replyHref = `mailto:${encodeURIComponent(c.email || '')}?subject=${encodeURIComponent('Re: your enquiry with Ardson Maritime')}`;
            return `
            <tr class="message-row${c.status === 'unread' ? ' message-row--unread' : ''}" data-row-id="${escapeHtml(c.id)}" tabindex="0">
                <td>
                    <strong>${escapeHtml(c.name)}</strong>
                    <span class="sub">${escapeHtml(c.email)}</span>
                </td>
                <td><div class="cell-note">${escapeHtml(c.message)}</div></td>
                <td>${formatDate(c.created_at)}</td>
                <td>
                    <select class="status-select status-select--${escapeHtml(c.status || 'read')}" data-message-status="${escapeHtml(c.id)}" aria-label="Change message status">
                        ${['unread', 'read', 'replied', 'archived'].map((st) => `<option value="${st}"${st === c.status ? ' selected' : ''}>${st[0].toUpperCase() + st.slice(1)}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <div class="cell-actions">
                        <a class="btn btn--soft btn--sm" href="${replyHref}">Reply</a>
                    </div>
                </td>
            </tr>`;
        }).join('');
        if (empty) empty.hidden = rows.length > 0;

        $$('[data-message-status]', tbody).forEach((sel) => sel.addEventListener('change', async () => {
            sel.disabled = true;
            const { ok, data } = await api(`/contacts/${encodeURIComponent(sel.dataset.messageStatus)}`, {
                method: 'PATCH',
                body: { status: sel.value }
            });
            if (ok) {
                showToast(`Message marked as ${sel.value}.`, 'success', 2400);
                await loadContacts();
                await loadDashboard();
            } else {
                showToast(data?.message || 'Could not update the message.', 'error');
                sel.disabled = false;
            }
        }));
    }

    /* ------------------------------------------------------------
       Subscribers
       ------------------------------------------------------------ */
    async function loadSubscribers() {
        const { ok, data } = await api('/subscribers');
        if (!ok) return showToast(data?.message || 'Could not load subscribers.', 'error');
        state.subscribers = data.data || [];
        renderSubscribers();
    }

    function renderSubscribers() {
        const tbody = $('[data-table="subscribers"]');
        const empty = $('[data-table-empty="subscribers"]');
        if (!tbody) return;
        tbody.innerHTML = state.subscribers.map((s) => `
            <tr data-row-id="${escapeHtml(s.email)}" tabindex="0">
                <td><strong>${escapeHtml(s.email)}</strong></td>
                <td>${formatDate(s.subscribed_at)}</td>
                <td><div class="cell-actions"><a href="mailto:${encodeURIComponent(s.email)}" class="btn btn--soft btn--sm">Email</a></div></td>
            </tr>`).join('');
        if (empty) empty.hidden = state.subscribers.length > 0;

        const countEl = $('[data-subscriber-count]');
        if (countEl) countEl.textContent = String(state.subscribers.length);
        const latestEl = $('[data-subscriber-latest]');
        if (latestEl) {
            const dates = state.subscribers.map((s) => s.subscribed_at).filter(Boolean).sort();
            latestEl.textContent = dates.length ? formatDate(dates[dates.length - 1]) : '—';
        }
    }

    /* ------------------------------------------------------------
       Site settings
       ------------------------------------------------------------ */
    const getPath = (obj, path) => path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
    const setPath = (obj, path, value) => {
        const keys = path.split('.');
        const last = keys.pop();
        const target = keys.reduce((acc, key) => {
            if (acc[key] == null || typeof acc[key] !== 'object') acc[key] = {};
            return acc[key];
        }, obj);
        target[last] = value;
    };

    async function loadSettings() {
        const { ok, data } = await api('/settings');
        if (!ok || !data?.data) {
            return showToast(data?.message || 'Could not load settings.', 'error');
        }
        state.settings = data.data;
        fillSettingsForm('site', data.data.site);
        fillSettingsForm('hero', data.data.hero);
        initPageEditor();
        initBlocksEditor();
        await loadHeroSlides();
    }

    /** Select fields that hold 0/1 flags rather than free text. */
    const FLAG_SELECTS = new Set(['autoplay', 'pause_on_hover', 'show_dots', 'show_arrows', 'enabled']);

    function fillSettingsForm(section, values) {
        const form = $(`[data-settings-form="${section}"]`);
        if (!form) return;
        Array.from(form.elements).forEach((el) => {
            if (!el.name) return;
            const value = getPath(values || {}, el.name);
            if (el.type === 'checkbox') {
                el.checked = value === true || value === '1' || value === 1;
                return;
            }
            // Boolean flags coming back as true/false need to match the
            // <option value="1"> / <option value="0"> pairs used for toggles.
            if (el.tagName === 'SELECT' && FLAG_SELECTS.has(el.name) && typeof value === 'boolean') {
                el.value = value ? '1' : '0';
                return;
            }
            el.value = value == null ? '' : String(value);
        });
    }

    function collectSettingsForm(section) {
        const form = $(`[data-settings-form="${section}"]`);
        const payload = {};
        if (!form) return payload;
        Array.from(form.elements).forEach((el) => {
            if (!el.name) return;
            if (el.type === 'checkbox') {
                payload[el.name] = el.checked ? 1 : 0;
                return;
            }
            if (el.tagName === 'SELECT' && FLAG_SELECTS.has(el.name)) {
                payload[el.name] = el.value === '1' ? 1 : 0;
                return;
            }
            const raw = el.value.trim();
            if (el.type === 'number') {
                if (raw !== '') setPath(payload, el.name, Number(raw));
                return;
            }
            setPath(payload, el.name, raw);
        });
        return payload;
    }

    async function saveSettings(e) {
        e.preventDefault();
        const form = e.currentTarget;
        const section = form.dataset.settingsForm;
        const btn = form.querySelector('button[type="submit"]');
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Saving…';

        const body = section === 'pages'
            ? { [($('[data-page-select]') || {}).value]: collectPagePayload() }
            : section === 'blocks'
                ? collectBlockPayload()
                : collectSettingsForm(section);

        const { ok, data } = await api(`/settings/${section}`, { method: 'PATCH', body });
        if (ok) {
            state.settings = data.data;
            showToast(data.message || 'Settings saved.', 'success');
            if (section === 'pages') pageStatus('Custom override active.');
            if (section === 'blocks') renderBlockEditor();
            await loadDashboard();
        } else {
            showToast(data?.message || 'Could not save settings.', 'error');
        }
        btn.disabled = false;
        btn.textContent = original;
    }

    async function resetSettings(section) {
        if (!window.confirm(`Restore default ${section} settings? Current values will be replaced.`)) return;
        const { ok, data } = await api(`/settings/${section}/reset`, { method: 'POST' });
        if (ok) {
            state.settings = data.data;
            fillSettingsForm('site', data.data.site);
            fillSettingsForm('hero', data.data.hero);
            await loadHeroSlides();
            showToast('Defaults restored.', 'success');
        } else {
            showToast(data?.message || 'Could not reset settings.', 'error');
        }
    }

    /* ------------------------------------------------------------
       Settings → Pages
       ------------------------------------------------------------ */

    const PAGE_EDITOR_PAGES = [
        { slug: 'index', label: 'Home (meta only)' },
        { slug: 'jobs', label: 'Open vacancies' },
        { slug: 'seafarers', label: 'For seafarers' },
        { slug: 'principals', label: 'For principals' },
        { slug: 'emergency', label: 'Emergency replacement' },
        { slug: 'training', label: 'Training' },
        { slug: 'insights', label: 'Maritime Insight' },
        { slug: 'about', label: 'About' },
        { slug: 'contact', label: 'Contact' },
        { slug: 'privacy', label: 'Privacy policy', legal: true },
        { slug: 'terms', label: 'Terms of service', legal: true },
        { slug: 'mlc-compliance', label: 'MLC compliance', legal: true }
    ];

    let pageEditorReady = false;

    function initPageEditor() {
        const select = $('[data-page-select]');
        if (!select) return;
        select.innerHTML = PAGE_EDITOR_PAGES
            .map((page) => `<option value="${page.slug}">${escapeHtml(page.label)}</option>`)
            .join('');
        if (pageEditorReady) return;
        pageEditorReady = true;
        select.addEventListener('change', () => loadPageEditor());
        $$('[data-page-load]').forEach((btn) => btn.addEventListener('click', () => seedPageEditor(select.value, true)));
        const clear = $('[data-page-clear]');
        if (clear) clear.addEventListener('click', clearPageOverride);
        loadPageEditor();
    }

    function pageStatus(text) {
        const el = $('[data-page-status]');
        if (el) el.textContent = text;
    }

    function fillPageFields(values) {
        $$('[data-page-field]').forEach((el) => {
            const value = values[el.dataset.pageField];
            el.value = value == null ? '' : String(value);
        });
    }

    function collectPagePayload() {
        const payload = {};
        $$('[data-page-field]').forEach((el) => {
            const value = el.value;
            payload[el.dataset.pageField] = el.dataset.pageField === 'body' ? value.trim() : value.trim();
        });
        return payload;
    }

    function loadPageEditor() {
        const select = $('[data-page-select]');
        if (!select) return;
        const slug = select.value;
        const saved = state.settings?.pages?.[slug];
        const meta = PAGE_EDITOR_PAGES.find((page) => page.slug === slug);
        const isHome = slug === 'index';
        ['eyebrow', 'heading', 'lede'].forEach((name) => {
            const field = $(`[data-page-field="${name}"]`);
            if (field && field.closest('.field')) field.closest('.field').hidden = isHome;
        });
        const bodyField = $('[data-page-field="body"]');
        if (bodyField && bodyField.closest('.field')) bodyField.closest('.field').hidden = !meta?.legal;
        if (saved) {
            fillPageFields(saved);
            pageStatus('Custom override active.');
            return;
        }
        fillPageFields({});
        pageStatus('No override saved — loading the live page copy…');
        seedPageEditor(slug, false);
    }

    async function seedPageEditor(slug, announce) {
        try {
            const res = await fetch(`../${slug}.html`, { cache: 'no-store' });
            if (!res.ok) throw new Error('not found');
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const hero = doc.querySelector('.page-hero');
            const lede = hero && (hero.querySelector('.lede') || hero.querySelector('.hero__lede'));
            const values = {
                title: (doc.querySelector('title')?.textContent || '').trim(),
                description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
                eyebrow: hero?.querySelector('.eyebrow')?.textContent.trim() || '',
                heading: hero?.querySelector('h1')?.textContent.trim() || '',
                lede: lede ? lede.textContent.replace(/\s+/g, ' ').trim() : '',
                body: doc.querySelector('[data-legal-body]')?.innerHTML.trim() || ''
            };
            const select = $('[data-page-select]');
            if (!select || select.value !== slug) return;
            if (state.settings?.pages?.[slug]) return;
            fillPageFields(values);
            pageStatus(announce ? 'Loaded live page copy. Save to override it.' : 'No override saved. Fields show the live page copy.');
        } catch (_err) {
            pageStatus('No override saved. Could not read the live page; fill in the fields you need.');
        }
    }

    async function clearPageOverride() {
        const select = $('[data-page-select]');
        if (!select) return;
        const slug = select.value;
        if (!window.confirm('Remove the saved override and show the built-in page copy again?')) return;
        const { ok, data } = await api('/settings/pages', { method: 'PATCH', body: { [slug]: null } });
        if (!ok) return showToast(data?.message || 'Could not clear the override.', 'error');
        state.settings = data.data;
        showToast('Override cleared.', 'success');
        await loadPageEditor();
    }

    /* ------------------------------------------------------------
       Settings → Content blocks
       ------------------------------------------------------------ */

    const BLOCK_SCHEMA = {
        audience: {
            fields: [['eyebrow', 'Eyebrow'], ['title', 'Title'], ['lede', 'Intro', 'textarea']],
            itemLabel: 'Audience card',
            items: [
                ['key', 'Anchor ID (seafarers / principals)'],
                ['tag', 'Tag'],
                ['title', 'Title'],
                ['text', 'Text', 'textarea'],
                ['image', 'Image URL'],
                ['bullets', 'Bullets — one per line', 'lines'],
                ['primary_label', 'Primary button label'],
                ['secondary_label', 'Secondary link label'],
                ['secondary_href', 'Secondary link URL']
            ]
        },
        trust: {
            fields: [['eyebrow', 'Eyebrow'], ['title', 'Title']],
            itemLabel: 'Trust point',
            items: [['title', 'Title'], ['text', 'Text', 'textarea']]
        },
        training: {
            fields: [
                ['eyebrow', 'Eyebrow'], ['title', 'Title'], ['lede', 'Intro', 'textarea'],
                ['link_label', 'Header link label'], ['link_href', 'Header link URL']
            ],
            itemLabel: 'Programme',
            items: [
                ['num', 'Number'], ['title', 'Title'], ['text', 'Text', 'textarea'],
                ['link_label', 'Link label'], ['link_href', 'Link URL']
            ]
        },
        faq: {
            fields: [['eyebrow', 'Eyebrow'], ['title', 'Title']],
            itemLabel: 'Question',
            items: [['title', 'Question'], ['text', 'Answer', 'textarea']]
        },
        stepsSeafarers: {
            fields: [['eyebrow', 'Eyebrow'], ['title', 'Title'], ['lede', 'Intro', 'textarea']],
            itemLabel: 'Step',
            items: [['title', 'Title'], ['text', 'Text', 'textarea']]
        },
        stepsPrincipals: {
            fields: [['eyebrow', 'Eyebrow'], ['title', 'Title'], ['lede', 'Intro', 'textarea']],
            itemLabel: 'Step',
            items: [['title', 'Title'], ['text', 'Text', 'textarea']]
        },
        stepsEmergency: {
            fields: [['eyebrow', 'Eyebrow'], ['title', 'Title'], ['lede', 'Intro', 'textarea']],
            itemLabel: 'Step',
            items: [['title', 'Title'], ['text', 'Text', 'textarea']]
        }
    };

    let blocksEditorReady = false;

    function blockField(name, label, value, type) {
        const wide = type === 'textarea' || type === 'lines';
        const style = wide ? ' style="grid-column:1/-1"' : '';
        if (wide) {
            const text = type === 'lines'
                ? (Array.isArray(value) ? value.join('\n') : (value || ''))
                : (value || '');
            return `<div class="field"${style}><label>${escapeHtml(label)}</label>
                <textarea rows="${type === 'lines' ? 4 : 3}" data-block-field="${name}" data-block-type="${type}">${escapeHtml(text)}</textarea></div>`;
        }
        return `<div class="field"${style}><label>${escapeHtml(label)}</label>
            <input data-block-field="${name}" value="${escapeHtml(value == null ? '' : value)}"></div>`;
    }

    function blockItemHtml(schema, item) {
        item = item || {};
        return `<div class="panel" style="margin-top:1rem" data-block-item>
            <div class="panel__head">
                <div><h3>${escapeHtml(schema.itemLabel)}</h3></div>
                <button type="button" class="btn btn--ghost btn--sm" data-block-remove>Remove</button>
            </div>
            <div class="panel__body">
                <div class="form-grid form-grid--2">
                    ${schema.items.map(([name, label, type]) => blockField(name, label, item[name], type)).join('')}
                </div>
            </div>
        </div>`;
    }

    function renderBlockEditor() {
        const select = $('[data-block-select]');
        const root = $('[data-block-editor]');
        if (!select || !root) return;
        const key = select.value;
        const schema = BLOCK_SCHEMA[key];
        if (!schema) return;
        const data = state.settings?.blocks?.[key] || {};
        const items = Array.isArray(data.items) ? data.items : [];
        root.innerHTML = `
            <div class="form-grid form-grid--2" data-block-head>
                ${schema.fields.map(([name, label, type]) => blockField(name, label, data[name], type)).join('')}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:1.5rem">
                <h3>${escapeHtml(schema.itemLabel)}s</h3>
                <button type="button" class="btn btn--ghost btn--sm" data-block-add>Add ${escapeHtml(schema.itemLabel.toLowerCase())}</button>
            </div>
            <div data-block-items>
                ${items.map((item) => blockItemHtml(schema, item)).join('')}
            </div>
            <div class="table-empty" data-block-empty ${items.length ? 'hidden' : ''}>No entries yet. Add one above.</div>`;
    }

    function collectBlockPayload() {
        const select = $('[data-block-select]');
        const root = $('[data-block-editor]');
        const schema = BLOCK_SCHEMA[select?.value];
        if (!schema || !root) return {};
        const block = {};
        $$('[data-block-head] [data-block-field]').forEach((el) => {
            block[el.dataset.blockField] = el.value.trim();
        });
        block.items = $$('[data-block-item]', root).map((item) => {
            const row = {};
            $$('[data-block-field]', item).forEach((el) => {
                row[el.dataset.blockField] = el.dataset.blockType === 'lines'
                    ? el.value.split('\n').map((line) => line.trim()).filter(Boolean)
                    : el.value.trim();
            });
            return row;
        });
        return { [select.value]: block };
    }

    function initBlocksEditor() {
        const select = $('[data-block-select]');
        const root = $('[data-block-editor]');
        if (!select || !root) return;
        if (!blocksEditorReady) {
            blocksEditorReady = true;
            select.addEventListener('change', renderBlockEditor);
            root.addEventListener('click', (ev) => {
                const add = ev.target.closest('[data-block-add]');
                if (add) {
                    const schema = BLOCK_SCHEMA[select.value];
                    const holder = $('[data-block-items]', root);
                    const empty = $('[data-block-empty]', root);
                    if (holder) holder.insertAdjacentHTML('beforeend', blockItemHtml(schema, {}));
                    if (empty) empty.hidden = true;
                    return;
                }
                const remove = ev.target.closest('[data-block-remove]');
                if (remove) {
                    const card = remove.closest('[data-block-item]');
                    if (card) card.remove();
                    const empty = $('[data-block-empty]', root);
                    if (empty) empty.hidden = $$('[data-block-item]', root).length > 0;
                }
            });
            const reset = $('[data-block-reset]');
            if (reset) reset.addEventListener('click', resetBlockSection);
        }
        renderBlockEditor();
    }

    async function resetBlockSection() {
        const select = $('[data-block-select]');
        if (!select) return;
        if (!window.confirm('Restore the default content for this section?')) return;
        const { ok, data } = await api(`/settings/blocks/${select.value}/reset`, { method: 'POST' });
        if (!ok) return showToast(data?.message || 'Could not reset this section.', 'error');
        state.settings = data.data;
        renderBlockEditor();
        showToast('Section restored.', 'success');
    }

    /** Which settings forms belong to each tab. */
    const SETTINGS_TAB_FORMS = {
        site: ['site'],
        hero: ['hero'],
        pages: ['pages'],
        blocks: ['blocks']
    };

    function initSettingsTabs() {
        $$('[data-settings-tab]').forEach((tab) => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.settingsTab;
                $$('[data-settings-tab]').forEach((t) => {
                    const on = t === tab;
                    t.classList.toggle('is-active', on);
                    t.setAttribute('aria-selected', String(on));
                });
                const visible = SETTINGS_TAB_FORMS[target] || [target];
                $$('[data-settings-form]').forEach((f) => {
                    const section = f.dataset.settingsForm;
                    const group = f.dataset.settingsGroup;
                    const show = visible.includes(section) || (group && visible.includes(group));
                    f.hidden = !show;
                });
            });
        });
        $$('[data-settings-form]').forEach((form) => form.addEventListener('submit', saveSettings));
        $$('[data-settings-reset]').forEach((btn) => btn.addEventListener('click', () => resetSettings(btn.dataset.settingsReset)));
    }

    /* ------------------------------------------------------------
       Hero slides
       ------------------------------------------------------------ */
    async function loadHeroSlides() {
        const { ok, data } = await api('/hero-slides');
        if (!ok) return;
        state.heroSlides = data.data || [];
        renderHeroSlides();
    }

    function renderHeroSlides() {
        const wrap = $('[data-slide-list]');
        const empty = $('[data-slide-empty]');
        if (!wrap) return;
        if (!state.heroSlides.length) {
            wrap.innerHTML = '';
            if (empty) empty.hidden = false;
            return;
        }
        if (empty) empty.hidden = true;
        wrap.innerHTML = state.heroSlides.map((slide, i) => {
            const preview = slide.type === 'video'
                ? `<video src="${escapeHtml(slide.video || '')}" muted playsinline preload="metadata"></video>`
                : slide.type === 'image'
                    ? `<img src="${escapeHtml(slide.image || '')}" alt="" loading="lazy">`
                    : '<span class="slide-thumb__text">T</span>';
            return `
                <div class="slide-card" draggable="true" data-slide-card="${escapeHtml(slide.id)}" data-index="${i}">
                    <span class="slide-card__handle" aria-hidden="true">
                        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/></svg>
                    </span>
                    <div class="slide-thumb slide-thumb--${escapeHtml(slide.type)}">${preview}</div>
                    <div class="slide-card__body">
                        <strong>${escapeHtml(slide.title || '(untitled)')}</strong>
                        <span class="sub">${escapeHtml(slide.type)} · ${(Number(slide.duration) || 7000) / 1000}s</span>
                    </div>
                    <div class="cell-actions">
                        <button type="button" class="btn btn--soft btn--sm" data-edit-slide="${escapeHtml(slide.id)}">Edit</button>
                        <button type="button" class="btn btn--ghost btn--danger btn--sm" data-delete-slide="${escapeHtml(slide.id)}">Delete</button>
                    </div>
                </div>`;
        }).join('');

        $$('[data-edit-slide]', wrap).forEach((b) => b.addEventListener('click', () => openSlideEditor(b.dataset.editSlide)));
        $$('[data-delete-slide]', wrap).forEach((b) => b.addEventListener('click', () => deleteSlide(b.dataset.deleteSlide)));
        wireSlideDrag(wrap);
    }

    function wireSlideDrag(wrap) {
        let dragId = null;
        $$('[data-slide-card]', wrap).forEach((card) => {
            card.addEventListener('dragstart', (e) => {
                dragId = card.dataset.slideCard;
                card.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', () => {
                card.style.opacity = '';
            });
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const dragging = $(`[data-slide-card="${dragId}"]`, wrap);
                if (!dragging || dragging === card) return;
                const rect = card.getBoundingClientRect();
                const after = (e.clientY - rect.top) > rect.height / 2;
                wrap.insertBefore(dragging, after ? card.nextSibling : card);
            });
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                commitSlideOrder(wrap);
            });
        });
    }

    async function commitSlideOrder(wrap) {
        const order = $$('[data-slide-card]', wrap).map((el) => el.dataset.slideCard);
        const { ok, data } = await api('/hero-slides/reorder', { method: 'POST', body: { order } });
        if (!ok) {
            showToast(data?.message || 'Could not save the new order.', 'error');
            await loadHeroSlides();
            return;
        }
        state.heroSlides = data.data || state.heroSlides;
        showToast('Slide order saved.', 'success', 2200);
    }

    function openSlideEditor(id) {
        const modal = $('#slide-modal');
        const form = $('#slide-form');
        if (!modal || !form) return;
        state.editingSlideId = id || null;
        form.dataset.slideId = id || '';
        form.reset();
        clearSlideUploadStatus();

        const eyebrow = $('#slide-modal-eyebrow');
        const title = $('#slide-modal-title');
        if (id) {
            const slide = state.heroSlides.find((s) => s.id === id);
            if (!slide) return showToast('Slide not found.', 'error');
            eyebrow.textContent = 'Edit slide';
            title.textContent = slide.title || 'Hero slide';
            $('#slide-type').value = slide.type || 'image';
            $('#slide-duration').value = Number(slide.duration) || 7000;
            $('#slide-image').value = slide.image || '';
            $('#slide-video').value = slide.video || '';
            $('#slide-video-fallback').value = slide.video_fallback || '';
            $('#slide-poster').value = slide.poster || '';
            $('#slide-eyebrow').value = slide.eyebrow || '';
            $('#slide-title').value = slide.title || '';
            $('#slide-title-accent').value = slide.title_accent || '';
            $('#slide-lede').value = slide.lede || '';
            $('#slide-badge-title').value = slide.badge_title || '';
            $('#slide-badge-text').value = slide.badge_text || '';
            updateSlidePreview('image', slide.image || '');
            updateSlidePreview('video', slide.video || '');
        } else {
            eyebrow.textContent = 'New slide';
            title.textContent = 'Hero slide';
            $('#slide-duration').value = 7000;
            updateSlidePreview('image', '');
            updateSlidePreview('video', '');
        }

        syncSlideMediaVisibility();
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        setTimeout(() => $('#slide-type').focus(), 60);
    }

    function closeSlideEditor() {
        const modal = $('#slide-modal');
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        state.editingSlideId = null;
    }

    function syncSlideMediaVisibility() {
        const type = $('#slide-type').value;
        $$('[data-slide-media]').forEach((el) => {
            el.hidden = el.dataset.slideMedia !== type;
        });
    }

    function updateSlidePreview(kind, url) {
        const box = $(`[data-slide-preview="${kind}"]`);
        if (!box) return;
        if (!url) {
            box.hidden = true;
            return;
        }
        box.hidden = false;
        if (kind === 'image') {
            const img = box.querySelector('img');
            if (img) img.src = url;
        } else {
            const video = box.querySelector('video');
            if (video) video.src = url;
        }
    }

    function setSlideUploadStatus(msg, kind) {
        const el = $('[data-slide-upload-status]');
        if (!el) return;
        el.textContent = msg || '';
        el.dataset.kind = kind || '';
    }

    function clearSlideUploadStatus() {
        setSlideUploadStatus('', '');
    }

    const HERO_MAX_DIMENSION = 2400;
    const HERO_OPTIMIZE_BYTES = 1.5 * 1024 * 1024;

    function canvasToBlob(canvas, type, quality) {
        return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    }

    /**
     * Shrink hero images in the browser before upload. The server still
     * produces the final WebP derivatives; this saves admin bandwidth.
     * Animated GIF/SVG, unsupported formats, or already-small files are
     * uploaded unchanged.
     */
    async function optimizeHeroImage(file) {
        if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
            return file;
        }

        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
        } catch (_e) {
            return file;
        }

        try {
            const scale = Math.min(1, HERO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
            if (scale === 1 && file.size <= HERO_OPTIMIZE_BYTES) return file;

            const width = Math.max(1, Math.round(bitmap.width * scale));
            const height = Math.max(1, Math.round(bitmap.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return file;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap, 0, 0, width, height);

            let blob = await canvasToBlob(canvas, 'image/webp', 0.9);
            if (!blob) {
                // Browsers without WebP encoding fall back to JPEG. Hero
                // photos are opaque, so a white matte is safe here.
                ctx.globalCompositeOperation = 'destination-over';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
            }
            if (!blob || blob.size >= file.size) return file;

            const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
            const name = String(file.name || 'hero').replace(/\.[^.]+$/, '') + ext;
            return new File([blob], name, { type: blob.type, lastModified: Date.now() });
        } finally {
            if (typeof bitmap.close === 'function') bitmap.close();
        }
    }

    async function uploadSlideMedia(file) {
        setSlideUploadStatus('Uploading and compressing…', 'info');
        const body = new FormData();
        body.append('file', file);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 180000);
        try {
            const res = await fetch(`${API}/uploads/hero`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getToken()}` },
                body,
                signal: controller.signal
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSlideUploadStatus(payload?.message || 'Upload failed.', 'error');
                return null;
            }
            setSlideUploadStatus('Upload complete. Remember to save the slide.', 'success');
            return payload.data;
        } catch (err) {
            setSlideUploadStatus(err.name === 'AbortError' ? 'Upload timed out.' : 'Could not reach the server.', 'error');
            return null;
        } finally {
            clearTimeout(timer);
        }
    }

    async function handleSlideFile(kind, file) {
        if (!file) return;
        if (kind === 'image' && !file.type.startsWith('image/')) {
            return setSlideUploadStatus('Choose an image file.', 'error');
        }
        if (kind === 'video' && !file.type.startsWith('video/')) {
            return setSlideUploadStatus('Choose a video file.', 'error');
        }

        let upload = file;
        if (kind === 'image') {
            setSlideUploadStatus('Optimizing image…', 'info');
            upload = await optimizeHeroImage(file);
        }

        const media = await uploadSlideMedia(upload);
        if (!media) return;
        if (kind === 'image') {
            $('#slide-image').value = media.url;
            updateSlidePreview('image', media.url);
        } else {
            $('#slide-video').value = media.url;
            if (media.fallback) $('#slide-video-fallback').value = media.fallback;
            if (media.poster) $('#slide-poster').value = media.poster;
            updateSlidePreview('video', media.url);
        }
    }

    function wireSlideForm() {
        const typeSelect = $('#slide-type');
        if (typeSelect) typeSelect.addEventListener('change', syncSlideMediaVisibility);

        $$('[data-slide-drop]').forEach((zone) => {
            const kind = zone.dataset.slideDrop;
            const input = $(`[data-slide-file="${kind}"]`);
            zone.addEventListener('click', () => input && input.click());
            zone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input && input.click(); }
            });
            zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('is-over');
                const file = e.dataTransfer.files && e.dataTransfer.files[0];
                handleSlideFile(kind, file);
            });
            if (input) input.addEventListener('change', () => handleSlideFile(kind, input.files && input.files[0]));
        });

        $$('[data-slide-clear]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const kind = btn.dataset.slideClear;
                if (kind === 'image') {
                    $('#slide-image').value = '';
                    updateSlidePreview('image', '');
                } else {
                    $('#slide-video').value = '';
                    $('#slide-video-fallback').value = '';
                    $('#slide-poster').value = '';
                    updateSlidePreview('video', '');
                }
            });
        });
    }

    async function submitSlideForm(e) {
        e.preventDefault();
        const form = $('#slide-form');
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';

        const payload = {
            type: $('#slide-type').value,
            duration: Number($('#slide-duration').value) || 7000,
            image: $('#slide-image').value.trim(),
            video: $('#slide-video').value.trim(),
            video_fallback: $('#slide-video-fallback').value.trim(),
            poster: $('#slide-poster').value.trim(),
            eyebrow: $('#slide-eyebrow').value.trim(),
            title: $('#slide-title').value.trim(),
            title_accent: $('#slide-title-accent').value.trim(),
            lede: $('#slide-lede').value.trim(),
            badge_title: $('#slide-badge-title').value.trim(),
            badge_text: $('#slide-badge-text').value.trim()
        };

        const isEdit = Boolean(state.editingSlideId);
        const { ok, data } = await api(
            isEdit ? `/hero-slides/${encodeURIComponent(state.editingSlideId)}` : '/hero-slides',
            { method: isEdit ? 'PATCH' : 'POST', body: payload }
        );
        if (ok) {
            closeSlideEditor();
            showToast(data.message || 'Slide saved.', 'success');
            await loadHeroSlides();
        } else {
            showToast(data?.message || 'Could not save the slide.', 'error');
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save slide';
    }

    async function deleteSlide(id) {
        const slide = state.heroSlides.find((s) => s.id === id);
        if (!slide) return;
        if (!window.confirm(`Delete this ${slide.type} slide?`)) return;
        const { ok } = await api(`/hero-slides/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (ok) {
            showToast('Slide removed.', 'success');
            await loadHeroSlides();
        }
    }

    /* ------------------------------------------------------------
       Users
       ------------------------------------------------------------ */
    async function loadUsers() {
        const [{ ok, data }, rolesRes] = await Promise.all([api('/users'), api('/roles')]);
        if (!ok) return showToast(data?.message || 'Could not load users.', 'error');
        state.users = data.data || [];
        if (rolesRes.ok) state.roles = rolesRes.data.data || [];
        populateRoleSelect();
        renderUsers();
    }

    function populateRoleSelect() {
        const select = $('#user-role');
        if (!select) return;
        const current = select.value;
        select.innerHTML = state.roles.map((r) => `<option value="${escapeHtml(r.slug)}">${escapeHtml(r.name)}</option>`).join('');
        if (current) select.value = current;
    }

    function roleName(slug) {
        const role = state.roles.find((r) => r.slug === slug);
        return role ? role.name : slug;
    }

    function userStatusBadge(status) {
        const map = { active: 'badge--open', invited: 'badge--pending', suspended: 'badge--muted' };
        return `<span class="badge ${map[status] || 'badge--muted'}"><span class="badge__dot"></span>${escapeHtml(status || 'unknown')}</span>`;
    }

    function renderUsers() {
        const tbody = $('[data-table="users"]');
        const empty = $('[data-table-empty="users"]');
        if (!tbody) return;
        tbody.innerHTML = state.users.map((u) => `
            <tr data-row-id="${escapeHtml(u.id)}" tabindex="0">
                <td>
                    <strong>${escapeHtml(u.name)}</strong>
                    <span class="sub">${escapeHtml(u.email)}</span>
                </td>
                <td>${escapeHtml(roleName(u.role))}</td>
                <td>${userStatusBadge(u.status)}</td>
                <td>${u.last_login ? formatDate(u.last_login) : '<span style="color:var(--muted)">Never</span>'}</td>
                <td>
                    <div class="cell-actions">
                        <button type="button" class="btn btn--soft btn--sm" data-edit-user="${escapeHtml(u.id)}">Edit</button>
                        <button type="button" class="btn btn--ghost btn--danger btn--sm" data-delete-user="${escapeHtml(u.id)}">Remove</button>
                    </div>
                </td>
            </tr>`).join('');
        if (empty) empty.hidden = state.users.length > 0;

        $$('[data-edit-user]', tbody).forEach((b) => b.addEventListener('click', () => openUserForm(b.dataset.editUser)));
        $$('[data-delete-user]', tbody).forEach((b) => b.addEventListener('click', () => deleteUser(b.dataset.deleteUser)));
    }

    function openUserForm(userId) {
        const form = $('#user-form');
        if (!form) return;
        form.hidden = false;
        form.dataset.userId = userId || '';
        $('#user-form-title').textContent = userId ? 'Edit user' : 'Invite a user';

        if (userId) {
            const user = state.users.find((u) => u.id === userId);
            if (!user) return;
            $('#user-name').value = user.name || '';
            $('#user-email').value = user.email || '';
            $('#user-role').value = user.role || 'viewer';
            $('#user-status').value = user.status || 'invited';
        } else {
            form.reset();
            populateRoleSelect();
            $('#user-status').value = 'invited';
        }
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => $('#user-name').focus(), 60);
    }

    function closeUserForm() {
        const form = $('#user-form');
        if (!form) return;
        form.hidden = true;
        form.dataset.userId = '';
        form.reset();
    }

    async function submitUserForm(e) {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.reportValidity()) return;
        const isEdit = Boolean(form.dataset.userId);
        const payload = {
            name: $('#user-name').value.trim(),
            email: $('#user-email').value.trim(),
            role: $('#user-role').value,
            status: $('#user-status').value
        };
        const { ok, data } = await api(
            isEdit ? `/users/${encodeURIComponent(form.dataset.userId)}` : '/users',
            { method: isEdit ? 'PATCH' : 'POST', body: payload }
        );
        if (ok) {
            closeUserForm();
            showToast(data.message || 'User saved.', 'success');
            await loadUsers();
            await loadDashboard();
        } else {
            showToast(data?.message || 'Could not save the user.', 'error');
        }
    }

    async function deleteUser(userId) {
        const user = state.users.find((u) => u.id === userId);
        if (!user) return;
        if (!window.confirm(`Remove ${user.email} from the console?`)) return;
        const { ok, data } = await api(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
        if (ok) {
            showToast('User removed.', 'success');
            await loadUsers();
            await loadDashboard();
        } else {
            showToast(data?.message || 'Could not remove the user.', 'error');
        }
    }

    /* ------------------------------------------------------------
       Roles & permissions
       ------------------------------------------------------------ */
    async function loadRoles() {
        const { ok, data } = await api('/roles');
        if (!ok) return showToast(data?.message || 'Could not load roles.', 'error');
        state.roles = data.data || [];
        state.permissions = data.permissions || [];
        renderRoles();
        renderPermissionGrid([]);
    }

    function renderRoles() {
        const grid = $('[data-role-grid]');
        if (!grid) return;
        grid.innerHTML = state.roles.map((role) => {
            const perms = role.permissions.includes('*')
                ? ['All permissions']
                : role.permissions.map((p) => (state.permissions.find((x) => x.key === p) || {}).label || p);
            return `
                <article class="role-card">
                    <div class="role-card__head">
                        <h3>${escapeHtml(role.name)}</h3>
                        ${role.locked ? '<span class="badge badge--filled"><span class="badge__dot"></span>Locked</span>' : ''}
                    </div>
                    <p>${escapeHtml(role.description || 'No description.')}</p>
                    <div class="role-card__perms">
                        ${perms.map((p) => `<span class="perm-chip">${escapeHtml(p)}</span>`).join('')}
                    </div>
                    <div class="role-card__actions">
                        <button type="button" class="btn btn--soft btn--sm" data-edit-role="${escapeHtml(role.id)}"${role.locked ? ' disabled' : ''}>Edit</button>
                        <button type="button" class="btn btn--ghost btn--danger btn--sm" data-delete-role="${escapeHtml(role.id)}"${role.locked ? ' disabled' : ''}>Delete</button>
                    </div>
                </article>`;
        }).join('');

        $$('[data-edit-role]', grid).forEach((b) => b.addEventListener('click', () => openRoleForm(b.dataset.editRole)));
        $$('[data-delete-role]', grid).forEach((b) => b.addEventListener('click', () => deleteRole(b.dataset.deleteRole)));
    }

    function renderPermissionGrid(selected) {
        const grid = $('[data-perm-grid]');
        if (!grid) return;
        const active = new Set(selected);
        grid.innerHTML = state.permissions.map((p) => `
            <label class="perm-option">
                <input type="checkbox" name="perm" value="${escapeHtml(p.key)}"${active.has(p.key) ? ' checked' : ''}>
                <span>${escapeHtml(p.label)}</span>
            </label>`).join('');
    }

    function openRoleForm(roleId) {
        const form = $('#role-form');
        if (!form) return;
        form.hidden = false;
        form.dataset.roleId = roleId || '';
        $('#role-form-title').textContent = roleId ? 'Edit role' : 'Create a role';
        if (roleId) {
            const role = state.roles.find((r) => r.id === roleId);
            if (!role) return;
            $('#role-name').value = role.name || '';
            $('#role-description').value = role.description || '';
            renderPermissionGrid(role.permissions);
        } else {
            form.reset();
            renderPermissionGrid([]);
        }
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => $('#role-name').focus(), 60);
    }

    function closeRoleForm() {
        const form = $('#role-form');
        if (!form) return;
        form.hidden = true;
        form.dataset.roleId = '';
        form.reset();
    }

    async function submitRoleForm(e) {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.reportValidity()) return;
        const isEdit = Boolean(form.dataset.roleId);
        const permissions = $$('[data-perm-grid] input:checked').map((i) => i.value);
        const payload = {
            name: $('#role-name').value.trim(),
            description: $('#role-description').value.trim(),
            permissions
        };
        const { ok, data } = await api(
            isEdit ? `/roles/${encodeURIComponent(form.dataset.roleId)}` : '/roles',
            { method: isEdit ? 'PATCH' : 'POST', body: payload }
        );
        if (ok) {
            closeRoleForm();
            showToast(data.message || 'Role saved.', 'success');
            await loadRoles();
        } else {
            showToast(data?.message || 'Could not save the role.', 'error');
        }
    }

    async function deleteRole(roleId) {
        const role = state.roles.find((r) => r.id === roleId);
        if (!role) return;
        if (!window.confirm(`Delete the "${role.name}" role?`)) return;
        const { ok, data } = await api(`/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
        if (ok) {
            showToast('Role removed.', 'success');
            await loadRoles();
        } else {
            showToast(data?.message || 'Could not remove the role.', 'error');
        }
    }

    /* ------------------------------------------------------------
       Backups
       ------------------------------------------------------------ */
    async function loadBackups() {
        const { ok, data } = await api('/backups');
        if (!ok) return showToast(data?.message || 'Could not load backups.', 'error');
        state.backups = data.data || [];
        renderBackups();
    }

    function renderBackups() {
        const tbody = $('[data-table="backups"]');
        const empty = $('[data-table-empty="backups"]');
        if (!tbody) return;
        tbody.innerHTML = state.backups.map((b) => {
            const c = b.counts || {};
            return `
            <tr data-row-id="${escapeHtml(b.id)}" tabindex="0">
                <td>
                    <strong>${escapeHtml(b.filename)}</strong>
                    <span class="sub">${escapeHtml(b.id)}</span>
                </td>
                <td style="font-size:.78rem;color:var(--ink-soft)">
                    ${c.jobs ?? 0} vacancies · ${c.seafarers ?? 0} seafarers<br>
                    ${c.crewRequests ?? 0} requests · ${c.contacts ?? 0} messages
                </td>
                <td>${b.size_kb} KB</td>
                <td>${escapeHtml(b.created_by)}</td>
                <td>${formatDate(b.created_at)}</td>
                <td>
                    <div class="cell-actions">
                        <button type="button" class="btn btn--soft btn--sm" data-restore-backup="${escapeHtml(b.id)}">Restore</button>
                        <button type="button" class="btn btn--ghost btn--danger btn--sm" data-delete-backup="${escapeHtml(b.id)}">Delete</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        if (empty) empty.hidden = state.backups.length > 0;

        $$('[data-restore-backup]', tbody).forEach((b) => b.addEventListener('click', () => restoreBackup(b.dataset.restoreBackup)));
        $$('[data-delete-backup]', tbody).forEach((b) => b.addEventListener('click', () => deleteBackup(b.dataset.deleteBackup)));
    }

    async function createBackup() {
        const { ok, data } = await api('/backups', { method: 'POST' });
        if (ok) {
            showToast(data.message || 'Backup created.', 'success');
            await loadBackups();
        } else {
            showToast(data?.message || 'Could not create a backup.', 'error');
        }
    }

    async function restoreBackup(backupId) {
        const backup = state.backups.find((b) => b.id === backupId);
        if (!backup) return;
        if (!window.confirm(`Restore ${backup.filename}? Current settings and records will be replaced.`)) return;
        const { ok, data } = await api(`/backups/${encodeURIComponent(backupId)}/restore`, { method: 'POST' });
        if (ok) {
            showToast(data.message || 'Backup restored.', 'success');
            await loadDashboard();
            await loadBackups();
        } else {
            showToast(data?.message || 'Could not restore the backup.', 'error');
        }
    }

    async function deleteBackup(backupId) {
        if (!window.confirm('Delete this backup permanently?')) return;
        const { ok, data } = await api(`/backups/${encodeURIComponent(backupId)}`, { method: 'DELETE' });
        if (ok) {
            showToast('Backup deleted.', 'success');
            await loadBackups();
        } else {
            showToast(data?.message || 'Could not delete the backup.', 'error');
        }
    }

    /* ------------------------------------------------------------
       Logs
       ------------------------------------------------------------ */
    async function loadLogs() {
        const { ok, data } = await api(`/logs?level=${encodeURIComponent(state.logLevel)}`);
        if (!ok) return showToast(data?.message || 'Could not load logs.', 'error');
        state.logs = data.data || [];
        state.logSummary = data.summary || state.logSummary;
        renderLogs();
    }

    function renderLogs() {
        const list = $('[data-log-list]');
        const empty = $('[data-table-empty="logs"]');
        if (!list) return;

        const total = state.logSummary.info + state.logSummary.warning + state.logSummary.error;
        const counts = { all: total, info: state.logSummary.info, warning: state.logSummary.warning, error: state.logSummary.error };
        Object.entries(counts).forEach(([key, value]) => {
            const el = $(`[data-log-count="${key}"]`);
            if (el) el.textContent = String(value ?? 0);
            const card = $(`[data-log-summary="${key}"]`);
            if (card) card.textContent = String(value ?? 0);
        });

        list.innerHTML = state.logs.map((log) => {
            const level = String(log.level || 'info').toLowerCase();
            const icon = level === 'error'
                ? '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 9l-6 6M9 9l6 6"/>'
                : level === 'warning'
                    ? '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M12 3l9 16H3l9-16z"/>'
                    : '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l2.5 2.5"/>';
            return `
            <div class="log-row log-row--${escapeHtml(level)}" data-row-id="${escapeHtml(log.id || '')}" tabindex="0">
                <span class="log-row__level log-row__level--${escapeHtml(level)}">
                    <svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>
                </span>
                <div class="log-row__body">
                    <strong>${escapeHtml(log.action)}${log.target ? ' · ' + escapeHtml(log.target) : ''}</strong>
                    <span>${escapeHtml(log.detail || 'No additional detail')}</span>
                </div>
                <div class="log-row__meta">
                    <span class="log-row__actor">${escapeHtml(log.actor || 'system')}</span>
                    <time>${formatDate(log.created_at)}</time>
                </div>
            </div>`;
        }).join('');
        if (empty) empty.hidden = state.logs.length > 0;
    }

    async function clearLogs() {
        const scope = state.logLevel;
        if (!window.confirm(`Clear ${scope === 'all' ? 'all' : scope} log entries?`)) return;
        const { ok, data } = await api(`/logs?level=${encodeURIComponent(scope)}`, { method: 'DELETE' });
        if (ok) {
            showToast(data.message || 'Logs cleared.', 'success');
            await loadLogs();
            await loadDashboard();
        } else {
            showToast(data?.message || 'Could not clear the logs.', 'error');
        }
    }

    function initLogTabs() {
        $$('[data-log-level]').forEach((tab) => {
            tab.addEventListener('click', () => {
                state.logLevel = tab.dataset.logLevel;
                $$('[data-log-level]').forEach((t) => {
                    const on = t === tab;
                    t.classList.toggle('is-active', on);
                    t.setAttribute('aria-selected', String(on));
                });
                loadLogs();
            });
        });
    }

    /* ------------------------------------------------------------
       Modals
       ------------------------------------------------------------ */
    function initModals() {
        $$('[data-modal-close]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.modalClose;
                if (id === 'insight-modal') closeInsightEditor();
                else if (id === 'slide-modal') closeSlideEditor();
                else if (id === 'seafarer-modal') closeSeafarerDetail();
                else if (id === 'record-modal') closeRecordDetail();
                else closeJobEditor();
            });
        });
        const modal = $('#job-modal');
        if (modal) {
            modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeJobEditor(); });
            modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeJobEditor(); });
        }
        const insightModal = $('#insight-modal');
        if (insightModal) {
            insightModal.addEventListener('mousedown', (e) => { if (e.target === insightModal) closeInsightEditor(); });
            insightModal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInsightEditor(); });
        }
        const slideModal = $('#slide-modal');
        if (slideModal) {
            slideModal.addEventListener('mousedown', (e) => { if (e.target === slideModal) closeSlideEditor(); });
            slideModal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSlideEditor(); });
        }
        const seafarerModal = $('#seafarer-modal');
        if (seafarerModal) {
            seafarerModal.addEventListener('mousedown', (e) => { if (e.target === seafarerModal) closeSeafarerDetail(); });
            seafarerModal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSeafarerDetail(); });
        }
        const recordModal = $('#record-modal');
        if (recordModal) {
            recordModal.addEventListener('mousedown', (e) => { if (e.target === recordModal) closeRecordDetail(); });
            recordModal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRecordDetail(); });
        }
        $$('[data-admin-new-job]').forEach((b) => b.addEventListener('click', () => openJobEditor(null)));
        const form = $('#job-form');
        if (form) form.addEventListener('submit', submitJobForm);

        $$('[data-admin-new-insight]').forEach((b) => b.addEventListener('click', () => openInsightEditor(null)));
        const insightForm = $('#insight-form');
        if (insightForm) insightForm.addEventListener('submit', submitInsightForm);

        $$('[data-admin-new-slide]').forEach((b) => b.addEventListener('click', () => openSlideEditor(null)));
        const slideForm = $('#slide-form');
        if (slideForm) slideForm.addEventListener('submit', submitSlideForm);
        wireSlideForm();

        $$('[data-admin-new-user]').forEach((b) => b.addEventListener('click', () => openUserForm(null)));
        const userForm = $('#user-form');
        if (userForm) userForm.addEventListener('submit', submitUserForm);
        $$('[data-user-form-cancel]').forEach((b) => b.addEventListener('click', closeUserForm));

        $$('[data-admin-new-role]').forEach((b) => b.addEventListener('click', () => openRoleForm(null)));
        const roleForm = $('#role-form');
        if (roleForm) roleForm.addEventListener('submit', submitRoleForm);
        $$('[data-role-form-cancel]').forEach((b) => b.addEventListener('click', closeRoleForm));

        $$('[data-admin-create-backup]').forEach((b) => b.addEventListener('click', createBackup));
        $$('[data-admin-clear-logs]').forEach((b) => b.addEventListener('click', clearLogs));
        initSettingsTabs();
        initLogTabs();
    }

    /* ------------------------------------------------------------
       Filters
       ------------------------------------------------------------ */
    function initFilters() {
        $$('[data-filter]').forEach((input) => {
            input.addEventListener('input', () => {
                state.filters[input.dataset.filter] = input.value;
                renderJobs(); renderSeafarers(); renderRequests(); renderInsights();
            });
        });
        $$('[data-filter-select]').forEach((select) => {
            select.addEventListener('change', () => {
                const key = select.dataset.filterSelect;
                state.filters[key] = select.value;
                if (key === 'insight-status') renderInsights();
                else if (key === 'seafarer-status') renderSeafarers();
                else if (key === 'request-status') renderRequests();
                else renderJobs();
            });
        });
        $$('[data-message-filter]').forEach((tab) => {
            tab.addEventListener('click', () => {
                state.filters.messageStatus = tab.dataset.messageFilter;
                $$('[data-message-filter]').forEach((t) => {
                    const on = t === tab;
                    t.classList.toggle('is-active', on);
                    t.setAttribute('aria-selected', String(on));
                });
                renderContacts();
            });
        });
        $$('[data-view-link]').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchView(link.dataset.viewLink);
            });
        });
    }

    /* ------------------------------------------------------------
       Topbar actions
       ------------------------------------------------------------ */
    function initTopbar() {
        $$('[data-admin-refresh]').forEach((b) => b.addEventListener('click', async () => {
            await loadView(currentView());
            showToast('Data refreshed.', 'success', 2200);
        }));
        $$('[data-admin-logout]').forEach((b) => b.addEventListener('click', async () => {
            await api('/logout', { method: 'POST' });
            clearToken();
            window.location.replace(CFG.login || 'login.html');
        }));
        $$('[data-admin-export]').forEach((b) => b.addEventListener('click', () => {
            // Prefix formula starters so a subscriber email cannot execute
            // as a spreadsheet formula when the CSV is opened in Excel.
            const csvCell = (value) => {
                let text = String(value == null ? '' : value);
                if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
                return '"' + text.replace(/"/g, '""') + '"';
            };
            const rows = [['Email']].concat(state.subscribers.map((s) => [s.email]));
            const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ardson-subscribers.csv';
            a.click();
            URL.revokeObjectURL(url);
            showToast('Subscriber list exported.', 'success');
        }));
    }

    function currentView() {
        const hash = window.location.hash.replace('#', '');
        const valid = ['dashboard', 'jobs', 'seafarers', 'requests', 'contacts', 'subscribers', 'settings', 'insights', 'users', 'roles', 'backups', 'logs'];
        return valid.includes(hash) ? hash : 'dashboard';
    }

    function initNav() {
        $$('[data-view]').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchView(link.dataset.view);
            });
        });
    }

    function initSidebarMenu() {
        const sidebar = $('.admin-sidebar');
        const toggle = $('[data-admin-menu]');
        if (!sidebar || !toggle) return;
        const setOpen = (open) => {
            sidebar.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        };
        toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')));
        $$('[data-view]', sidebar).forEach((link) => link.addEventListener('click', () => setOpen(false)));
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('is-open') && !sidebar.contains(e.target)) setOpen(false);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
                setOpen(false);
                toggle.focus();
            }
        });
        const desktop = window.matchMedia('(min-width: 961px)');
        desktop.addEventListener('change', (e) => {
            if (e.matches) setOpen(false);
        });
    }

    /* ------------------------------------------------------------
       Boot
       ------------------------------------------------------------ */
    function initLogin() {
        const form = $('#admin-login-form');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = $('#admin-login-btn');
            btn.disabled = true;
            btn.textContent = 'Signing in…';

            const { ok, data } = await api('/login', {
                method: 'POST',
                body: {
                    user: $('#admin-user').value.trim(),
                    password: $('#admin-pass').value
                }
            });

            if (ok && data?.data?.token) {
                setToken(data.data.token);
                sessionStorage.setItem('ardson_admin_user', data.data.user || 'Admin');
                btn.textContent = 'Welcome back…';
                window.location.replace('index.html');
            } else {
                showToast(data?.message || 'Sign in failed. Please check your credentials.', 'error');
                btn.disabled = false;
                btn.textContent = 'Sign in';
            }
        });
    }

    function init() {
        if ($('#admin-login-form')) { initLogin(); return; }
        const userEl = $('[data-admin-user]');
        if (userEl) userEl.textContent = 'Signed in · ' + (sessionStorage.getItem('ardson_admin_user') || 'Admin');
        startClock();
        initNav();
        initSidebarMenu();
        initModals();
        initRecordRows();
        initFilters();
        initTopbar();
        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-cv-download]');
            if (trigger) downloadCv(trigger.dataset.cvDownload);
        });
        switchView(currentView());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();