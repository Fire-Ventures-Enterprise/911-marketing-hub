// Services Leads Marketing Hub — app.js v3.0
// Sidebar nav, light/dark mode, D1-driven company data

let allDomains   = [];
let allCompanies = [];
let currentUser  = null;
let lastLpHtml       = '';
let lastAdsCampaign  = null;
let lastSeoContent   = null;

// ── AUTH ──────────────────────────────────────────────────────────────────

const ROLE_COLORS = {
  super_admin:   { bg: 'rgba(217,119,6,0.20)',   color: '#F59E0B', border: 'rgba(217,119,6,0.4)' },  // gold
  company_admin: { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', border: 'rgba(96,165,250,0.25)' }, // blue
  manager:       { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80', border: 'rgba(74,222,128,0.25)' },
  staff:         { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: 'rgba(148,163,184,0.25)' } // grey
};

async function checkAuth() {
  try {
    const r = await fetch('/api/auth/me');
    if (r.status === 401) { window.location.replace('/login'); return Promise.reject(); }
    const { user } = await r.json();
    if (!user) { window.location.replace('/login'); return Promise.reject(); }
    const badge  = document.getElementById('role-badge');
    const nameEl = document.getElementById('user-name');
    currentUser = user;
    if (badge) {
      badge.textContent = user.role;
      const c = ROLE_COLORS[user.role] || ROLE_COLORS.staff;
      badge.style.cssText = `background:${c.bg};color:${c.color};border-color:${c.border}`;
    }
    if (nameEl) nameEl.textContent = user.name || user.email;

    // Role-based nav visibility
    _applyRoleNav(user.role);

    // Check for active impersonation (KV key exists if we're in imp mode)
    // The impersonation banner is shown if the role is company_admin but we came via impersonate
    // We detect this by checking a sessionStorage flag set during impersonation
    if (sessionStorage.getItem('slm_impersonating')) {
      const banner = document.getElementById('imp-banner');
      const impName = document.getElementById('imp-name');
      const impInfo = JSON.parse(sessionStorage.getItem('slm_impersonating') || '{}');
      if (banner) { banner.style.display = 'block'; document.body.classList.add('impersonating'); }
      if (impName) impName.textContent = `${impInfo.name || user.name} — ${impInfo.company || ''}`;
    }

    // Data permission gate — company_admin must grant before generating
    if (user.role === 'company_admin') {
      checkPermissionStatus(); // async, non-blocking
    }
  } catch (e) {
    if (e) window.location.replace('/login');
  }
}

function _applyRoleNav(role) {
  const isSuperAdmin    = role === 'super_admin';
  const isCompanyAdmin  = role === 'company_admin';
  const isStaff         = role === 'staff';

  // super_admin nav items (Tenants + Companies)
  document.querySelectorAll('.super-nav').forEach(el => {
    el.style.display = isSuperAdmin ? '' : 'none';
  });

  // company_admin-only nav items (Brand Profile)
  document.querySelectorAll('.co-admin-nav').forEach(el => {
    el.style.display = isCompanyAdmin ? '' : 'none';
  });

  // Generator nav items (hidden for staff)
  const generatorSections = ['domains','landing','ads','seo','keywords','publish','images','reviews','intel'];
  document.querySelectorAll('.nav-item').forEach(btn => {
    const sec = btn.dataset.section;
    if (!sec) return;
    if (isStaff && generatorSections.includes(sec)) btn.style.display = 'none';
  });

  // Update sidebar footer role text
  const footer = document.querySelector('.sb-footer');
  if (footer) {
    const roleLabel = isSuperAdmin ? 'God Mode' : isCompanyAdmin ? 'Company Admin' : 'Staff';
    footer.textContent = `v2.0.0 — ${roleLabel}`;
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.replace('/login');
}

// ── THEME ─────────────────────────────────────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem('slm-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  _updateThemeBtn(saved);
}

function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('slm-theme', next);
  _updateThemeBtn(next);
}

function _updateThemeBtn(theme) {
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ── NAVIGATION ────────────────────────────────────────────────────────────

const SECTION_LABELS = {
  dashboard: 'Dashboard',
  domains:   'Domain Army',
  landing:   'Landing Page Generator',
  ads:       'Google Ads Generator',
  seo:       'SEO Content Generator',
  keywords:  'Keyword Research',
  publish:   'Batch Publish',
  images:    'Image Library',
  reviews:   'Google Reviews',
  leads:     'Inbound Leads',
  tenants:       'Tenant Management',
  companies:     'Company Management',
  settings:      'Settings',
  'brand-profile': 'Brand Profile',
  intel:           'Competitor Intelligence',
  prospector:      'Business Prospector'
};

function showSection(id) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById('pane-' + id);
  if (pane) pane.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === id);
  });

  const titleEl = document.getElementById('tb-title');
  if (titleEl) titleEl.textContent = SECTION_LABELS[id] || id;

  if (id === 'leads')     loadLeads();
  if (id === 'ads')       loadPushHistory();
  if (id === 'publish')   initPublishDomains();
  if (id === 'images')    { loadTemplates(); loadImageLibrary(); _populateImageDomainSelect(); }
  if (id === 'reviews')   { rvInit(); }
  if (id === 'companies') { loadCompanyMgmt(); }
  if (id === 'tenants')        { loadTenants(); }
  if (id === 'settings')       { loadTeam(); loadDataPrivacy(); }
  if (id === 'brand-profile')  { loadBrandProfile(); }
  if (id === 'intel')          { loadIntel(); }
  if (id === 'prospector')     { loadProspector(); }

  if (window.innerWidth <= 768) closeSidebar();
}

// ── SIDEBAR MOBILE ────────────────────────────────────────────────────────

function toggleSidebar() {
  const sb  = document.getElementById('sidebar');
  const ov  = document.getElementById('sb-overlay');
  if (sb.classList.contains('open')) {
    closeSidebar();
  } else {
    sb.classList.add('open');
    ov.classList.add('open');
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('open');
}

// ── COMPANIES (from D1) ───────────────────────────────────────────────────

async function loadCompanies() {
  try {
    const r = await fetch('/api/companies', { headers: { Authorization: `Bearer ${getStoredToken()}` } });
    const { companies } = await r.json();
    allCompanies = companies || [];
    _populateCompanySelects();
    _renderDashboardCompanies();
    if (allDomains.length) buildDomainDD('lp');
  } catch(e) {
    console.warn('Could not load companies:', e.message);
  }
}

function _populateCompanySelects() {
  ['lp-company', 'ads-company', 'seo-company', 'kw-company'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    while (el.options.length > 1) el.remove(1);
    allCompanies.forEach(co => {
      const opt = document.createElement('option');
      opt.value       = co.key;
      opt.textContent = co.name;
      el.appendChild(opt);
    });
  });
}

function _renderDashboardCompanies() {
  const el = document.getElementById('dash-companies');
  if (!el || !allCompanies.length) return;

  // Build per-company domain counts by status from the already-loaded allDomains
  const totalByKey    = {};
  const activeByKey   = {};
  const buildingByKey = {};
  const parkedByKey   = {};
  allDomains.forEach(d => {
    totalByKey[d.co]    = (totalByKey[d.co]    || 0) + 1;
    if (d.status === 'Active')   activeByKey[d.co]   = (activeByKey[d.co]   || 0) + 1;
    if (d.status === 'Building') buildingByKey[d.co] = (buildingByKey[d.co] || 0) + 1;
    if (d.status === 'Parked')   parkedByKey[d.co]   = (parkedByKey[d.co]   || 0) + 1;
  });

  const chevronSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  el.innerHTML = allCompanies.map(co => {
    const accent   = co.color_accent || '#CC0000';
    const total    = totalByKey[co.key]    || 0;
    const active   = activeByKey[co.key]   || 0;
    const building = buildingByKey[co.key] || 0;
    const parked   = parkedByKey[co.key]   || 0;

    // Status dot: green if any active, blue if building only, gray if none
    const dotCls  = active > 0 ? 'co-dot-green' : building > 0 ? 'co-dot-blue' : 'co-dot-gray';
    const dotLbl  = active > 0 ? 'Active' : building > 0 ? 'Building' : 'Inactive';

    const pills = [
      active   ? `<span class="co-status-pill co-sp-active">${active} Active</span>`       : '',
      building ? `<span class="co-status-pill co-sp-building">${building} Building</span>` : '',
      parked   ? `<span class="co-status-pill co-sp-parked">${parked} Parked</span>`       : '',
    ].filter(Boolean).join('') || `<span class="co-status-pill co-sp-parked">0 domains</span>`;

    return `<div class="co-card" id="co-dash-${co.id}" style="--ca:${accent}" onclick="expandDashCard(${co.id},this)">
      <div class="co-card-hd">
        <div class="co-card-header">
          <div class="co-card-title-block">
            <div class="co-name">${co.name}</div>
            <div class="co-sub">${co.phone || '—'} &middot; ${total} domain${total !== 1 ? 's' : ''}</div>
          </div>
          <div class="co-card-right">
            <div class="co-status-dot">
              <div class="co-dot-circle ${dotCls}"></div>
              <span class="co-dot-label">${dotLbl}</span>
            </div>
            <div class="co-chevron">${chevronSvg}</div>
          </div>
        </div>
        <div class="co-pills-row">${pills}</div>
      </div>
      <div class="co-expand" id="co-exp-${co.id}">
        <div class="co-expand-inner" id="co-exp-inner-${co.id}">
          <div style="color:var(--tx3);font-size:12px;padding:8px 0">Loading…</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── DASHBOARD CARD EXPAND ─────────────────────────────────────────────────

let _dashExpandedId = null;

async function expandDashCard(coId, cardEl) {
  // Same card clicked → collapse
  if (_dashExpandedId === coId) {
    cardEl.classList.remove('expanded');
    _dashExpandedId = null;
    return;
  }
  // Collapse previously expanded card
  if (_dashExpandedId !== null) {
    const prev = document.getElementById('co-dash-' + _dashExpandedId);
    if (prev) prev.classList.remove('expanded');
  }
  _dashExpandedId = coId;
  cardEl.classList.add('expanded');

  const inner = document.getElementById('co-exp-inner-' + coId);
  if (inner) inner.innerHTML = '<div style="color:var(--tx3);font-size:12px;padding:8px 0">Loading…</div>';

  try {
    const r = await fetch(`/api/companies/${coId}/summary`, {
      headers: { Authorization: `Bearer ${getStoredToken()}` }
    });
    const d = await r.json();
    if (!r.ok) {
      if (inner) inner.innerHTML = `<div style="color:#f87171;font-size:12px;padding:8px 0">${d.error || 'Load failed'}</div>`;
      return;
    }

    // Company meta (already in allCompanies)
    const co     = allCompanies.find(c => c.id === coId) || {};
    const budget = co.budget     ? `$${Number(co.budget).toLocaleString()}/day` : '—';
    const cpa    = co.target_cpa ? `$${co.target_cpa}` : '—';
    const leads  = d.lead_count || 0;

    // Performance badge based on lead count
    let perfBadgeCls = 'co-pb-none', perfBadgeTxt = 'No Data';
    if (leads >= 50)      { perfBadgeCls = 'co-pb-top';     perfBadgeTxt = 'Top Performer'; }
    else if (leads >= 10) { perfBadgeCls = 'co-pb-good';    perfBadgeTxt = 'Good';          }
    else if (leads > 0)   { perfBadgeCls = 'co-pb-growing'; perfBadgeTxt = 'Growing';       }

    // GBP metric value + class
    const gbpVal = d.gbp_connected ? (d.gbp_name || 'Connected') : 'Not connected';
    const gbpCls = d.gbp_connected ? 'green' : 'muted';

    // Domain tags (max 12 shown, "+N more" overflow)
    const domains  = d.domains || [];
    const MAX_SHOW = 12;
    const shown    = domains.slice(0, MAX_SHOW);
    const extra    = domains.length - MAX_SHOW;
    const domTagsHtml = domains.length
      ? shown.map(dm => {
          const cls = dm.status === 'Active' ? 'co-dt-active' : dm.status === 'Building' ? 'co-dt-building' : 'co-dt-parked';
          return `<span class="co-dom-tag ${cls}" title="${dm.status}">${dm.domain}</span>`;
        }).join('') + (extra > 0 ? `<span class="co-dom-tag co-dt-parked">+${extra} more</span>` : '')
      : '<span style="color:var(--tx3);font-size:12px">No domains yet</span>';

    if (inner) inner.innerHTML = `
      <div class="co-metrics-grid">
        <div class="co-metric">
          <div class="co-metric-label"><span class="co-metric-icon">📥</span>Leads</div>
          <div class="co-metric-val ${leads > 0 ? 'green' : 'muted'}">${leads}</div>
        </div>
        <div class="co-metric">
          <div class="co-metric-label"><span class="co-metric-icon">💰</span>Budget</div>
          <div class="co-metric-val ${budget !== '—' ? '' : 'muted'}">${budget}</div>
        </div>
        <div class="co-metric">
          <div class="co-metric-label"><span class="co-metric-icon">🎯</span>Target CPA</div>
          <div class="co-metric-val ${cpa !== '—' ? '' : 'muted'}">${cpa}</div>
        </div>
        <div class="co-metric">
          <div class="co-metric-label"><span class="co-metric-icon">📍</span>GBP</div>
          <div class="co-metric-val ${gbpCls}" title="${gbpVal}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px">${gbpVal}</div>
        </div>
      </div>
      <span class="co-perf-badge ${perfBadgeCls}">${perfBadgeTxt}</span>
      <div class="co-domains-section">
        <div class="co-domains-label">Domains <span style="opacity:.55">(${domains.length})</span></div>
        <div class="co-domains-tags">${domTagsHtml}</div>
      </div>
      <div class="co-actions" onclick="event.stopPropagation()">
        <button class="btn btn-sec btn-sm" onclick="_dashViewDomains('${co.key}')">📋 Domains</button>
        <button class="btn btn-sec btn-sm" onclick="showSection('leads')">📥 Leads</button>
        <button class="btn btn-primary btn-sm" onclick="_dashGenerateLP('${co.key}')">⚡ Generate LP</button>
      </div>`;
  } catch {
    if (inner) inner.innerHTML = '<div style="color:#f87171;font-size:12px;padding:8px 0">Failed to load summary</div>';
  }
}

// Navigate to Domains tab filtered to one company key
function _dashViewDomains(coKey) {
  showSection('domains');
  // Reset all filter tabs, then render filtered domains for this company
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  renderDomains(allDomains.filter(d => d.co === coKey));
}

// Navigate to Landing tab with company pre-selected
function _dashGenerateLP(coKey) {
  showSection('landing');
  const sel = document.getElementById('lp-company');
  if (sel) sel.value = coKey;
}

// ── DOMAIN DROPDOWN ───────────────────────────────────────────────────────

const CO_ICONS = { Restoration: '🚨', Renovation: '🔨', Kitchen: '🍳' };
let _ddOutsideRegistered = false;

function _hesc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildDomainDD(prefix) {
  if (!allDomains.length) return;
  _renderDomainDDList(prefix, allDomains);
  _renderDomainDDChips(prefix);
  if (!_ddOutsideRegistered) {
    _ddOutsideRegistered = true;
    document.addEventListener('click', e => {
      document.querySelectorAll('.dd-wrap.open').forEach(w => {
        if (!w.contains(e.target)) w.classList.remove('open');
      });
    });
  }
}

function toggleDomainDD(prefix) {
  const wrap = document.getElementById(prefix + '-dd-wrap');
  if (!wrap) return;
  const isOpen = wrap.classList.toggle('open');
  if (isOpen) {
    const search = document.getElementById(prefix + '-dd-search');
    if (search) { search.value = ''; search.focus(); }
    _renderDomainDDList(prefix, allDomains);
  }
}

function filterDomainDD(prefix, query) {
  const q = query.toLowerCase().trim();
  const filtered = !q ? allDomains : allDomains.filter(d =>
    d.domain.toLowerCase().includes(q) ||
    d.keyword.toLowerCase().includes(q) ||
    d.service.toLowerCase().includes(q) ||
    d.co.toLowerCase().includes(q)
  );
  _renderDomainDDList(prefix, filtered, q);
}

function _renderDomainDDChips(prefix) {
  const el = document.getElementById(prefix + '-dd-chips');
  if (!el) return;
  // Top 5 active + authorized domains sorted by priority
  const top5 = allDomains
    .filter(d => d.status === 'Active' && (d.authorized === 1 || d.authorized === true))
    .sort((a, b) => (a.priority || 9) - (b.priority || 9))
    .slice(0, 5);
  if (!top5.length) { el.innerHTML = ''; return; }
  el.innerHTML = top5.map(d =>
    `<button class="dd-chip"
       data-domain="${_hesc(d.domain)}" data-keyword="${_hesc(d.keyword)}"
       data-service="${_hesc(d.service)}" data-co="${_hesc(d.co)}"
       onclick="selectDomainDDEl('${prefix}',this)">
       ${d.domain}
     </button>`
  ).join('');
}

function _renderDomainDDList(prefix, domains, query) {
  const el = document.getElementById(prefix + '-dd-list');
  if (!el) return;
  if (!domains.length) {
    el.innerHTML = '<div class="dd-empty">No domains match "' + (query || '') + '"</div>';
    return;
  }
  // Group by company key
  const groups = {};
  domains.forEach(d => { (groups[d.co] = groups[d.co] || []).push(d); });
  const coOrder = allCompanies.length
    ? allCompanies.map(c => c.key).filter(k => groups[k])
    : Object.keys(groups);
  // Add any keys not in allCompanies (safety fallback)
  Object.keys(groups).forEach(k => { if (!coOrder.includes(k)) coOrder.push(k); });

  let html = '';
  coOrder.forEach(coKey => {
    const list = groups[coKey];
    if (!list || !list.length) return;
    const co     = allCompanies.find(c => c.key === coKey);
    const coName = co ? co.name : coKey;
    const icon   = CO_ICONS[coKey] || '🏢';
    const totalForCo = allDomains.filter(d => d.co === coKey).length;
    const countLabel  = list.length < totalForCo ? `${list.length} of ${totalForCo}` : list.length;
    html += `<div class="dd-group-hd">${icon} ${_hesc(coName)} (${countLabel})</div>`;
    list.forEach(d => {
      const authOk   = d.authorized === 1 || d.authorized === true;
      const badgeCls = d.status === 'Active' ? 'dd-badge-active' : d.status === 'Building' ? 'dd-badge-building' : 'dd-badge-parked';
      if (authOk) {
        html += `<div class="dd-item"
          data-domain="${_hesc(d.domain)}" data-keyword="${_hesc(d.keyword)}"
          data-service="${_hesc(d.service)}" data-co="${_hesc(d.co)}"
          onclick="selectDomainDDEl('${prefix}',this)">
          <span class="dd-item-domain">${_hesc(d.domain)}</span>
          <span class="dd-item-kw">${_hesc(d.keyword)}</span>
          <span class="dd-item-badge ${badgeCls}">${d.status}</span>
        </div>`;
      } else {
        html += `<div class="dd-item dd-disabled">
          <span class="dd-item-domain">${_hesc(d.domain)}</span>
          <span class="dd-item-kw">${_hesc(d.keyword)}</span>
          <span class="dd-item-badge dd-badge-pending">Pending Auth</span>
        </div>`;
      }
    });
  });
  el.innerHTML = html;
}

function selectDomainDDEl(prefix, el) {
  selectDomainDD(prefix, {
    domain:  el.dataset.domain,
    keyword: el.dataset.keyword,
    service: el.dataset.service,
    co:      el.dataset.co
  });
}

function selectDomainDD(prefix, d) {
  // Fill the hidden input + auto-fill related fields
  const hiddenInput = document.getElementById(prefix + '-domain');
  if (hiddenInput) hiddenInput.value = d.domain;
  const display = document.getElementById(prefix + '-dd-display');
  if (display) display.textContent = d.domain;
  const kwEl = document.getElementById(prefix + '-keyword');
  if (kwEl) kwEl.value = d.keyword;
  const svcEl = document.getElementById(prefix + '-service');
  if (svcEl) svcEl.value = d.service;
  const coEl = document.getElementById(prefix + '-company');
  if (coEl) coEl.value = d.co;
  // Close panel
  const wrap = document.getElementById(prefix + '-dd-wrap');
  if (wrap) wrap.classList.remove('open');
  toast('✓ ' + d.domain);
}

function setDomainDDDisplay(prefix, domainStr) {
  // Called externally (e.g. fillLP from domain army) to keep DD display in sync
  const hidden = document.getElementById(prefix + '-domain');
  if (hidden) hidden.value = domainStr || '';
  const display = document.getElementById(prefix + '-dd-display');
  if (display) display.textContent = domainStr || 'Select a domain…';
}

// ── DOMAINS ───────────────────────────────────────────────────────────────

async function loadDomains() {
  try {
    const r = await fetch('/api/domains');
    const data = await r.json();
    allDomains = data.domains || [];
    renderDomains(allDomains);
    buildDomainDD('lp');
    _updateDashStats();
    if (allCompanies.length) _renderDashboardCompanies();
  } catch(e) {
    const tbody = document.getElementById('domains-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--tx3);padding:20px">Error: ${e.message}</td></tr>`;
  }
}

function _updateDashStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dash-total',    allDomains.length);
  set('dash-active',   allDomains.filter(d => d.status === 'Active').length);
  set('dash-building', allDomains.filter(d => d.status === 'Building').length);
  set('dash-parked',   allDomains.filter(d => d.status === 'Parked').length);
}

function renderDomains(domains) {
  const tbody = document.getElementById('domains-tbody');
  if (!domains || !domains.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--tx3);padding:20px">No domains found.</td></tr>';
    return;
  }
  const esc  = s => String(s).replace(/'/g, "\\'");
  const isSA = currentUser?.role === 'super_admin';
  const isCA = currentUser?.role === 'company_admin';
  tbody.innerHTML = domains.map(d => {
    const cat      = d.category === 'emergency' ? 'pill-emergency' : d.category === 'renovation' ? 'pill-renovation' : 'pill-kitchen';
    const status   = d.status === 'Active' ? 'pill-active' : d.status === 'Building' ? 'pill-building' : 'pill-parked';
    const authOk   = d.authorized === 1 || d.authorized === true;
    // Auth badge: show date when authorized
    let authBadge;
    if (authOk && d.authorized_at) {
      const dt = new Date(d.authorized_at);
      const dateStr = dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: '2-digit' });
      authBadge = `<span class="pill pill-auth-ok" title="Authorized ${dt.toLocaleString()}">✓ Auth <span style="opacity:0.75;font-size:10px">${dateStr}</span></span>`;
    } else if (authOk) {
      authBadge = `<span class="pill pill-auth-ok">✓ Auth</span>`;
    } else {
      authBadge = `<span class="pill pill-auth-pending">⏳ Pending</span>`;
    }
    const genBtns  = authOk
      ? `<button class="qf qf-lp"  onclick="event.stopPropagation();fillLP('${esc(d.domain)}','${esc(d.keyword)}','${esc(d.service)}','${esc(d.co)}')">LP</button>
         <button class="qf qf-ads" onclick="event.stopPropagation();fillAds('${esc(d.domain)}','${esc(d.keyword)}','${esc(d.service)}','${esc(d.co)}')">ADS</button>`
      : '';
    // super_admin: Authorize / Revoke on every domain
    // company_admin: Request Auth button on unauthorized domains only
    let adminBtn = '';
    if (isSA) {
      adminBtn = authOk
        ? `<button class="qf qf-revoke" onclick="event.stopPropagation();authorizeDomain(${d.id},'revoke')">Revoke</button>`
        : `<button class="qf qf-auth"   onclick="event.stopPropagation();authorizeDomain(${d.id},'authorize')">✓ Auth</button>`;
    } else if (isCA && !authOk) {
      adminBtn = `<button class="qf qf-request" onclick="event.stopPropagation();requestAuthDomain(${d.id})">Request Auth</button>`;
    }
    const rowClick  = authOk
      ? `fillFromDomain('${esc(d.domain)}','${esc(d.keyword)}','${esc(d.service)}','${esc(d.co)}')`
      : `toast('Domain not yet authorized — pending super admin approval','error')`;
    const rowStyle  = `cursor:pointer${authOk ? '' : ';opacity:0.55'}`;
    return `<tr onclick="${rowClick}" style="${rowStyle}">
      <td><strong>${d.domain}</strong></td>
      <td style="color:var(--tx3)">${d.keyword}</td>
      <td>${d.service}</td>
      <td><span class="pill ${cat}">${d.co}</span></td>
      <td style="color:#4ade80">$${d.budget}/day</td>
      <td><span class="pill ${status}">${d.status}</span></td>
      <td class="p${d.priority}">${d.priority}</td>
      <td>${authBadge}</td>
      <td>${genBtns}${adminBtn}</td>
    </tr>`;
  }).join('');
}

// ── DOMAIN AUTHORIZATION ──────────────────────────────────────────────────

async function authorizeDomain(id, action) {
  try {
    const r = await fetch(`/api/domains/${id}/${action}`, { method: 'POST' });
    const data = await r.json();
    if (r.ok && data.success) {
      toast(action === 'authorize' ? '✓ Domain authorized' : 'Authorization revoked');
      loadDomains();
    } else {
      toast(data.error || 'Failed', 'error');
    }
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
}

async function requestAuthDomain(id) {
  try {
    const r = await fetch(`/api/domains/${id}/request-auth`, { method: 'POST' });
    const data = await r.json();
    if (r.ok && data.success) {
      toast('✓ Authorization request submitted — super admin will review');
    } else {
      toast(data.error || 'Request failed', 'error');
    }
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
}

function filterDomains(filter, el) {
  document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const filtered = filter === 'all'     ? allDomains
    : filter === 'pending'              ? allDomains.filter(d => !d.authorized)
    : ['emergency','renovation','kitchen'].includes(filter)
      ? allDomains.filter(d => d.category === filter)
      : allDomains.filter(d => d.status === filter);
  renderDomains(filtered);
}

function fillFromDomain(domain, keyword, service, co) {
  // LP uses the custom dropdown — keep display in sync
  setDomainDDDisplay('lp', domain);
  document.getElementById('lp-keyword').value = keyword;
  document.getElementById('lp-service').value = service;
  document.getElementById('lp-company').value = co;
  // Ads + SEO still use plain text inputs
  ['ads','seo'].forEach(p => {
    document.getElementById(p+'-domain').value  = domain;
    document.getElementById(p+'-keyword').value = keyword;
    document.getElementById(p+'-service').value = service;
    document.getElementById(p+'-company').value = co;
  });
  showSection('landing');
  toast('Fields filled from: ' + domain);
}

function fillLP(domain, keyword, service, co) {
  setDomainDDDisplay('lp', domain);
  document.getElementById('lp-keyword').value = keyword;
  document.getElementById('lp-service').value = service;
  document.getElementById('lp-company').value = co;
  showSection('landing');
}

function fillAds(domain, keyword, service, co) {
  document.getElementById('ads-domain').value  = domain;
  document.getElementById('ads-keyword').value = keyword;
  document.getElementById('ads-service').value = service;
  document.getElementById('ads-company').value = co;
  showSection('ads');
}

// ── KEYWORD RESEARCH ──────────────────────────────────────────────────────

let allKeywords     = [];
let filteredKeywords = [];
let lastKwResearch  = null;

const INTENT_CFG = {
  emergency:     { icon: '🚨', color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.3)' },
  commercial:    { icon: '💰', color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.3)'  },
  local:         { icon: '📍', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.3)'  },
  informational: { icon: '📚', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)' }
};

async function runKeywordResearch() {
  const company   = document.getElementById('kw-company').value;
  const territory = document.getElementById('kw-territory').value.trim();
  const niche     = document.getElementById('kw-niche').value.trim();
  const radius    = document.getElementById('kw-radius').value;

  if (!territory) { toast('Enter a territory (e.g. Ottawa, ON)', 'error'); return; }
  if (!niche)     { toast('Enter a service or niche', 'error'); return; }

  const btn = document.getElementById('kw-run-btn');
  btn.textContent = '⏳ Researching…';
  btn.disabled = true;

  try {
    const r = await fetch('/api/keywords/research', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_key: company || null, territory, niche, radius })
    });
    const data = await r.json();
    if (!r.ok) { toast(data.error || 'Research failed', 'error'); return; }

    lastKwResearch  = data;
    allKeywords     = data.keywords || [];
    filteredKeywords = allKeywords;

    // Connect banner
    const banner = document.getElementById('kw-connect-banner');
    if (data.connect_message) {
      document.getElementById('kw-connect-msg').textContent = data.connect_message;
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }

    // Sources status
    _renderKwSources(data.sources || {});

    // Cached badge
    const cachedBadge = document.getElementById('kw-cached-badge');
    if (cachedBadge) cachedBadge.style.display = data.cached ? '' : 'none';

    // Reset filter tabs
    document.querySelectorAll('.kw-ftab').forEach(t => t.classList.remove('active'));
    const allTab = document.querySelector('.kw-ftab');
    if (allTab) allTab.classList.add('active');

    renderKeywordResults(allKeywords);
    toast(`${allKeywords.length} keywords found${data.cached ? ' (cached — 7d TTL)' : ''}`);
  } catch(e) {
    toast('Research failed: ' + e.message, 'error');
  } finally {
    btn.textContent = '🎯 Research Keywords';
    btn.disabled = false;
  }
}

function _renderKwSources(sources) {
  const card = document.getElementById('kw-sources-card');
  const list = document.getElementById('kw-sources-list');
  card.style.display = '';
  const defs = [
    { key: 'planner',        label: 'Google Keyword Planner', icon: '📊', note: 'Volume + CPC + Competition' },
    { key: 'trends',         label: 'Google Trends',          icon: '📈', note: 'Seasonal demand curve' },
    { key: 'search_console', label: 'Search Console',         icon: '🔍', note: 'Impression + CTR data' }
  ];
  list.innerHTML = defs.map(s => {
    const on = !!sources[s.key];
    return `<div class="kw-source-pill" style="color:${on ? '#4ade80' : 'var(--tx3)'};background:${on ? 'rgba(74,222,128,0.06)' : 'var(--bg-s)'};border-color:${on ? 'rgba(74,222,128,0.3)' : 'var(--bd)'}">
      <span>${s.icon}</span>
      <div>
        <div style="font-size:11px">${s.label}</div>
        <div style="font-size:10px;opacity:0.7">${on ? '✓ Live' : '○ Not connected'} — ${s.note}</div>
      </div>
    </div>`;
  }).join('');
}

function _kwSparkline(values) {
  if (!values || values.length < 2) return '';
  const max = Math.max(...values, 1);
  const W = 56, H = 18;
  const pts = values.map((v, i) =>
    `${Math.round(i * W / (values.length - 1))},${Math.round(H - (v / max) * H)}`
  ).join(' ');
  const trend = values.slice(-3).reduce((a,b) => a+b,0) > values.slice(0,3).reduce((a,b) => a+b,0);
  return `<svg width="${W}" height="${H}" style="display:inline-block;vertical-align:middle;margin-left:6px" title="12-month trend">
    <polyline points="${pts}" fill="none" stroke="${trend ? '#4ade80' : '#60a5fa'}" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

function renderKeywordResults(keywords) {
  const card  = document.getElementById('kw-results-card');
  const title = document.getElementById('kw-result-count');
  const tbody = document.getElementById('kw-tbody');
  card.style.display = '';
  title.textContent = `${keywords.length} Keywords — sorted by score`;

  if (!keywords.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--tx3);padding:20px">No keywords returned. Try adjusting territory or niche inputs.</td></tr>';
    return;
  }

  const maxVol = Math.max(...keywords.map(k => k.volume || 0), 1);

  tbody.innerHTML = keywords.map((kw, i) => {
    const ic     = INTENT_CFG[kw.intent_type] || INTENT_CFG.informational;
    const score  = kw.score || 0;
    const sColor = score >= 70 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#94a3b8';
    const sBorder= score >= 70 ? 'rgba(74,222,128,0.4)' : score >= 50 ? 'rgba(251,191,36,0.4)' : 'rgba(148,163,184,0.2)';
    const volBar = kw.volume > 0
      ? `<span class="kw-vol-bar" style="width:${Math.round((kw.volume / maxVol) * 48)}px"></span>`
      : '';
    const vol    = kw.volume != null ? kw.volume.toLocaleString() + volBar : `<span style="color:var(--tx3)">—</span>`;
    const cpc    = kw.cpc    != null ? '$' + Number(kw.cpc).toFixed(2)     : `<span style="color:var(--tx3)">—</span>`;
    const comp   = kw.competition != null
      ? `<span style="color:${kw.competition < 30 ? '#4ade80' : kw.competition < 60 ? '#fbbf24' : '#f87171'}">${kw.competition}%</span>`
      : `<span style="color:var(--tx3)">—</span>`;
    const spark  = kw.trend_values ? _kwSparkline(kw.trend_values) : '';
    const srcBadge = `<span class="kw-source">${kw.source || 'manual'}</span>`;
    const domHtml = kw.suggested_domain
      ? `<a href="https://${kw.suggested_domain}" target="_blank" rel="noopener" style="color:#60a5fa;font-size:11px;font-weight:600">${kw.suggested_domain}</a>`
      : `<span style="color:var(--tx3);font-size:11px">—</span>`;

    return `<tr>
      <td>
        <div style="font-weight:600;color:var(--tx);font-size:12px">${kw.keyword}${srcBadge}</div>
        ${spark}
      </td>
      <td style="white-space:nowrap">${vol}</td>
      <td style="color:#4ade80;font-weight:600">${cpc}</td>
      <td>${comp}</td>
      <td><span class="kw-badge" style="color:${ic.color};background:${ic.bg};border-color:${ic.border}">${ic.icon} ${kw.intent_type}</span></td>
      <td><span class="kw-match">${kw.match_type}</span></td>
      <td><span class="kw-score" style="color:${sColor};border-color:${sBorder}">${score}</span></td>
      <td>${domHtml}</td>
      <td style="white-space:nowrap">
        <button class="qf" onclick="saveOneKeyword(${i})" title="Save to D1" style="font-size:11px">💾</button>
        <button class="qf qf-ads" onclick="sendKwToAds(${i})" title="Send to Ads Generator" style="font-size:11px">→ ADS</button>
        <button class="qf qf-lp" onclick="sendKwToLP(${i})" title="Send to Landing Page Generator" style="font-size:11px">→ LP</button>
      </td>
    </tr>`;
  }).join('');
}

function filterKeywords(filter, el) {
  document.querySelectorAll('.kw-ftab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  filteredKeywords = filter === 'all' ? allKeywords : allKeywords.filter(k => k.intent_type === filter);
  renderKeywordResults(filteredKeywords);
}

async function saveOneKeyword(idx) {
  const kw = filteredKeywords[idx];
  if (!kw) return;
  try {
    const r = await fetch('/api/keywords/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: [kw] })
    });
    const d = await r.json();
    if (r.ok) toast('✓ Keyword saved to D1');
    else toast(d.error || 'Save failed', 'error');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function saveAllKeywords() {
  if (!allKeywords.length) { toast('Run research first', 'error'); return; }
  try {
    const r = await fetch('/api/keywords/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: allKeywords })
    });
    const d = await r.json();
    if (r.ok) toast(`✓ ${d.saved} keywords saved to D1`);
    else toast(d.error || 'Save failed', 'error');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

function sendKwToAds(idx) {
  const kw = filteredKeywords[idx];
  if (!kw) return;
  document.getElementById('ads-keyword').value = kw.keyword;
  if (kw.suggested_domain) document.getElementById('ads-domain').value = kw.suggested_domain;
  showSection('ads');
  toast('Keyword loaded into Ads Generator');
}

function sendKwToLP(idx) {
  const kw = filteredKeywords[idx];
  if (!kw) return;
  document.getElementById('lp-keyword').value = kw.keyword;
  if (kw.suggested_domain) setDomainDDDisplay('lp', kw.suggested_domain);
  showSection('landing');
  toast('Keyword loaded into Landing Page Generator');
}

function exportKeywordsCSV() {
  if (!allKeywords.length) { toast('Run research first', 'error'); return; }
  const headers = ['Keyword','Volume','CPC (CAD)','Competition','Intent','Match Type','Score','Territory','Suggested Domain','Source'];
  const rows = allKeywords.map(k => [
    `"${k.keyword}"`,
    k.volume ?? '',
    k.cpc != null ? Number(k.cpc).toFixed(2) : '',
    k.competition ?? '',
    k.intent_type,
    k.match_type,
    k.score,
    k.territory || '',
    k.suggested_domain || '',
    k.source || ''
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `keywords-${(lastKwResearch?.territory || 'export').replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.csv`;
  a.click();
  toast(`Exported ${allKeywords.length} keywords`);
}

// ── LANDING PAGE GENERATOR ────────────────────────────────────────────────

async function generateLP() {
  const keyword = document.getElementById('lp-keyword').value;
  const service = document.getElementById('lp-service').value;
  const domain  = document.getElementById('lp-domain').value;
  const company = document.getElementById('lp-company').value;
  const mode    = document.getElementById('lp-mode')?.value || 'seo';
  if (!keyword || !service || !domain) { toast('Fill keyword, service & domain', 'error'); return; }
  document.getElementById('lp-output').textContent = 'Generating…';
  const r = await fetch('/api/generate/landing-page', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({keyword, service, domain, company, mode})
  });
  const d = await r.json();
  lastLpHtml = d.html;
  document.getElementById('lp-output').textContent = d.html;
  // ── LP Checklist ──────────────────────────────────────────────────────────
  const cl = d.checklist;
  let clEl = document.getElementById('lp-checklist');
  if (cl && clEl) {
    const passCount = cl.passed.length;
    const warnCount = cl.warnings.length;
    const passedHtml = cl.passed.map(p => `<div class="chk-pass">✅ ${p}</div>`).join('');
    const warnedHtml = cl.warnings.map(w => `<div class="chk-warn">⚠️ ${w}</div>`).join('');
    clEl.innerHTML = `<div class="checklist-wrap">
      <div class="checklist-hd">
        <span style="color:#4ade80">✅ ${passCount} passed</span>
        <span style="color:${warnCount > 0 ? '#f59e0b' : '#4ade80'}">⚠️ ${warnCount} warning${warnCount !== 1 ? 's' : ''}</span>
        <span style="color:var(--txt3);font-weight:400;font-size:12px">Template ${d.template}: ${d.templateName}</span>
      </div>
      <div class="checklist-body">${passedHtml}${warnedHtml}</div>
    </div>`;
    clEl.style.display = 'block';
  }
  toast(`Generated [${mode.toUpperCase()}] for ` + d.brand + (cl && cl.warnings.length ? ` — ${cl.warnings.length} warning(s)` : ''));
}

function copyLP() {
  if (!lastLpHtml) { toast('Generate first', 'error'); return; }
  navigator.clipboard.writeText(lastLpHtml);
  toast('HTML copied!');
}

function previewLP() {
  if (!lastLpHtml) { toast('Generate first', 'error'); return; }
  const w = window.open('', '_blank');
  w.document.write(lastLpHtml);
}

async function deployLP() {
  const domain = document.getElementById('lp-domain').value;
  if (!lastLpHtml || !domain) { toast('Generate first', 'error'); return; }
  const r = await fetch('/api/deploy/landing-page', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({domain, html: lastLpHtml})
  });
  const d = await r.json();
  toast(d.message || 'Deployed!');
}

// ── ADS GENERATOR ─────────────────────────────────────────────────────────

async function generateAds() {
  const domain  = document.getElementById('ads-domain').value;
  const service = document.getElementById('ads-service').value;
  const keyword = document.getElementById('ads-keyword').value;
  const company = document.getElementById('ads-company').value;
  if (!domain || !service || !keyword) { toast('Fill all fields', 'error'); return; }
  document.getElementById('ads-output').textContent = 'Generating…';
  const r = await fetch('/api/generate/ads-campaign', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({domain, service, keyword, company})
  });
  lastAdsCampaign = await r.json();
  document.getElementById('ads-output').textContent = JSON.stringify(lastAdsCampaign, null, 2);
  toast('Generated for ' + lastAdsCampaign.company);
}

function copyAds() {
  if (!lastAdsCampaign) { toast('Generate first', 'error'); return; }
  navigator.clipboard.writeText(JSON.stringify(lastAdsCampaign, null, 2));
  toast('JSON copied!');
}

async function pushAds(dryRun) {
  if (!lastAdsCampaign) { toast('Generate first', 'error'); return; }
  const r = await fetch('/api/google-ads/push', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({...lastAdsCampaign, dry_run: dryRun})
  });
  const d = await r.json();
  document.getElementById('ads-output').textContent = JSON.stringify(d, null, 2);
  toast(d.message || d.error);
  loadPushHistory();
}

async function checkGoogleAuth() {
  const r = await fetch('/api/auth/google/status');
  const d = await r.json();
  document.getElementById('oauth-status').innerHTML = d.connected
    ? `<span style="color:#4ade80">Connected — ${Math.round(d.expires_in_seconds/60)} mins remaining</span>`
    : '<span style="color:#f87171">Not connected</span>';
}

async function loadPushHistory() {
  const r = await fetch('/api/google-ads/history');
  const { history } = await r.json();
  const el = document.getElementById('push-history');
  if (!history || !history.length) {
    el.innerHTML = '<p style="color:var(--tx3);font-size:13px">No history yet.</p>';
    return;
  }
  el.innerHTML = history.map(h =>
    `<div style="padding:8px 0;border-bottom:1px solid var(--bd);font-size:13px">
      <span style="color:${h.status==='demo'?'#F59E0B':'#4ade80'};font-weight:700">${h.status==='demo'?'Demo':'Live'}</span>
      &nbsp;<strong style="color:var(--tx)">${h.campaign}</strong>
      &nbsp;<span style="color:var(--tx3)">${new Date(h.ts).toLocaleString()}</span>
    </div>`
  ).join('');
}

// ── SEO GENERATOR ─────────────────────────────────────────────────────────

async function generateSEO() {
  const domain  = document.getElementById('seo-domain').value;
  const keyword = document.getElementById('seo-keyword').value;
  const service = document.getElementById('seo-service').value;
  const company = document.getElementById('seo-company').value;
  if (!domain || !keyword || !service) { toast('Fill all fields', 'error'); return; }
  document.getElementById('seo-output').innerHTML = '<p style="color:var(--tx3);padding:20px">Generating…</p>';
  const r = await fetch('/api/generate/seo-content', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({domain, keyword, service, company})
  });
  lastSeoContent = await r.json();
  const s = lastSeoContent;
  document.getElementById('seo-output').innerHTML =
    `<div class="card"><div class="card-hd"><div class="card-title">Title Tag</div></div>
      <p style="color:var(--out-tx);font-family:monospace;font-size:13px">${s.title}</p></div>` +
    `<div class="card"><div class="card-hd"><div class="card-title">Meta Description</div></div>
      <p style="color:var(--out-tx);font-family:monospace;font-size:13px">${s.metaDesc}</p></div>` +
    `<div class="card"><div class="card-hd"><div class="card-title">FAQs (${s.faqs.length})</div></div>
      ${s.faqs.map(f => `<div style="margin-bottom:12px">
        <div style="font-weight:700;color:var(--tx)">${f.question}</div>
        <div style="color:var(--tx3);font-size:13px;margin-top:3px">${f.answer}</div>
      </div>`).join('')}</div>` +
    `<div class="card"><div class="card-hd"><div class="card-title">JSON-LD Schema</div></div>
      <pre style="color:var(--out-tx);font-family:monospace;font-size:12px;overflow:auto">${JSON.stringify(s.schema, null, 2)}</pre></div>` +
    `<div class="card"><div class="card-hd"><div class="card-title">Article</div></div>
      <pre style="color:var(--tx2);font-family:monospace;font-size:12px;white-space:pre-wrap">${s.article}</pre></div>`;
  toast('SEO generated for ' + s.brand);
}

function copySEO() {
  if (!lastSeoContent) { toast('Generate first', 'error'); return; }
  navigator.clipboard.writeText(JSON.stringify(lastSeoContent, null, 2));
  toast('Copied!');
}

// ── LEADS ─────────────────────────────────────────────────────────────────

async function loadLeads() {
  const r = await fetch('/api/leads');
  const { leads, message } = await r.json();

  if (message) {
    document.getElementById('leads-list').innerHTML =
      `<div style="background:var(--bg-s);border:1px solid var(--bd);border-radius:8px;padding:24px;text-align:center">
        <p style="color:#fde68a;font-weight:700;margin-bottom:6px">Demo Mode</p>
        <p style="color:var(--tx3);font-size:13px">${message}</p>
      </div>`;
    _renderLeadsStats([]);
    const el = document.getElementById('dash-leads');
    if (el) el.textContent = '0';
    return;
  }

  const dashEl = document.getElementById('dash-leads');
  if (dashEl) dashEl.textContent = leads.length;

  _renderLeadsStats(leads);

  document.getElementById('leads-list').innerHTML = leads.slice(0, 50).map(l => {
    const co     = allCompanies.find(c => c.key === l.company);
    const accent = co ? co.color_accent : '#64748b';
    const initial = l.company ? l.company[0] : '?';
    return `<div class="lead-row">
      <div class="lead-ico" style="background:${accent}22;color:${accent}">${initial}</div>
      <div>
        <div class="lead-name">${l.name || 'Anonymous'} &mdash; ${l.phone || l.email || '—'}</div>
        <div class="lead-meta">${l.source || 'direct'} &middot; ${l.company || '—'} &middot; ${new Date(l.timestamp).toLocaleString()}</div>
      </div>
    </div>`;
  }).join('') || '<p style="color:var(--tx3);text-align:center;padding:24px">No leads yet.</p>';
}

function _renderLeadsStats(leads) {
  const statsEl = document.getElementById('leads-stats');
  if (!statsEl) return;
  const byKey = {};
  leads.forEach(l => { byKey[l.company] = (byKey[l.company] || 0) + 1; });

  const coStats = allCompanies.map(co =>
    `<div class="stat-card" style="--sa:${co.color_accent || '#CC0000'}">
      <div class="stat-num">${byKey[co.key] || 0}</div>
      <div class="stat-label">${co.name}</div>
    </div>`
  ).join('');

  statsEl.innerHTML =
    `<div class="stat-card" style="--sa:#4ade80">
      <div class="stat-num" id="leads-total">${leads.length}</div>
      <div class="stat-label">Total Leads</div>
    </div>${coStats}`;
}

// ── BATCH PUBLISH ─────────────────────────────────────────────────────────

function initPublishDomains() {
  if (!allDomains.length) { setTimeout(initPublishDomains, 500); return; }
  document.getElementById('publish-domains').innerHTML = allDomains.map(d =>
    `<label class="dcheck">
      <input type="checkbox" value="${d.domain}" data-keyword="${d.keyword}" data-service="${d.service}" data-co="${d.co}">
      <div><strong>${d.domain}</strong><span>${d.co} &middot; ${d.status}</span></div>
    </label>`
  ).join('');
}

function selectAllDomains(checked) {
  document.querySelectorAll('#publish-domains input').forEach(c => c.checked = checked);
}

async function publishBatch(action) {
  const checked = [...document.querySelectorAll('#publish-domains input:checked')];
  if (!checked.length) { toast('Select at least one domain', 'error'); return; }
  const prog = document.getElementById('publish-progress');
  const fill = document.getElementById('pub-progress');
  const log  = document.getElementById('pub-log');
  prog.style.display = 'block';
  log.textContent = '';
  let done = 0;
  const addLog = msg => { log.textContent += msg + '\n'; log.scrollTop = log.scrollHeight; };

  for (const inp of checked) {
    const { value: domain, dataset: { keyword: kw, service: svc, co } } = inp;
    done++;
    fill.style.width = Math.round((done / checked.length) * 100) + '%';
    try {
      if (action === 'lp') {
        const r = await fetch('/api/generate/landing-page', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keyword:kw,service:svc,domain,company:co})});
        const d = await r.json();
        addLog('✓ LP: ' + domain + ' (' + d.brand + ')');
      } else if (action === 'ads') {
        const r = await fetch('/api/generate/ads-campaign', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain,service:svc,keyword:kw,company:co})});
        const d = await r.json();
        addLog('✓ Ads: ' + d.campaign.name);
      } else if (action === 'seo') {
        await fetch('/api/generate/seo-content', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain,keyword:kw,service:svc,company:co})});
        addLog('✓ SEO: ' + domain);
      } else {
        addLog('→ Queued: ' + domain + ' (demo mode)');
      }
    } catch(e) {
      addLog('✗ Error: ' + domain + ' — ' + e.message);
    }
  }
  addLog('\n✅ Done! ' + checked.length + ' domains processed.');
  toast(checked.length + ' domains processed');
}

// ── PORKBUN REGISTRY ─────────────────────────────────────────────────────────

async function importAllDomains() {
  const btn  = document.getElementById('btn-import-all');
  const wrap = document.getElementById('sync-status-wrap');
  if (btn)  { btn.disabled = true; btn.textContent = '⏳ Importing…'; }
  if (wrap) wrap.innerHTML = '<span style="color:var(--tx3)">Connecting to Porkbun — fetching all domains…</span>';
  try {
    const r = await fetch('/api/porkbun/import-all', { method: 'POST' });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    toast(`Imported ${d.total} domains — ${d.inserted} new, ${d.updated} updated`);
    loadSyncStatus();
    loadDomains();
  } catch (e) {
    toast('Import failed: ' + e.message, 'error');
    if (wrap) wrap.innerHTML = `<span style="color:#f87171">Import error: ${e.message}</span>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Import All'; }
  }
}

async function loadSyncStatus() {
  const wrap = document.getElementById('sync-status-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<span style="color:var(--tx3)">Loading…</span>';
  try {
    const r = await fetch('/api/porkbun/sync-status');
    const d = await r.json();
    if (d.error) { wrap.innerHTML = `<span style="color:#f87171">${d.error}</span>`; return; }
    const lastSync = d.last_sync ? new Date(d.last_sync).toLocaleString() : 'Never';
    const unsyncedWarn = d.unsynced_domains.length > 0
      ? `style="border-color:rgba(245,158,11,0.4);color:#F59E0B"` : '';
    const expiryWarn = d.expiring_soon.length > 0
      ? `style="border-color:rgba(239,68,68,0.4);color:#f87171"` : '';
    wrap.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;margin-bottom:8px">
        <span class="sync-stat">Porkbun: <span class="sync-val">${d.porkbun_total}</span></span>
        <span class="sync-stat">D1 Domains: <span class="sync-val">${d.d1_total}</span></span>
        <span class="sync-stat" ${unsyncedWarn}>Unsynced: <span class="sync-val">${d.unsynced_domains.length}</span></span>
        <span class="sync-stat" ${expiryWarn}>Expiring ≤30d: <span class="sync-val">${d.expiring_soon.length}</span></span>
      </div>
      <div style="color:var(--tx3);font-size:11px">Last sync: ${lastSync}</div>
    `;
    if (d.expiring_soon.length > 0) renderExpiryAlerts(d.expiring_soon);
    else document.getElementById('expiry-alerts-wrap').innerHTML = '';
  } catch (e) {
    wrap.innerHTML = `<span style="color:#f87171">Error: ${e.message}</span>`;
  }
}

function _normSlug(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function searchDomains() {
  const kw   = _normSlug(document.getElementById('dr-keyword')?.value);
  const city = _normSlug(document.getElementById('dr-city')?.value);
  if (!kw || !city) { toast('Enter keyword and city', 'error'); return; }
  const exts = [];
  if (document.getElementById('dr-ca')?.checked)  exts.push('ca');
  if (document.getElementById('dr-com')?.checked) exts.push('com');
  if (document.getElementById('dr-net')?.checked) exts.push('net');
  if (!exts.length) { toast('Select at least one extension', 'error'); return; }

  // Generate patterns: keyword+city, city+keyword, keyword+in+city
  const patterns = [`${kw}${city}`, `${city}${kw}`, `${kw}in${city}`];
  const domains = [];
  for (const pat of patterns) for (const ext of exts) domains.push(`${pat}.${ext}`);

  const status  = document.getElementById('dr-status');
  const results = document.getElementById('dr-results');
  results.innerHTML = '';

  // Check one domain at a time — browser handles 11s rate-limit delay between calls
  for (let i = 0; i < domains.length; i++) {
    const dom = domains[i];
    if (i > 0) {
      for (let s = 11; s > 0; s--) {
        if (status) status.textContent = `⏳ Rate limit — next check (${dom}) in ${s}s…`;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    if (status) status.textContent = `🔍 Checking ${dom}…`;
    try {
      const r = await fetch('/api/porkbun/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: [dom] })
      });
      const d = await r.json();
      _renderDomainSearchResult(results, d.results?.[0] || { domain: dom, status: 'ERROR' });
    } catch (e) {
      _renderDomainSearchResult(results, { domain: dom, status: 'ERROR', error: e.message });
    }
  }
  if (status) status.textContent = `✅ Done — ${domains.length} domains checked.`;
}

function _renderDomainSearchResult(container, res) {
  const avail = res.response?.avail === 'yes';
  const price = res.response?.price ? `$${res.response.price}/yr` : '';
  const rowId = `dr-row-${res.domain.replace(/\./g, '-')}`;
  const row   = document.createElement('div');
  row.className = 'dr-result-row';
  row.id = rowId;
  row.innerHTML = `
    <span class="dr-domain">${res.domain}</span>
    ${res.status === 'SUCCESS'
      ? avail
        ? `<span class="dr-avail-yes">✅ Available</span>
           <span class="dr-price">${price}</span>
           <button class="dr-reg-btn" onclick="registerDomain('${res.domain}','${res.response?.price||''}')">Register →</button>`
        : `<span class="dr-avail-no">❌ Taken</span>`
      : `<span class="dr-avail-no">⚠ Check failed</span>
         <span class="dr-price" style="color:var(--tx3);font-size:11px">${res.error||''}</span>`
    }`;
  container.appendChild(row);
}

async function registerDomain(domain, price) {
  if (!confirm(`Register ${domain} for $${price}/yr?\n\nThis charges your Porkbun account.\nWHOIS privacy is automatic and free.`)) return;
  const rowId = `dr-row-${domain.replace(/\./g, '-')}`;
  const row   = document.getElementById(rowId);
  if (row) row.innerHTML = `<span class="dr-domain">${domain}</span><span style="color:var(--tx3);font-size:12px">⏳ Registering…</span>`;
  try {
    const r = await fetch('/api/porkbun/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, years: '1' })
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    const stepsHtml = (d.steps || []).map(s => `
      <div class="dr-step dr-step-${s.status}">
        ${s.status==='ok' ? '✅' : s.status==='error' ? '⚠' : '⏳'} <strong>${s.step.replace(/_/g,' ')}</strong>
        ${s.detail ? `<span style="color:var(--tx3)">— ${s.detail}</span>` : ''}
      </div>`).join('');
    if (row) row.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:700;color:#4ade80;margin-bottom:6px">✅ ${domain} registered!</div>
        <div class="dr-steps">${stepsHtml}</div>
      </div>`;
    toast(`${domain} registered!`);
    loadDomains();
    loadSyncStatus();
  } catch (e) {
    if (row) row.innerHTML = `<span class="dr-domain">${domain}</span><span style="color:#f87171">❌ ${e.message}</span>`;
    toast('Registration failed: ' + e.message, 'error');
  }
}

function renderExpiryAlerts(alerts) {
  const wrap = document.getElementById('expiry-alerts-wrap');
  if (!wrap || !alerts.length) return;
  wrap.innerHTML = `
    <div class="card" style="margin-top:16px;border-color:rgba(245,158,11,0.35)">
      <div class="card-hd"><div class="card-title" style="color:#F59E0B">⚠ Expiring Within 30 Days (${alerts.length})</div></div>
      <div style="padding:12px 20px">
        ${alerts.map(a => `
          <div class="expiry-alert">
            <span style="flex:1;font-weight:600;min-width:160px">${a.domain}</span>
            <span class="expiry-badge">${a.days_left}d left</span>
            <span style="color:var(--tx3)">${(a.expires_at||'').split('T')[0]}</span>
            <span style="color:var(--tx3);font-size:11px">${a.company_name||'Unassigned'}</span>
            <span style="font-size:11px;font-weight:600;color:${a.auto_renew?'#4ade80':'#f87171'}">${a.auto_renew?'Auto-renew ON':'⚠ Auto-renew OFF'}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── IMAGE UPLOAD ──────────────────────────────────────────────────────────

let _tplFile = null, _domFile = null;

function handleImgFile(input, ctx) {
  const file = input.files[0];
  if (!file) return;
  if (ctx === 'tpl') { _tplFile = file; _previewImg('tpl', file); }
  else               { _domFile = file; _previewImg('dom', file); }
}
function handleImgDrop(e, ctx) {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (ctx === 'tpl') { _tplFile = file; document.getElementById('tpl-file-input').files = e.dataTransfer.files; _previewImg('tpl', file); }
  else               { _domFile = file; document.getElementById('dom-file-input').files = e.dataTransfer.files; _previewImg('dom', file); }
}
function _previewImg(ctx, file) {
  const wrap = document.getElementById(`${ctx}-upload-preview`);
  const img  = document.getElementById(`${ctx}-preview-img`);
  const nm   = document.getElementById(`${ctx}-preview-name`);
  wrap.style.display = 'block';
  img.src = URL.createObjectURL(file);
  nm.textContent = `${file.name} — ${(file.size/1024).toFixed(0)} KB`;
}

async function uploadTemplateImage() {
  const tplId    = document.getElementById('img-tpl-id').value;
  const niche    = document.getElementById('img-niche').value;
  const imgType  = document.getElementById('img-type').value;
  const altText  = document.getElementById('img-alt').value;
  const statusEl = document.getElementById('tpl-upload-status');
  if (!_tplFile) { toast('Select an image file first', 'error'); return; }
  if (!tplId)    { toast('Select a template first', 'error'); return; }
  statusEl.textContent = 'Uploading…';
  const fd = new FormData();
  fd.append('file', _tplFile);
  fd.append('template_id', tplId);
  fd.append('image_type', imgType);
  fd.append('niche', niche);
  fd.append('alt_text', altText);
  try {
    const r = await fetch('/api/images/upload', { method: 'POST', headers: { Authorization: `Bearer ${getStoredToken()}` }, body: fd });
    const d = await r.json();
    if (!r.ok) { statusEl.textContent = '✗ ' + (d.error || 'Upload failed'); toast(d.error || 'Upload failed', 'error'); return; }
    statusEl.textContent = `✓ Saved to R2: ${d.r2Key}`;
    toast(`Uploaded: ${d.r2Key}`, 'success');
    _tplFile = null;
    document.getElementById('tpl-upload-preview').style.display = 'none';
    loadImageLibrary();
  } catch (err) { statusEl.textContent = '✗ Network error'; toast('Upload failed', 'error'); }
}

async function uploadDomainImage() {
  const domainId = document.getElementById('img-domain-id').value;
  const imgType  = document.getElementById('img-domain-type').value;
  const altText  = document.getElementById('img-domain-alt').value;
  const statusEl = document.getElementById('dom-upload-status');
  if (!_domFile)  { toast('Select an image file first', 'error'); return; }
  if (!domainId)  { toast('Select a domain first', 'error'); return; }
  statusEl.textContent = 'Uploading…';
  const fd = new FormData();
  fd.append('file', _domFile);
  fd.append('domain_id', domainId);
  fd.append('image_type', imgType);
  fd.append('alt_text', altText);
  try {
    const r = await fetch('/api/images/upload', { method: 'POST', headers: { Authorization: `Bearer ${getStoredToken()}` }, body: fd });
    const d = await r.json();
    if (!r.ok) { statusEl.textContent = '✗ ' + (d.error || 'Upload failed'); toast(d.error || 'Upload failed', 'error'); return; }
    statusEl.textContent = `✓ Saved to R2: ${d.r2Key}`;
    toast(`Uploaded: ${d.r2Key}`, 'success');
    _domFile = null;
    document.getElementById('dom-upload-preview').style.display = 'none';
    loadImageLibrary();
  } catch (err) { statusEl.textContent = '✗ Network error'; toast('Upload failed', 'error'); }
}

async function loadTemplates() {
  const grid = document.getElementById('tpl-grid');
  if (!grid) return;
  // Templates are seeded in D1 — fetch them from the LP generator's known list
  // We use the sync-status API as a proxy; templates come from lp_templates
  try {
    // Fetch template data via a dedicated query using existing auth
    const r = await fetch('/api/lp-templates', { headers: { Authorization: `Bearer ${getStoredToken()}` } });
    if (!r.ok) { grid.innerHTML = '<div style="color:var(--txt3);font-size:13px">Template data via /api/lp-templates — endpoint not yet exposed (add if needed)</div>'; return; }
    const d = await r.json();
    grid.innerHTML = (d.templates || []).map(t => `
      <div class="tpl-card" onclick="selectTplForUpload(${t.template_number})">
        <div class="tpl-swatch" style="background:linear-gradient(135deg,${t.primary_color},${t.accent_color})"></div>
        <div class="tpl-name">T${String(t.template_number).padStart(2,'0')} — ${t.name}</div>
        <div class="tpl-meta">${t.layout} · ${t.best_for}</div>
        <div class="tpl-usage">Used ${t.usage_count} time${t.usage_count !== 1 ? 's' : ''}</div>
      </div>`).join('');
    // Also populate template select
    const sel = document.getElementById('img-tpl-id');
    if (sel && d.templates) {
      sel.innerHTML = '<option value="">— Select Template —</option>' +
        d.templates.map(t => `<option value="${t.template_number}">T${String(t.template_number).padStart(2,'0')} — ${t.name}</option>`).join('');
    }
  } catch { grid.innerHTML = '<div style="color:var(--txt3);font-size:13px">Load failed</div>'; }
}

function selectTplForUpload(num) {
  const sel = document.getElementById('img-tpl-id');
  if (sel) { sel.value = num; document.getElementById('tpl-upload-zone').scrollIntoView({ behavior: 'smooth' }); }
}

async function loadImageLibrary() {
  const wrap = document.getElementById('img-library-wrap');
  if (!wrap) return;
  try {
    const r = await fetch('/api/images/list', { headers: { Authorization: `Bearer ${getStoredToken()}` } });
    const d = await r.json();
    if (!d.images?.length) { wrap.innerHTML = '<div style="color:var(--txt3);font-size:13px">No images uploaded yet.</div>'; return; }
    wrap.innerHTML = `<div class="img-preview-wrap">${d.images.map(img => `
      <div class="img-preview-card">
        <img src="${img.url}" alt="${img.alt_text || ''}" loading="lazy" onerror="this.style.display='none'">
        <div class="img-preview-info">
          <div class="img-preview-key">${img.r2_key}</div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap">
            <span class="img-preview-badge ${img.approved ? 'approved' : 'pending'}">${img.approved ? '✓ Approved' : '⏳ Pending'}</span>
            ${!img.approved ? `<button class="btn btn-sec btn-sm" style="padding:2px 8px;font-size:10px" onclick="approveImage(${img.id},this)">Approve</button>` : ''}
          </div>
        </div>
      </div>`).join('')}</div>`;
  } catch { wrap.innerHTML = '<div style="color:var(--txt3);font-size:13px">Load failed</div>'; }
}

async function approveImage(id, btn) {
  btn.disabled = true; btn.textContent = '…';
  try {
    const r = await fetch(`/api/images/${id}/approve`, { method: 'PATCH', headers: { Authorization: `Bearer ${getStoredToken()}` } });
    if (r.ok) { toast('Image approved'); loadImageLibrary(); }
    else { toast('Approve failed', 'error'); btn.disabled = false; btn.textContent = 'Approve'; }
  } catch { toast('Network error', 'error'); btn.disabled = false; btn.textContent = 'Approve'; }
}

async function loadTplImagePreview() {
  const tplNum  = document.getElementById('img-tpl-id')?.value;
  const prevDiv = document.getElementById('tpl-upload-preview');
  const prevImg = document.getElementById('tpl-preview-img');
  const prevName= document.getElementById('tpl-preview-name');
  if (!prevDiv) return;
  if (!tplNum) { prevDiv.style.display = 'none'; return; }

  prevDiv.style.display = 'block';
  if (prevImg)  { prevImg.src = ''; prevImg.style.display = ''; prevImg.alt = 'Loading…'; }
  if (prevName) prevName.textContent = 'Loading existing images for this template…';

  try {
    const r = await fetch(`/api/images/list?template_id=${tplNum}`, {
      headers: { Authorization: `Bearer ${getStoredToken()}` }
    });
    const d = await r.json();
    const images = d.images || [];
    if (!images.length) {
      if (prevImg)  prevImg.style.display = 'none';
      if (prevName) prevName.textContent = `No images uploaded yet for T${String(tplNum).padStart(2,'0')} — upload one above.`;
      return;
    }
    const first = images[0];
    if (prevImg)  {
      prevImg.style.display = '';
      prevImg.src = first.url;
      prevImg.alt = first.alt_text || `Template ${tplNum} hero`;
    }
    if (prevName) prevName.textContent = `${images.length} image${images.length !== 1 ? 's' : ''} uploaded — ${first.r2_key}`;
  } catch {
    if (prevImg)  prevImg.style.display = 'none';
    if (prevName) prevName.textContent = 'Could not load template images.';
  }
}

// Populate domain dropdown for image upload when images pane is shown
function _populateImageDomainSelect() {
  const sel = document.getElementById('img-domain-id');
  if (!sel || !allDomains) return;
  sel.innerHTML = '<option value="">— Select Domain —</option>' +
    allDomains.map(d => `<option value="${d.id}">${d.domain}</option>`).join('');
}

// ── COMPANY MANAGEMENT ────────────────────────────────────────────────────

let _coMgmtProfiles = {}; // place_id keyed by company_id, populated on load

async function loadCompanyMgmt() {
  const tbody = document.getElementById('co-tbl-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="color:var(--tx3);text-align:center;padding:24px">Loading…</td></tr>';

  // Ensure companies are loaded
  if (!allCompanies.length) await loadCompanies();

  // Fetch review profiles to show GBP status
  let profiles = {};
  try {
    const r = await fetch('/api/reviews', { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
    const d = await r.json();
    if (d.profiles) d.profiles.forEach(p => { profiles[p.company_id] = p; });
  } catch(_) {}
  _coMgmtProfiles = profiles;

  if (!allCompanies.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:var(--tx3);text-align:center;padding:24px">No companies found.</td></tr>';
    return;
  }

  tbody.innerHTML = allCompanies.map(co => {
    const prof = profiles[co.id];
    const gbpStatus = prof
      ? `<span class="co-mgmt-status connected">✅ ${prof.business_name || 'Connected'}</span>`
      : `<span class="co-mgmt-status no-profile">⚠️ Not Connected</span>`;
    const budget = co.budget ? `$${Number(co.budget).toLocaleString()}` : '—';
    const cpa    = co.target_cpa ? `$${co.target_cpa}` : '—';
    return `<tr id="co-row-${co.id}">
      <td><div class="co-tbl-name">${co.name}</div><div class="co-tbl-key">${co.key}</div></td>
      <td>${co.phone || '<span style="color:var(--tx3)">—</span>'}</td>
      <td>${co.domain || '<span style="color:var(--tx3)">—</span>'}</td>
      <td>${budget} / ${cpa}</td>
      <td>${gbpStatus}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sec btn-sm" onclick="editCompany(${co.id})">✏️ Edit</button>
      </td>
    </tr>`;
  }).join('');
}

function showAddCompany() {
  document.getElementById('co-edit-id').value = '';
  document.getElementById('co-form-title').textContent = 'Add Company';
  document.getElementById('co-f-name').value = '';
  document.getElementById('co-f-key').value = '';
  document.getElementById('co-f-phone').value = '';
  document.getElementById('co-f-domain').value = '';
  document.getElementById('co-f-budget').value = '';
  document.getElementById('co-f-cpa').value = '';
  document.getElementById('co-f-color-bg').value = '#1e293b';
  document.getElementById('co-f-color-bg-picker').value = '#1e293b';
  document.getElementById('co-f-color-accent').value = '#3b82f6';
  document.getElementById('co-f-color-accent-picker').value = '#3b82f6';
  document.getElementById('co-f-callouts').value = '';
  document.getElementById('co-f-sitelinks').value = '';
  document.getElementById('co-inline-gbp').style.display = 'none';
  document.getElementById('co-form-card').style.display = 'block';
  document.getElementById('co-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideCompanyForm() {
  document.getElementById('co-form-card').style.display = 'none';
}

function editCompany(id) {
  const co = allCompanies.find(c => c.id === id);
  if (!co) return;
  document.getElementById('co-edit-id').value = co.id;
  document.getElementById('co-form-title').textContent = `Edit — ${co.name}`;
  document.getElementById('co-f-name').value = co.name || '';
  document.getElementById('co-f-key').value = co.key || '';
  document.getElementById('co-f-phone').value = co.phone || '';
  document.getElementById('co-f-domain').value = co.domain || '';
  document.getElementById('co-f-budget').value = co.budget || '';
  document.getElementById('co-f-cpa').value = co.target_cpa || '';
  const bgColor = co.color_bg || '#1e293b';
  const acColor = co.color_accent || '#3b82f6';
  document.getElementById('co-f-color-bg').value = bgColor;
  document.getElementById('co-f-color-bg-picker').value = bgColor;
  document.getElementById('co-f-color-accent').value = acColor;
  document.getElementById('co-f-color-accent-picker').value = acColor;
  // Parse callouts / sitelinks — stored as JSON string in D1
  try { document.getElementById('co-f-callouts').value = co.callouts ? JSON.stringify(JSON.parse(co.callouts)) : ''; } catch(_) { document.getElementById('co-f-callouts').value = co.callouts || ''; }
  try { document.getElementById('co-f-sitelinks').value = co.sitelinks ? JSON.stringify(JSON.parse(co.sitelinks)) : ''; } catch(_) { document.getElementById('co-f-sitelinks').value = co.sitelinks || ''; }

  // Show inline GBP section for existing company
  const gbpSection = document.getElementById('co-inline-gbp');
  gbpSection.style.display = 'block';
  _coLoadInlineGbp(id);

  document.getElementById('co-form-card').style.display = 'block';
  document.getElementById('co-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveCompany() {
  const id       = document.getElementById('co-edit-id').value;
  const name     = document.getElementById('co-f-name').value.trim();
  const key      = document.getElementById('co-f-key').value.trim().toLowerCase();
  const phone    = document.getElementById('co-f-phone').value.trim();
  const domain   = document.getElementById('co-f-domain').value.trim();
  const budget   = document.getElementById('co-f-budget').value.trim();
  const cpa      = document.getElementById('co-f-cpa').value.trim();
  const color_bg     = document.getElementById('co-f-color-bg').value.trim();
  const color_accent = document.getElementById('co-f-color-accent').value.trim();

  if (!name || !key) { toast('Name and key are required', 'error'); return; }
  if (!/^[a-z0-9-]+$/.test(key)) { toast('Key must be lowercase letters, numbers, hyphens only', 'error'); return; }

  let callouts = [];
  let sitelinks = [];
  try { const raw = document.getElementById('co-f-callouts').value.trim(); if (raw) callouts = JSON.parse(raw); } catch(_) { toast('Callouts must be valid JSON array', 'error'); return; }
  try { const raw = document.getElementById('co-f-sitelinks').value.trim(); if (raw) sitelinks = JSON.parse(raw); } catch(_) { toast('Sitelinks must be valid JSON array', 'error'); return; }

  const body = { key, name, phone: phone || null, domain: domain || null,
    budget: budget ? Number(budget) : null, target_cpa: cpa ? Number(cpa) : null,
    color_bg: color_bg || '#1e293b', color_accent: color_accent || '#3b82f6',
    callouts, sitelinks };

  const url    = id ? `/api/companies/${id}` : '/api/companies';
  const method = id ? 'PATCH' : 'POST';

  const r = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!r.ok) { toast(d.error || 'Save failed', 'error'); return; }

  toast(id ? 'Company updated ✓' : 'Company created ✓', 'success');
  hideCompanyForm();
  // Refresh global companies list and table
  await loadCompanies();
  loadCompanyMgmt();
}

// Inline GBP helpers for the edit form
let _coInlineGbpCompanyId = null;

async function _coLoadInlineGbp(companyId) {
  _coInlineGbpCompanyId = companyId;
  const statusEl  = document.getElementById('co-gbp-status');
  const syncBtn   = document.getElementById('co-gbp-sync-btn');
  const resultsEl = document.getElementById('co-gbp-results');
  resultsEl.style.display = 'none';
  syncBtn.style.display = 'none';
  statusEl.textContent = 'Loading…';

  const r = await fetch(`/api/reviews/${companyId}`, { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
  const d = await r.json();

  if (d.profile) {
    const lastSync = d.profile.last_synced ? new Date(d.profile.last_synced).toLocaleString() : 'Never';
    statusEl.innerHTML = `<span style="color:#4ade80;font-weight:700">✅ Connected:</span> <strong>${d.profile.business_name}</strong> &nbsp;·&nbsp; ⭐ ${d.profile.average_rating || '—'} &nbsp;·&nbsp; ${d.profile.total_reviews || 0} reviews &nbsp;·&nbsp; <span style="color:var(--tx3)">Last sync: ${lastSync}</span>`;
    syncBtn.style.display = 'inline-flex';
  } else {
    statusEl.innerHTML = `<span style="color:#F59E0B">⚠️ No Google Business Profile connected.</span> Search below to find and connect.`;
  }
}

async function coGbpSearch() {
  if (!_coInlineGbpCompanyId) { toast('Save the company first', 'error'); return; }
  const query = document.getElementById('co-gbp-search-input').value.trim();
  if (!query) return;
  const resultsEl = document.getElementById('co-gbp-results');
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '<div style="color:var(--tx3);font-size:13px">Searching…</div>';

  const r = await fetch('/api/reviews/search-business', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
    body: JSON.stringify({ query })
  });
  const d = await r.json();
  if (!d.results?.length) { resultsEl.innerHTML = '<div style="color:var(--tx3);font-size:13px">No results found.</div>'; return; }

  resultsEl.innerHTML = d.results.map((p, i) => `
    <div class="rv-search-result" style="margin-bottom:8px">
      <div class="rv-search-name">${p.name}</div>
      <div class="rv-search-addr">${p.address || ''}</div>
      <div class="rv-search-rating">${p.rating ? `⭐ ${p.rating} (${p.total_reviews || 0} reviews)` : ''}</div>
      <button class="btn btn-green btn-sm" style="margin-top:8px" onclick="coGbpConnect(${JSON.stringify(p).replace(/"/g,'&quot;')})">✓ Connect This Profile</button>
    </div>`).join('<hr style="border-color:var(--bd);margin:8px 0">');
}

async function coGbpConnect(place) {
  if (!_coInlineGbpCompanyId) return;
  const r = await fetch(`/api/reviews/connect/${_coInlineGbpCompanyId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
    body: JSON.stringify({ place_id: place.place_id, business_name: place.name, average_rating: place.rating, total_reviews: place.total_reviews, profile_url: place.maps_url })
  });
  const d = await r.json();
  if (d.success) {
    toast('Google Business Profile connected ✓', 'success');
    _coLoadInlineGbp(_coInlineGbpCompanyId);
    document.getElementById('co-gbp-results').style.display = 'none';
    loadCompanyMgmt();
  } else {
    toast(d.error || 'Connect failed', 'error');
  }
}

async function coGbpSync() {
  if (!_coInlineGbpCompanyId) return;
  const syncStatus = document.getElementById('co-gbp-sync-status');
  if (syncStatus) syncStatus.textContent = 'Syncing…';
  const r = await fetch(`/api/reviews/sync/${_coInlineGbpCompanyId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` }
  });
  const d = await r.json();
  if (syncStatus) syncStatus.textContent = '';
  if (d.synced !== undefined) {
    toast(`Synced ${d.synced} reviews ✓`, 'success');
    _coLoadInlineGbp(_coInlineGbpCompanyId);
  } else {
    toast(d.error || 'Sync failed', 'error');
  }
}

// ── GOOGLE REVIEWS ────────────────────────────────────────────────────────

let _rvSelectedCompanyId = null;

async function rvInit() {
  // Always ensure companies are loaded before rendering the dropdown
  if (!allCompanies.length) await loadCompanies();

  const sel = document.getElementById('rv-company-sel');
  if (!sel) return;

  if (currentUser?.role === 'company_admin') {
    // company_admin sees only their own company — pre-select and lock
    const ownCo = allCompanies.find(c => String(c.id) === String(currentUser.company_id));
    if (ownCo) {
      sel.innerHTML = `<option value="${ownCo.id}">${ownCo.name}</option>`;
      sel.disabled = true;
      _rvSelectedCompanyId = String(ownCo.id);
      rvLoadProfile();
    } else {
      sel.innerHTML = '<option value="">— No company assigned —</option>';
      sel.disabled = true;
    }
    // Hide overview table for company_admin (it shows all companies)
    const overviewCard = document.getElementById('rv-overview-card');
    if (overviewCard) overviewCard.style.display = 'none';
  } else {
    // super_admin / manager — rebuild the full dropdown every time the tab opens
    sel.disabled = false;
    if (allCompanies.length) {
      sel.innerHTML = '<option value="">— Select Company —</option>' +
        allCompanies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } else {
      sel.innerHTML = '<option value="">— No companies found —</option>';
    }
    rvLoadOverview();
  }
}

async function rvLoadProfile() {
  const sel  = document.getElementById('rv-company-sel');
  const cId  = sel?.value;
  if (!cId) return;
  _rvSelectedCompanyId = cId;

  const statusEl = document.getElementById('rv-profile-status');
  const searchEl = document.getElementById('rv-search-section');
  const listCard = document.getElementById('rv-list-card');
  statusEl.textContent = 'Loading…';

  const r = await fetch(`/api/reviews/${cId}`, { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
  const d = await r.json();

  if (d.profile) {
    const lastSync = d.profile.last_synced ? new Date(d.profile.last_synced).toLocaleString() : 'Never';
    statusEl.innerHTML = `<span style="color:#4ade80;font-weight:700">✅ Connected:</span> <strong>${d.profile.business_name}</strong> &nbsp;·&nbsp;
      ⭐ ${d.profile.average_rating || '—'} &nbsp;·&nbsp; ${d.profile.total_reviews || 0} reviews &nbsp;·&nbsp;
      <span style="color:var(--txt3)">Last sync: ${lastSync}</span>`;
    searchEl.style.display = 'none';
    // Show reviews list
    listCard.style.display = 'block';
    document.getElementById('rv-list-title').textContent = `Reviews — ${d.profile.business_name}`;
    rvRenderStats(d.profile);
    rvRenderRows(d.reviews || []);
  } else {
    statusEl.innerHTML = `<span style="color:#f59e0b">⚠️ No Google Business Profile connected.</span> Search below to find and connect this company's profile.`;
    searchEl.style.display = 'block';
    listCard.style.display = 'none';
    document.getElementById('rv-search-input').value = '';
    document.getElementById('rv-search-results').style.display = 'none';
  }
}

function rvRenderStats(profile) {
  const el = document.getElementById('rv-stats-bar');
  if (!el) return;
  el.innerHTML = `
    <div><div style="font-size:22px;font-weight:900;color:var(--ac)">${profile.average_rating || '—'}</div><div style="font-size:11px;color:var(--txt3)">Avg Rating</div></div>
    <div><div style="font-size:22px;font-weight:900;color:var(--ac)">${profile.total_reviews || 0}</div><div style="font-size:11px;color:var(--txt3)">Total Reviews</div></div>
    <div><div style="font-size:12px;margin-top:4px"><a href="${profile.profile_url || '#'}" target="_blank" rel="noopener" style="color:#388bfd">View on Google Maps ↗</a></div></div>
  `;
}

function rvRenderRows(reviews) {
  const el = document.getElementById('rv-rows');
  if (!el) return;
  if (!reviews.length) {
    el.innerHTML = '<div style="color:var(--txt3);font-size:13px">No reviews synced yet. Click "Sync Now" to fetch from Google.</div>';
    return;
  }
  el.innerHTML = reviews.map(rv => {
    const stars = '⭐'.repeat(rv.rating || 5);
    const feat  = rv.featured ? '<span class="rv-feat-badge">Featured</span>' : '';
    const truncated = rv.review_text.length > 280 ? rv.review_text.slice(0, 277) + '…' : rv.review_text;
    return `<div class="rv-row">
      <div>
        <div class="rv-row-stars">${stars} ${feat}</div>
        <div class="rv-row-text">"${truncated}"</div>
        <div class="rv-row-meta"><strong>${rv.reviewer_name}</strong> &nbsp;·&nbsp; ${rv.relative_time || rv.review_date || ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
        <button class="btn btn-sm ${rv.featured ? 'btn-sec' : 'btn-primary'}" onclick="rvToggleFeatured(${rv.id},${rv.featured ? 0 : 1})">
          ${rv.featured ? '☆ Unfeature' : '★ Feature'}
        </button>
      </div>
    </div>`;
  }).join('');
}

async function rvSearchBusiness() {
  const query = document.getElementById('rv-search-input').value.trim();
  if (!query) return;
  const btn = document.querySelector('[onclick="rvSearchBusiness()"]');
  if (btn) btn.textContent = 'Searching…';
  const resEl = document.getElementById('rv-search-results');
  resEl.style.display = 'none';

  const r = await fetch('/api/reviews/search-business', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
    body: JSON.stringify({ query })
  });
  const d = await r.json();
  if (btn) btn.textContent = '🔍 Search';

  if (d.error) {
    const banner = document.getElementById('reviews-api-banner');
    if (banner) banner.style.display = 'block';
    toast(d.error, 'error'); return;
  }
  if (!d.results || !d.results.length) {
    resEl.innerHTML = '<div style="color:var(--txt3);font-size:13px;padding:12px 0">No results found — try a different search term.</div>';
    resEl.style.display = 'block'; return;
  }
  resEl.innerHTML = d.results.map(p => `
    <div class="rv-search-result" onclick='rvConnectProfile(${JSON.stringify(p)})'>
      <div class="rv-search-name">${p.name}</div>
      <div class="rv-search-addr">${p.address}</div>
      <div class="rv-search-rating">⭐ ${p.rating || '—'} · ${p.total_reviews} reviews</div>
    </div>`).join('');
  resEl.style.display = 'block';
}

async function rvConnectProfile(place) {
  if (!_rvSelectedCompanyId) { toast('Select a company first', 'error'); return; }
  const r = await fetch(`/api/reviews/connect/${_rvSelectedCompanyId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
    body: JSON.stringify({ place_id: place.place_id, business_name: place.name, average_rating: place.rating, total_reviews: place.total_reviews, profile_url: place.maps_url })
  });
  const d = await r.json();
  if (d.success) {
    toast('Connected! Syncing reviews…');
    await rvSync();
    rvLoadProfile();
    rvLoadOverview();
  } else {
    toast(d.error || 'Connect failed', 'error');
  }
}

async function rvSync() {
  if (!_rvSelectedCompanyId) { toast('Select a company first', 'error'); return; }
  const statusEl = document.getElementById('rv-sync-status');
  if (statusEl) statusEl.textContent = 'Syncing…';
  const r = await fetch(`/api/reviews/sync/${_rvSelectedCompanyId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` }
  });
  const d = await r.json();
  if (d.success) {
    toast(`Synced ${d.synced} reviews (${d.featured} featured)`);
    if (statusEl) statusEl.textContent = `Last sync: just now`;
    rvLoadProfile();
    rvLoadOverview();
  } else {
    toast(d.error || 'Sync failed', 'error');
    if (statusEl) statusEl.textContent = '';
  }
}

async function rvToggleFeatured(reviewId, featured) {
  const r = await fetch(`/api/reviews/${reviewId}/featured`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
    body: JSON.stringify({ featured })
  });
  const d = await r.json();
  if (d.success) { toast(featured ? 'Marked as featured' : 'Removed from featured'); rvLoadProfile(); }
  else toast(d.error || 'Update failed', 'error');
}

async function rvLoadOverview() {
  const el = document.getElementById('rv-overview-rows');
  if (!el) return;
  const r = await fetch('/api/reviews', { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
  const d = await r.json();
  if (!d.profiles || !d.profiles.length) {
    el.innerHTML = '<div style="color:var(--txt3);font-size:13px">No companies have connected a Google Business Profile yet.</div>';
    return;
  }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="border-bottom:1px solid var(--bd);color:var(--txt3)">
      <th style="padding:8px 0;text-align:left">Company</th>
      <th style="padding:8px 0;text-align:left">Business Profile</th>
      <th style="padding:8px 0;text-align:center">Rating</th>
      <th style="padding:8px 0;text-align:center">Reviews Stored</th>
      <th style="padding:8px 0;text-align:left">Last Sync</th>
    </tr></thead>
    <tbody>${d.profiles.map(p => `<tr style="border-bottom:1px solid var(--bd)">
      <td style="padding:10px 0"><strong>${p.company_name}</strong></td>
      <td style="padding:10px 0;color:var(--txt2)">${p.business_name}</td>
      <td style="padding:10px 0;text-align:center">⭐ ${p.average_rating || '—'}</td>
      <td style="padding:10px 0;text-align:center">${p.review_count || 0}</td>
      <td style="padding:10px 0;color:var(--txt3)">${p.last_synced ? new Date(p.last_synced).toLocaleDateString() : 'Never'}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function getStoredToken() {
  return document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('slm_token='))?.split('=')[1] || '';
}

// ── TENANT MANAGEMENT ─────────────────────────────────────────────────────

let _tnPlans = [];      // subscription plans cache
let _tnTenants = [];    // tenants cache

async function loadTenants() {
  const tbody = document.getElementById('tn-tbl-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="color:var(--tx3);text-align:center;padding:24px">Loading…</td></tr>';

  const r = await fetch('/api/tenants', { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
  const d = await r.json();
  if (!r.ok || d.error) { tbody.innerHTML = `<tr><td colspan="8" style="color:#f87171;text-align:center;padding:24px">${d.error || 'Load failed'}</td></tr>`; return; }

  _tnTenants = d.tenants || [];

  // Update stats
  const active  = _tnTenants.filter(t => t.status === 'active').length;
  const pending = _tnTenants.filter(t => t.status === 'pending').length;
  const mrr     = _tnTenants.filter(t => t.status === 'active').reduce((s, t) => s + (t.monthly_fee || 0), 0);
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('tn-active-count', active);
  setEl('tn-pending-count', pending);
  setEl('tn-mrr', '$' + mrr.toLocaleString());

  if (!_tnTenants.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:var(--tx3);text-align:center;padding:24px">No tenants yet. Invite your first client!</td></tr>';
    return;
  }

  tbody.innerHTML = _tnTenants.map(t => {
    const joined = t.activated_at ? new Date(t.activated_at).toLocaleDateString() : (t.invited_at ? new Date(t.invited_at).toLocaleDateString() : '—');
    const fee    = t.monthly_fee ? `$${Number(t.monthly_fee).toLocaleString()}` : '—';
    return `<tr>
      <td><strong style="color:var(--tx)">${t.company_name}</strong><div style="font-size:11px;color:var(--tx3);font-family:monospace">${t.company_key}</div></td>
      <td><span class="tn-plan">${t.plan || 'starter'}</span></td>
      <td><span class="tn-status ${t.status}">${t.status}</span></td>
      <td>${t.domain_count || 0} / ${t.max_domains || '—'}</td>
      <td>${t.user_count || 0} / ${t.max_users || '—'}</td>
      <td>${fee}</td>
      <td style="color:var(--tx3)">${joined}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sec btn-sm" onclick="showTenantDetail(${t.id})">Detail</button>
        <button class="btn btn-amber btn-sm" onclick="impersonateTenant(${t.id})" title="View as this tenant">👁️</button>
      </td>
    </tr>`;
  }).join('');
}

async function showTenantDetail(id) {
  const card = document.getElementById('tn-detail-card');
  const body = document.getElementById('tn-detail-body');
  const title = document.getElementById('tn-detail-title');
  card.style.display = 'block';
  body.innerHTML = '<div style="color:var(--tx3);padding:20px">Loading…</div>';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const r = await fetch(`/api/tenants/${id}`, { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
  const d = await r.json();
  if (!r.ok) { body.innerHTML = `<div style="color:#f87171">${d.error || 'Load failed'}</div>`; return; }

  const t = d.tenant;
  title.textContent = `${t.company_name} — Detail`;

  const planFeat = (() => { try { return JSON.parse(_tnPlans.find(p => p.name.toLowerCase() === t.plan)?.features || '[]'); } catch { return []; } })();

  body.innerHTML = `
    <div class="tn-stats-row">
      <div class="tn-stat"><div class="tn-stat-num">${t.domain_count || 0}</div><div class="tn-stat-label">Domains Used</div></div>
      <div class="tn-stat"><div class="tn-stat-num">${t.max_domains || '—'}</div><div class="tn-stat-label">Domain Limit</div></div>
      <div class="tn-stat"><div class="tn-stat-num">${t.user_count || 0}</div><div class="tn-stat-label">Active Users</div></div>
      <div class="tn-stat"><div class="tn-stat-num">${t.max_users || '—'}</div><div class="tn-stat-label">User Limit</div></div>
      <div class="tn-stat"><div class="tn-stat-num">${t.gbp_count || 0}</div><div class="tn-stat-label">GBP Connected</div></div>
      <div class="tn-stat"><div class="tn-stat-num" style="color:#4ade80">$${(t.monthly_fee || 0).toLocaleString()}</div><div class="tn-stat-label">MRR</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:8px">Company Info</div>
        <div style="font-size:13px;color:var(--tx2);line-height:2">
          <strong style="color:var(--tx)">Key:</strong> <code>${t.company_key}</code><br>
          <strong style="color:var(--tx)">Plan:</strong> <span class="tn-plan">${t.plan}</span><br>
          <strong style="color:var(--tx)">Status:</strong> <span class="tn-status ${t.status}">${t.status}</span><br>
          <strong style="color:var(--tx)">Billing Email:</strong> ${t.billing_email || '—'}<br>
          ${t.notes ? `<strong style="color:var(--tx)">Notes:</strong> ${t.notes}` : ''}
        </div>
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:8px">Plan Features</div>
        <div style="font-size:13px;color:var(--tx2)">
          ${planFeat.length ? planFeat.map(f => `<div>• ${f}</div>`).join('') : '<div style="color:var(--tx3)">—</div>'}
        </div>
      </div>
    </div>

    <!-- Edit tenant -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:8px">Edit Plan / Status</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px">
      <select id="td-plan" style="font-size:13px">
        ${['starter','growth','pro','agency'].map(p => `<option value="${p}" ${t.plan===p?'selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('')}
      </select>
      <select id="td-status" style="font-size:13px">
        ${['pending','active','suspended','cancelled'].map(s => `<option value="${s}" ${t.status===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <input type="text" id="td-fee" value="${t.monthly_fee || 0}" placeholder="Monthly Fee" style="font-size:13px">
      <button class="btn btn-amber btn-sm" onclick="saveTenantDetail(${t.id})">Save Changes</button>
    </div>

    ${d.members?.length ? `
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:8px;margin-top:16px">Team Members</div>
    <div class="tbl-wrap" style="margin-bottom:12px">
      <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th></tr></thead>
      <tbody>${d.members.map(m => `<tr>
        <td>${m.name || '—'}</td><td style="color:var(--tx3)">${m.email}</td>
        <td><span class="team-role ${m.role}">${m.role}</span></td>
        <td style="color:var(--tx3)">${m.last_login ? new Date(m.last_login).toLocaleDateString() : 'Never'}</td>
      </tr>`).join('')}</tbody></table>
    </div>` : ''}

    ${d.invitations?.length ? `
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:8px">Invitations</div>
    <div class="tbl-wrap">
      <table><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Sent</th><th>Expires</th></tr></thead>
      <tbody>${d.invitations.map(i => `<tr>
        <td>${i.email}</td>
        <td><span class="team-role ${i.role}">${i.role}</span></td>
        <td><span class="team-inv-status ${i.status}">${i.status}</span></td>
        <td style="color:var(--tx3)">${new Date(i.invited_at).toLocaleDateString()}</td>
        <td style="color:var(--tx3)">${new Date(i.expires_at).toLocaleDateString()}</td>
      </tr>`).join('')}</tbody></table>
    </div>` : ''}

    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-amber btn-sm" onclick="impersonateTenant(${t.id})">👁️ View as ${t.company_name}</button>
    </div>`;
}

function hideTenantDetail() {
  document.getElementById('tn-detail-card').style.display = 'none';
}

async function saveTenantDetail(id) {
  const plan   = document.getElementById('td-plan')?.value;
  const status = document.getElementById('td-status')?.value;
  const fee    = Number(document.getElementById('td-fee')?.value || 0);
  const t      = _tnTenants.find(t => t.id === id);
  if (!t) return;
  const r = await fetch(`/api/tenants/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
    body: JSON.stringify({ plan, status, monthly_fee: fee, max_domains: t.max_domains, max_users: t.max_users, notes: t.notes })
  });
  const d = await r.json();
  if (d.success) { toast('Tenant updated ✓', 'success'); loadTenants(); }
  else toast(d.error || 'Update failed', 'error');
}

async function showInviteModal() {
  const card = document.getElementById('tn-invite-card');
  if (!card) return;

  // Show the modal IMMEDIATELY — never block on async plan loading
  ['tn-f-name','tn-f-email','tn-f-fee','tn-f-maxd','tn-f-maxu','tn-f-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const resEl = document.getElementById('tn-invite-result');
  const errEl = document.getElementById('tn-invite-error');
  if (resEl) resEl.style.display = 'none';
  if (errEl) errEl.style.display = 'none';
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Load subscription plans async (modal is already visible)
  if (!_tnPlans.length) {
    try {
      const r = await fetch('/api/subscription-plans');
      const d = await r.json();
      _tnPlans = d.plans || [];
      const sel = document.getElementById('tn-f-plan');
      if (sel && _tnPlans.length) {
        sel.innerHTML = '<option value="">— Select Plan —</option>' +
          _tnPlans.map(p => `<option value="${p.name.toLowerCase()}" data-fee="${p.price_monthly}" data-maxd="${p.max_domains}" data-maxu="${p.max_users}">${p.name} — $${p.price_monthly}/mo</option>`).join('');
      }
    } catch (e) {
      const sel = document.getElementById('tn-f-plan');
      if (sel) sel.innerHTML = '<option value="">— Could not load plans —</option>';
    }
  }
}

function hideInviteModal() {
  document.getElementById('tn-invite-card').style.display = 'none';
}

function tnPlanChanged() {
  const sel = document.getElementById('tn-f-plan');
  const opt = sel?.selectedOptions[0];
  if (!opt || !opt.dataset.fee) return;
  document.getElementById('tn-f-fee').value  = opt.dataset.fee;
  document.getElementById('tn-f-maxd').value = opt.dataset.maxd;
  document.getElementById('tn-f-maxu').value = opt.dataset.maxu;
}

async function sendTenantInvite() {
  const name  = document.getElementById('tn-f-name').value.trim();
  const email = document.getElementById('tn-f-email').value.trim();
  const plan  = document.getElementById('tn-f-plan').value;
  const fee   = document.getElementById('tn-f-fee').value;
  const maxd  = document.getElementById('tn-f-maxd').value;
  const maxu  = document.getElementById('tn-f-maxu').value;
  const notes = document.getElementById('tn-f-notes').value.trim();
  const errEl  = document.getElementById('tn-invite-error');
  const resEl  = document.getElementById('tn-invite-result');

  errEl.style.display = 'none';
  resEl.style.display = 'none';

  if (!name || !email) { errEl.textContent = 'Company name and billing email are required.'; errEl.style.display = 'block'; return; }

  const r = await fetch('/api/tenants/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
    body: JSON.stringify({ company_name: name, billing_email: email, plan: plan || 'starter', monthly_fee: fee ? Number(fee) : null, max_domains: maxd ? Number(maxd) : null, max_users: maxu ? Number(maxu) : null, notes: notes || null })
  });
  const d = await r.json();

  if (!r.ok || !d.success) { errEl.textContent = d.error || 'Invite failed'; errEl.style.display = 'block'; return; }

  resEl.innerHTML = `✅ ${d.message}${!d.email_sent ? `<div class="invite-url-box">${d.invite_url}</div>` : ''}`;
  resEl.style.display = 'block';
  loadTenants();
}

async function impersonateTenant(tenantId) {
  const r = await fetch(`/api/tenants/${tenantId}/impersonate`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${getStoredToken()}` }
  });
  const d = await r.json();
  if (!r.ok || !d.success) { toast(d.error || 'Impersonation failed', 'error'); return; }

  toast(`Now viewing as ${d.impersonating}`, 'success');
  // Store impersonation info for banner display after reload
  sessionStorage.setItem('slm_impersonating', JSON.stringify({ name: d.impersonating, company: d.company_name }));
  // Reload app as impersonated user
  setTimeout(() => { location.reload(); }, 800);
}

async function exitImpersonation() {
  const r = await fetch('/api/auth/exit-impersonate', {
    method: 'POST', headers: { 'Authorization': `Bearer ${getStoredToken()}` }
  });
  const d = await r.json();
  if (d.success) {
    sessionStorage.removeItem('slm_impersonating');
    toast('Exited impersonation', 'success');
    setTimeout(() => { location.reload(); }, 600);
  } else {
    toast(d.error || 'Exit failed', 'error');
  }
}

// ── SETTINGS / TEAM ───────────────────────────────────────────────────────

async function loadTeam() {
  const tbody = document.getElementById('team-members-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="color:var(--tx3);text-align:center;padding:24px">Loading…</td></tr>';

  const r = await fetch('/api/team', { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
  const d = await r.json();
  if (!r.ok) { tbody.innerHTML = `<tr><td colspan="5" style="color:#f87171;padding:20px">${d.error || 'Load failed'}</td></tr>`; return; }

  const members = d.members || [];
  if (!members.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--tx3);text-align:center;padding:24px">No team members yet.</td></tr>';
  } else {
    tbody.innerHTML = members.map(m => `<tr>
      <td><strong>${m.name || '—'}</strong></td>
      <td style="color:var(--tx3)">${m.email}</td>
      <td><span class="team-role ${m.role}">${m.role}</span></td>
      <td><span style="color:${m.active ? '#4ade80' : '#f87171'}">${m.active ? 'Active' : 'Inactive'}</span></td>
      <td style="color:var(--tx3)">${m.last_login ? new Date(m.last_login).toLocaleDateString() : 'Never'}</td>
    </tr>`).join('');
  }

  // Show pending invitations
  const invitations = d.invitations || [];
  const invSection  = document.getElementById('team-invitations-section');
  const invBody     = document.getElementById('team-invitations-body');
  if (invitations.filter(i => i.status === 'pending').length > 0 && invSection && invBody) {
    invSection.style.display = 'block';
    invBody.innerHTML = invitations.filter(i => i.status === 'pending').map(i => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd);font-size:13px">
        <div style="flex:1">${i.email}</div>
        <span class="team-role ${i.role}">${i.role}</span>
        <span class="team-inv-status pending">pending</span>
        <span style="color:var(--tx3);font-size:12px">Expires ${new Date(i.expires_at).toLocaleDateString()}</span>
      </div>`).join('');
  }

  // Show account info
  const accountEl = document.getElementById('settings-account-info');
  if (accountEl && currentUser) {
    accountEl.innerHTML = `
      <strong>Name:</strong> ${currentUser.name || '—'}<br>
      <strong>Email:</strong> ${currentUser.email}<br>
      <strong>Role:</strong> <span class="team-role ${currentUser.role}">${currentUser.role}</span>
    `;
  }
}

function showStaffInviteForm() {
  document.getElementById('staff-invite-card').style.display = 'block';
  document.getElementById('staff-f-email').value = '';
  document.getElementById('staff-invite-result').style.display = 'none';
  document.getElementById('staff-invite-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideStaffInviteForm() {
  document.getElementById('staff-invite-card').style.display = 'none';
}

async function sendStaffInvite() {
  const email = document.getElementById('staff-f-email').value.trim();
  const role  = document.getElementById('staff-f-role').value;
  const resEl = document.getElementById('staff-invite-result');

  if (!email) { toast('Email is required', 'error'); return; }

  const r = await fetch('/api/team/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
    body: JSON.stringify({ email, role })
  });
  const d = await r.json();

  if (!r.ok || !d.success) {
    resEl.className = 'error-box';
    resEl.textContent = d.error || 'Invite failed';
  } else {
    resEl.className = 'success-box';
    resEl.innerHTML = `✅ ${d.message}${!d.email_sent ? `<div class="invite-url-box">${d.invite_url}</div>` : ''}`;
    loadTeam();
  }
  resEl.style.display = 'block';
}

// ── TOAST ─────────────────────────────────────────────────────────────────

let _toastTimer;
function toast(msg, type) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); document.body.appendChild(t); }
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
}

// ── DATA PERMISSION GATE ───────────────────────────────────────────────────

async function checkPermissionStatus() {
  try {
    const r = await fetch('/api/permissions/status', { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
    const d = await r.json();
    if (d.permission_granted && !d.revoked_at) return; // authorized — all good
    // Not yet granted or revoked — show gate or amber banner
    if (sessionStorage.getItem('slm_perm_review_later')) {
      showPermBanner(); // user previously chose "Review Later"
    } else {
      showPermissionGate();
    }
  } catch (e) { /* ignore — never block UI on permission check failure */ }
}

function showPermissionGate() {
  const gate = document.getElementById('permission-gate');
  const errEl = document.getElementById('perm-error');
  if (gate) gate.style.display = 'block';
  if (errEl) errEl.style.display = 'none';
}

function hidePermissionGate() {
  const gate = document.getElementById('permission-gate');
  if (gate) gate.style.display = 'none';
}

function showPermBanner() {
  const b = document.getElementById('perm-banner');
  if (b) { b.style.display = 'block'; document.body.classList.add('perm-pending'); }
}

function hidePermBanner() {
  const b = document.getElementById('perm-banner');
  if (b) { b.style.display = 'none'; document.body.classList.remove('perm-pending'); }
}

async function grantDataPermission() {
  const errEl = document.getElementById('perm-error');
  const btn   = document.querySelector('.perm-agree-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Authorizing…'; }
  try {
    const r = await fetch('/api/permissions/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` }
    });
    const d = await r.json();
    if (!r.ok) {
      if (errEl) { errEl.textContent = d.error || 'Authorization failed — try again'; errEl.style.display = 'block'; }
      if (btn) { btn.disabled = false; btn.textContent = '✅ I Authorize Data Usage'; }
      return;
    }
    sessionStorage.removeItem('slm_perm_review_later');
    hidePermissionGate();
    hidePermBanner();
    toast('✅ Data usage authorized — now scan your website to complete setup', 'success');
    // Take company_admin to Brand Profile to scan their website
    showSection('brand-profile');
  } catch (e) {
    if (errEl) { errEl.textContent = 'Request failed — check your connection and try again'; errEl.style.display = 'block'; }
    if (btn) { btn.disabled = false; btn.textContent = '✅ I Authorize Data Usage'; }
  }
}

function reviewDataPermissionLater() {
  sessionStorage.setItem('slm_perm_review_later', '1');
  hidePermissionGate();
  showPermBanner();
  toast('⚠️ Content generation disabled until you authorize data usage', 'warning');
}

async function revokeDataPermission() {
  if (!confirm('Revoke authorization? Content generation will be disabled immediately until you re-authorize.')) return;
  try {
    const r = await fetch('/api/permissions/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
      body: JSON.stringify({ reason: 'User requested revocation via Settings' })
    });
    const d = await r.json();
    if (d.success) {
      toast('🔒 Authorization revoked — content generation disabled', 'warning');
      showPermBanner();
      loadDataPrivacy();
    } else {
      toast(d.error || 'Revoke failed', 'error');
    }
  } catch (e) { toast('Request failed', 'error'); }
}

async function downloadMyData() {
  try {
    const r = await fetch('/api/permissions/download', { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
    if (!r.ok) { toast('Export failed', 'error'); return; }
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'slm-hub-data-export.json'; a.click();
    URL.revokeObjectURL(url);
    toast('⬇️ Data export downloaded', 'success');
  } catch (e) { toast('Download failed', 'error'); }
}

// ── DATA & PRIVACY SETTINGS ────────────────────────────────────────────────

async function loadDataPrivacy() {
  const card     = document.getElementById('settings-dataprivacy-card');
  const statusEl = document.getElementById('dataprivacy-status');
  const actionsEl= document.getElementById('dataprivacy-actions');
  if (!card) return;
  if (!currentUser || currentUser.role !== 'company_admin') { card.style.display = 'none'; return; }
  card.style.display = '';
  if (statusEl) statusEl.innerHTML = 'Loading…';
  if (actionsEl) actionsEl.innerHTML = '';

  try {
    const r = await fetch('/api/permissions/status', { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
    const d = await r.json();

    const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-CA', { year:'numeric', month:'short', day:'numeric' }) : '—';

    if (d.permission_granted && !d.revoked_at) {
      statusEl.innerHTML = `
        <div style="color:var(--green);font-weight:700;margin-bottom:6px">✅ Data usage authorized</div>
        <div>Authorized: ${fmtDate(d.granted_at)}</div>
        <div>Disclaimer version: ${d.disclaimer_version || 'v1.0'}</div>
        <div>Last scan: ${fmtDate(d.scraped_at)}</div>
        <div>Scrape status: <strong style="color:${d.scrape_status==='completed'?'var(--green)':'var(--amber)'}">${d.scrape_status || 'not scanned'}</strong></div>
        ${d.rescan_due ? '<div style="color:var(--amber);margin-top:4px">⚠️ Brand data is over 30 days old — re-scan recommended</div>' : ''}
      `;
      actionsEl.innerHTML = `
        <button class="btn btn-sec btn-sm" onclick="showSection('brand-profile')">🎨 View Brand Profile</button>
        <button class="btn btn-danger btn-sm" onclick="revokeDataPermission()">🔒 Revoke Authorization</button>
        <button class="btn btn-sec btn-sm" onclick="downloadMyData()">⬇️ Download My Data (GDPR)</button>
      `;
    } else if (d.revoked_at) {
      statusEl.innerHTML = `
        <div style="color:#f87171;font-weight:700;margin-bottom:6px">🔒 Authorization revoked (${fmtDate(d.revoked_at)})</div>
        <div style="color:var(--tx3)">Content generation is disabled. Re-authorize to resume.</div>
      `;
      actionsEl.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="showPermissionGate()">🔓 Re-authorize Now</button>
        <button class="btn btn-sec btn-sm" onclick="downloadMyData()">⬇️ Download My Data (GDPR)</button>
      `;
    } else {
      statusEl.innerHTML = `
        <div style="color:var(--amber);font-weight:700;margin-bottom:6px">⚠️ Authorization not granted</div>
        <div style="color:var(--tx3)">Content generation is disabled until you authorize data usage.</div>
      `;
      actionsEl.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="showPermissionGate()">🔓 Authorize Now</button>
      `;
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Failed to load permission status — refresh to try again';
  }
}

// ── BRAND PROFILE ──────────────────────────────────────────────────────────

let _brandServices = [];
let _brandColors   = [];

async function loadBrandProfile() {
  const scraperCard    = document.getElementById('scraper-card');
  const profileCard    = document.getElementById('brand-profile-card');
  const scraperResult  = document.getElementById('scraper-result');
  if (!scraperCard || !profileCard) return;

  try {
    const r = await fetch('/api/scraper/brand-profile', { headers: { 'Authorization': `Bearer ${getStoredToken()}` } });
    const d = await r.json();
    if (d.profile && d.profile.scrape_status === 'completed') {
      _populateBrandProfileCard(d.profile);
      scraperCard.style.display   = 'none';
      profileCard.style.display   = '';
      if (d.rescan_due && scraperResult) {
        scraperResult.className     = 'scraper-msg info';
        scraperResult.textContent   = '🔄 Brand data is over 30 days old — consider re-scanning for fresh content.';
        scraperResult.style.display = 'block';
        scraperCard.style.display   = '';
        // pre-fill URL
        const urlInput = document.getElementById('scraper-url');
        if (urlInput && d.profile.website_url) urlInput.value = d.profile.website_url;
      }
    } else if (d.profile) {
      // Profile exists but not completed — show scraper with pre-filled URL
      profileCard.style.display = 'none';
      scraperCard.style.display = '';
      const urlInput = document.getElementById('scraper-url');
      if (urlInput && d.profile.website_url) urlInput.value = d.profile.website_url;
    } else {
      scraperCard.style.display = '';
      profileCard.style.display = 'none';
    }
  } catch (e) {
    if (scraperResult) {
      scraperResult.className = 'scraper-msg error';
      scraperResult.textContent = 'Failed to load brand profile — ' + (e.message || 'unknown error');
      scraperResult.style.display = 'block';
    }
  }
}

function _populateBrandProfileCard(profile) {
  // Colors
  _brandColors = Array.isArray(profile.brand_colors) ? [...profile.brand_colors] : [];
  _renderBrandColors();

  // Contact
  const ci = profile.contact_info || {};
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setVal('brand-phone',   ci.phone   || '');
  setVal('brand-email',   ci.email   || '');
  setVal('brand-address', ci.address || '');

  // Services
  _brandServices = Array.isArray(profile.services) ? [...profile.services] : [];
  _renderBrandServices();

  // Tone
  const toneEl = document.getElementById('brand-tone');
  if (toneEl && profile.tone_of_voice) toneEl.value = profile.tone_of_voice;

  // Tagline
  setVal('brand-tagline', profile.tagline || '');

  // Logo
  setVal('brand-logo', profile.logo_url || '');
  previewBrandLogo();

  // Social links
  const sl = profile.social_links || {};
  setVal('brand-facebook',  sl.facebook  || '');
  setVal('brand-instagram', sl.instagram || '');
  setVal('brand-linkedin',  sl.linkedin  || '');
  setVal('brand-youtube',   sl.youtube   || '');
}

function _renderBrandColors() {
  const row = document.getElementById('brand-colors-row');
  if (!row) return;
  row.innerHTML = '';
  _brandColors.forEach((hex, i) => {
    const div = document.createElement('div');
    div.className = 'brand-color-swatch';
    div.style.background = hex;
    div.title = hex;
    const picker = document.createElement('input');
    picker.type = 'color'; picker.value = hex;
    picker.oninput = (e) => {
      _brandColors[i] = e.target.value.toUpperCase();
      div.style.background = _brandColors[i];
    };
    div.appendChild(picker);
    row.appendChild(div);
  });
  // Add button (max 4 colors)
  if (_brandColors.length < 4) {
    const add = document.createElement('button');
    add.className = 'brand-color-add'; add.textContent = '+';
    add.onclick = () => { _brandColors.push('#60a5fa'); _renderBrandColors(); };
    row.appendChild(add);
  }
}

function _renderBrandServices() {
  const container = document.getElementById('brand-services-tags');
  if (!container) return;
  container.innerHTML = '';
  _brandServices.forEach((svc, i) => {
    const span = document.createElement('span');
    span.className = 'brand-service-tag';
    span.innerHTML = `${svc} <button onclick="removeBrandService(${i})" title="Remove">✕</button>`;
    container.appendChild(span);
  });
}

function addBrandService(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const input = document.getElementById('brand-services-input');
  if (!input) return;
  const val = input.value.trim();
  if (val && !_brandServices.includes(val)) {
    _brandServices.push(val);
    _renderBrandServices();
  }
  input.value = '';
}

function removeBrandService(index) {
  _brandServices.splice(index, 1);
  _renderBrandServices();
}

function previewBrandLogo() {
  const url     = (document.getElementById('brand-logo') || {}).value || '';
  const preview = document.getElementById('brand-logo-preview');
  if (!preview) return;
  if (url) { preview.src = url; preview.style.display = ''; preview.onerror = () => { preview.style.display = 'none'; }; }
  else preview.style.display = 'none';
}

function showManualBrandEntry() {
  const profileCard = document.getElementById('brand-profile-card');
  if (profileCard) {
    _brandServices = []; _brandColors = [];
    _renderBrandColors(); _renderBrandServices();
    profileCard.style.display = '';
  }
}

async function startScraper() {
  const urlInput    = document.getElementById('scraper-url');
  const btn         = document.getElementById('scraper-btn');
  const progress    = document.getElementById('scraper-progress');
  const resultEl    = document.getElementById('scraper-result');
  const profileCard = document.getElementById('brand-profile-card');

  if (!urlInput || !urlInput.value.trim()) { toast('Enter your website URL first', 'warning'); return; }

  if (btn)      { btn.disabled = true; btn.textContent = '⏳ Scanning…'; }
  if (progress) progress.style.display = 'block';
  if (resultEl) resultEl.style.display = 'none';

  try {
    const r = await fetch('/api/scraper/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
      body: JSON.stringify({ website_url: urlInput.value.trim() })
    });
    const d = await r.json();

    if (!r.ok) {
      if (resultEl) {
        resultEl.className = 'scraper-msg error';
        resultEl.innerHTML = `❌ ${d.error || 'Scan failed'}${d.code === 'PERMISSION_REQUIRED' ? ' — <a onclick="showPermissionGate()">Authorize first →</a>' : ''}<br><small style="color:var(--tx3)">Try manual entry below.</small>`;
        resultEl.style.display = 'block';
      }
      return;
    }

    // Success — populate brand profile card
    const profile = {
      brand_colors: d.brand_colors || [],
      contact_info: { phone: d.phone || '', email: d.email || '', address: '' },
      services:     d.services     || [],
      tone_of_voice:d.tone_of_voice|| 'professional',
      tagline:      d.tagline      || '',
      logo_url:     d.logo_url     || '',
      social_links: d.social_links || {}
    };
    _populateBrandProfileCard(profile);
    if (profileCard) profileCard.style.display = '';
    if (resultEl) {
      resultEl.className = 'scraper-msg success';
      resultEl.textContent = `✅ Scan complete — ${d.services?.length || 0} services, ${d.brand_colors?.length || 0} colors, tone: ${d.tone_of_voice}. Review and save below.`;
      resultEl.style.display = 'block';
    }
    toast('✅ Website scanned successfully', 'success');
  } catch (e) {
    if (resultEl) {
      resultEl.className = 'scraper-msg error';
      resultEl.textContent = 'Scan failed: ' + (e.message || 'network error');
      resultEl.style.display = 'block';
    }
  } finally {
    if (btn)      { btn.disabled = false; btn.textContent = '🔍 Scan Website'; }
    if (progress) progress.style.display = 'none';
  }
}

async function saveBrandProfile() {
  const resultEl = document.getElementById('brand-save-result');
  const getVal   = (id) => (document.getElementById(id) || {}).value || '';

  const payload = {
    website_url:   getVal('scraper-url') || '',
    phone:         getVal('brand-phone'),
    email:         getVal('brand-email'),
    address:       getVal('brand-address'),
    services:      _brandServices,
    tone_of_voice: getVal('brand-tone'),
    tagline:       getVal('brand-tagline'),
    logo_url:      getVal('brand-logo'),
    brand_colors:  _brandColors,
    social_links: {
      facebook:  getVal('brand-facebook')  || undefined,
      instagram: getVal('brand-instagram') || undefined,
      linkedin:  getVal('brand-linkedin')  || undefined,
      youtube:   getVal('brand-youtube')   || undefined
    }
  };
  // Remove empty social links
  Object.keys(payload.social_links).forEach(k => { if (!payload.social_links[k]) delete payload.social_links[k]; });

  try {
    const r = await fetch('/api/scraper/brand-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getStoredToken()}` },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (d.success) {
      if (resultEl) {
        resultEl.className = 'scraper-msg success';
        resultEl.textContent = '✅ Brand profile saved successfully';
        resultEl.style.display = 'block';
        setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; }, 3000);
      }
      toast('✅ Brand profile saved', 'success');
    } else {
      if (resultEl) {
        resultEl.className = 'scraper-msg error';
        resultEl.textContent = d.error || 'Save failed';
        resultEl.style.display = 'block';
      }
    }
  } catch (e) {
    toast('Save failed: ' + (e.message || 'error'), 'error');
  }
}

async function confirmBrandProfile() {
  await saveBrandProfile();
  toast('🎉 Brand profile confirmed — you can now generate content!', 'success');
  showSection('landing');
}

// ── COMPETITOR INTELLIGENCE ────────────────────────────────────────────────

function _esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadIntel() {
  await Promise.all([loadBudgetMeter(), loadIntelCompetitors()]);
}

async function loadBudgetMeter() {
  const wrap = document.getElementById('intel-budget-wrap');
  if (!wrap) return;
  try {
    const r = await fetch('/api/intel/budget', {
      headers: { Authorization: `Bearer ${getStoredToken()}` }
    });
    const d = await r.json();
    const usage = d.monthly_usage || 0;
    const limit = d.limit || 250;
    const pct = Math.min(100, (usage / limit) * 100).toFixed(1);
    const fillClass = usage >= 230 ? 'danger' : usage >= 200 ? 'warn' : '';
    const credits = d.account ? d.account.plan_searches_left : null;
    const creditLine = credits !== null
      ? `<span>${credits} SerpAPI plan credits remaining</span>`
      : '';
    const warnLine = d.warning
      ? `<div class="budget-warn-msg">⚠️ ${_esc(d.warning)}</div>`
      : '';
    wrap.innerHTML = `
      <div class="budget-bar-wrap">
        <div class="budget-bar-label">
          <span>Monthly Usage: <strong>${usage} / ${limit}</strong> searches used</span>
          ${creditLine}
        </div>
        <div class="budget-bar">
          <div class="budget-bar-fill ${fillClass}" style="width:${pct}%"></div>
        </div>
        ${warnLine}
      </div>`;
  } catch (e) {
    if (wrap) wrap.innerHTML = '<p style="color:var(--tx3);font-size:13px">Could not load budget.</p>';
  }
}

async function loadIntelCompetitors() {
  const listEl = document.getElementById('intel-competitors-list');
  if (!listEl) return;
  listEl.innerHTML = '<p style="color:var(--tx3);font-size:13px">Loading…</p>';
  try {
    const r = await fetch('/api/intel/competitors', {
      headers: { Authorization: `Bearer ${getStoredToken()}` }
    });
    const d = await r.json();
    if (!d.competitors || d.competitors.length === 0) {
      listEl.innerHTML = '<p style="color:var(--tx3);font-size:13px">No competitors tracked yet. Add one above.</p>';
      return;
    }
    listEl.innerHTML = d.competitors.map(c => {
      const keywords = (() => { try { return JSON.parse(c.serp_keywords || '[]'); } catch { return []; } })();
      const kwPreview = keywords.length
        ? keywords.slice(0, 3).join(', ') + (keywords.length > 3 ? ` +${keywords.length - 3} more` : '')
        : 'No keywords set';
      const badgeClass = c.scan_status === 'done'
        ? 'scan-badge-done'
        : c.scan_status === 'scanning'
          ? 'scan-badge-scanning'
          : 'scan-badge-pending';
      const badgeText = c.scan_status === 'done'
        ? '✓ Scanned'
        : c.scan_status === 'scanning'
          ? '⏳ Scanning…'
          : '○ Pending';
      const lastScan = c.last_scanned
        ? new Date(c.last_scanned).toLocaleDateString()
        : 'Never';
      const resultsBtn = c.scan_status === 'done'
        ? `<button class="btn btn-sec btn-sm" onclick="showCompetitorResults(${c.id})">📊 Results</button>`
        : '';
      return `
        <div class="competitor-row" id="comp-row-${c.id}">
          <div class="competitor-meta">
            <div class="competitor-name">${_esc(c.competitor_name)}</div>
            <div class="competitor-domain">
              ${_esc(c.website_url || '')}
              ${c.territory ? '· ' + _esc(c.territory) : ''}
              · ${_esc(kwPreview)}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap">
            <span class="competitor-scan-badge ${badgeClass}">${badgeText}</span>
            <span style="font-size:11px;color:var(--tx3)">Last: ${lastScan}</span>
            <button class="btn btn-primary btn-sm" id="scan-btn-${c.id}" onclick="scanCompetitor(${c.id})">🔍 Scan</button>
            ${resultsBtn}
            <button class="btn btn-sec btn-sm" style="color:#f87171" onclick="deleteCompetitor(${c.id})" title="Delete competitor">🗑</button>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    if (listEl) listEl.innerHTML = '<p style="color:var(--tx3);font-size:13px">Error loading competitors.</p>';
  }
}

async function addCompetitor() {
  const nameEl    = document.getElementById('intel-comp-name');
  const urlEl     = document.getElementById('intel-comp-url');
  const cityEl    = document.getElementById('intel-comp-city');
  const nicheEl   = document.getElementById('intel-comp-niche');
  const kwEl      = document.getElementById('intel-comp-keywords');
  const resultEl  = document.getElementById('intel-add-result');
  const btn       = document.getElementById('intel-add-btn');

  const name = nameEl?.value.trim();
  const url  = urlEl?.value.trim();
  const city = cityEl?.value.trim();
  const niche = nicheEl?.value.trim();
  const kwRaw = kwEl?.value.trim();

  if (!name || !url) {
    if (resultEl) {
      resultEl.className = 'scraper-msg error';
      resultEl.textContent = 'Competitor name and website URL are required.';
      resultEl.style.display = 'block';
    }
    return;
  }

  const keywords = kwRaw ? kwRaw.split('\n').map(k => k.trim()).filter(Boolean) : [];
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
  if (resultEl) resultEl.style.display = 'none';

  try {
    const r = await fetch('/api/intel/competitors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getStoredToken()}`
      },
      body: JSON.stringify({
        competitor_name: name,
        website_url:     url,
        territory:       city,
        niche,
        serp_keywords:   keywords
      })
    });
    const d = await r.json();
    if (d.id || d.success) {
      if (resultEl) {
        resultEl.className = 'scraper-msg success';
        resultEl.textContent = `✅ ${name} added successfully.`;
        resultEl.style.display = 'block';
      }
      if (nameEl)  nameEl.value  = '';
      if (urlEl)   urlEl.value   = '';
      if (cityEl)  cityEl.value  = '';
      if (nicheEl) nicheEl.value = '';
      if (kwEl)    kwEl.value    = '';
      loadIntelCompetitors();
    } else {
      if (resultEl) {
        resultEl.className = 'scraper-msg error';
        resultEl.textContent = d.error || 'Failed to add competitor.';
        resultEl.style.display = 'block';
      }
    }
  } catch (e) {
    if (resultEl) {
      resultEl.className = 'scraper-msg error';
      resultEl.textContent = 'Error: ' + (e.message || 'unknown error');
      resultEl.style.display = 'block';
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '➕ Add Competitor'; }
  }
}

async function deleteCompetitor(id) {
  if (!confirm('Delete this competitor and all their scan history? This cannot be undone.')) return;
  try {
    const r = await fetch(`/api/intel/competitors/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getStoredToken()}` }
    });
    const d = await r.json();
    if (d.success) {
      toast('Competitor deleted', 'success');
      document.getElementById('intel-results-panel')?.style.setProperty('display', 'none');
      loadIntelCompetitors();
    } else {
      toast(d.error || 'Delete failed', 'error');
    }
  } catch (e) {
    toast('Delete failed: ' + (e.message || 'error'), 'error');
  }
}

async function scanCompetitor(id) {
  const btn = document.getElementById(`scan-btn-${id}`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Scanning…'; }

  try {
    const r = await fetch('/api/intel/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getStoredToken()}`
      },
      body: JSON.stringify({ competitor_id: id })
    });
    const d = await r.json();

    if (r.status === 429) {
      toast('⚠️ ' + (d.error || 'SerpAPI budget limit reached'), 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🔍 Scan'; }
      return;
    }
    if (d.error && !d.scans) {
      toast(d.error || 'Scan failed', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🔍 Scan'; }
      return;
    }

    const cached = d.cached ? ' (cached)' : '';
    const budgetNote = d.budget_warning ? ` ⚠️ ${d.budget_warning}` : '';
    toast(`✅ Scan complete${cached}${budgetNote}`, 'success');
    await loadBudgetMeter();
    await loadIntelCompetitors();
    showCompetitorResults(id);
  } catch (e) {
    toast('Scan error: ' + (e.message || 'unknown'), 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Scan'; }
  }
}

async function showCompetitorResults(id) {
  const panel   = document.getElementById('intel-results-panel');
  const body    = document.getElementById('intel-results-body');
  const titleEl = document.getElementById('intel-results-title');
  if (!panel || !body) return;

  body.innerHTML = '<p style="color:var(--tx3);font-size:13px">Loading results…</p>';
  panel.style.display = '';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const r = await fetch(`/api/intel/results/${id}`, {
      headers: { Authorization: `Bearer ${getStoredToken()}` }
    });
    const d = await r.json();

    if (titleEl) {
      titleEl.textContent = `Scan Results — ${d.competitor?.competitor_name || 'Competitor'}`;
    }

    if (!d.scans || d.scans.length === 0) {
      body.innerHTML = '<p style="color:var(--tx3);font-size:13px">No scan data yet. Run a scan first.</p>';
      return;
    }

    // Latest scan per keyword
    const byKw = {};
    d.scans.forEach(s => {
      if (!byKw[s.keyword] || s.scanned_at > byKw[s.keyword].scanned_at) byKw[s.keyword] = s;
    });

    const cards = Object.values(byKw).map(s => {
      const ppcAdv = (() => { try { return JSON.parse(s.ppc_advertisers || '[]'); } catch { return []; } })();
      const lsaAdv = (() => { try { return JSON.parse(s.lsa_advertisers || '[]'); } catch { return []; } })();
      const organic = (() => { try { return JSON.parse(s.organic_top5 || '[]'); } catch { return []; } })();

      const ppcBadge = s.has_ppc
        ? `<span class="intel-badge intel-badge-ppc">PPC ×${s.ppc_count}</span>`
        : '';
      const lsaBadge = s.has_lsa
        ? `<span class="intel-badge intel-badge-lsa">LSA ×${s.lsa_count}</span>`
        : '';
      const noBadge = !s.has_ppc && !s.has_lsa
        ? '<span class="intel-badge intel-badge-none">No Ads</span>'
        : '';
      const ppcPosBadge = s.competitor_ppc_pos
        ? `<span class="intel-badge intel-badge-ppc">Competitor PPC: #${s.competitor_ppc_pos}</span>`
        : '';
      const orgPosBadge = s.competitor_organic_pos
        ? `<span class="intel-badge intel-badge-organic">Competitor Organic: #${s.competitor_organic_pos}</span>`
        : '';

      const advLine  = ppcAdv.length  ? `<div style="font-size:11px;color:var(--tx3);margin-top:6px">PPC bidders: ${ppcAdv.map(_esc).join(', ')}</div>` : '';
      const lsaLine  = lsaAdv.length  ? `<div style="font-size:11px;color:var(--tx3)">LSA advertisers: ${lsaAdv.map(_esc).join(', ')}</div>` : '';
      const orgLine  = organic.length ? `<div style="font-size:11px;color:var(--tx3);margin-top:4px">Top organic: ${organic.map(o => `#${o.position} ${_esc(o.domain || o.title || '')}`).join(', ')}</div>` : '';
      const dateStr  = new Date(s.scanned_at).toLocaleString();

      return `
        <div class="intel-result-item">
          <div class="intel-result-kw">${_esc(s.keyword)}</div>
          <div>${ppcBadge}${lsaBadge}${noBadge}</div>
          <div style="margin-top:4px">${ppcPosBadge}${orgPosBadge}</div>
          ${advLine}${lsaLine}${orgLine}
          <div style="font-size:11px;color:var(--tx3);margin-top:6px">Scanned: ${dateStr}</div>
        </div>`;
    }).join('');

    body.innerHTML = `<div class="intel-result-grid">${cards}</div>`;
  } catch (e) {
    if (body) body.innerHTML = '<p style="color:var(--tx3);font-size:13px">Error loading results.</p>';
  }
}

function closeIntelResults() {
  const panel = document.getElementById('intel-results-panel');
  if (panel) panel.style.display = 'none';
}

// ── BUSINESS PROSPECTOR ──────────────────────────────────────────────────────

let _prospectorResults = [];

function loadProspector() {
  loadProspectPipeline();
}

async function searchProspects() {
  const niche   = (document.getElementById('prosp-niche')?.value || '').trim();
  const city    = (document.getElementById('prosp-city')?.value  || '').trim();
  const radius  = parseInt(document.getElementById('prosp-radius')?.value  || '10');
  const bizType = document.getElementById('prosp-biz-type')?.value || '';
  const minRev  = parseInt(document.getElementById('prosp-min-reviews')?.value || '0');

  if (!niche || !city) { toast('Niche and city are required', true); return; }

  const btn     = document.getElementById('prosp-search-btn');
  const msgEl   = document.getElementById('prosp-search-msg');
  const resCard = document.getElementById('prosp-results-card');
  const resEl   = document.getElementById('prosp-results');

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Searching…'; }
  if (msgEl) msgEl.innerHTML = '<p style="color:var(--tx3);font-size:13px">Searching 3 sources (Google Places, Maps, website scrape)… this may take 15–30 seconds.</p>';
  if (resCard) resCard.style.display = 'none';
  if (resEl) resEl.innerHTML = '';

  try {
    const body = { niche, city, radius };
    if (bizType) body.business_type = bizType;
    if (minRev > 0) body.min_reviews = minRev;

    const r = await fetch('/api/prospector/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Search failed');

    _prospectorResults = d.results || [];
    renderProspectResults(_prospectorResults);

    const titleEl = document.getElementById('prosp-results-title');
    if (titleEl) titleEl.textContent = `Search Results (${_prospectorResults.length})`;
    if (resCard) resCard.style.display = '';
    if (msgEl) msgEl.innerHTML = `<p style="color:var(--tx3);font-size:13px">Found ${_prospectorResults.length} business(es). Hot leads are scored highest.</p>`;
  } catch (e) {
    if (msgEl) msgEl.innerHTML = `<p style="color:#f87171;font-size:13px">Search error: ${_esc(e.message)}</p>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Search'; }
  }
}

function renderProspectResults(results) {
  const el = document.getElementById('prosp-results');
  if (!el) return;

  if (!results.length) {
    el.innerHTML = '<p style="color:var(--tx3);font-size:13px;padding:16px 0">No results found. Try a broader niche, different city, or larger radius.</p>';
    return;
  }

  el.innerHTML = results.map((b, i) => {
    const score = b.slm_score || 0;
    const tier  = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
    const emoji = tier === 'hot' ? '🔥' : tier === 'warm' ? '♨️' : '🧊';
    const stars = b.google_rating
      ? `⭐ ${Number(b.google_rating).toFixed(1)} (${b.google_review_count || 0})`
      : 'No rating';
    const websiteHtml = b.website_url
      ? `<a href="${_esc(b.website_url)}" target="_blank" style="color:var(--blue)">${_esc(b.website_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`
      : '<span style="color:#4ade80;font-weight:700">NO WEBSITE ✓</span>';

    const facebookHtml  = b.facebook_url  ? `<a href="${_esc(b.facebook_url)}"  target="_blank" style="color:var(--blue)">${_esc(b.facebook_url)}</a>`  : '<em style="color:var(--tx3)">—</em>';
    const instagramHtml = b.instagram_url ? `<a href="${_esc(b.instagram_url)}" target="_blank" style="color:var(--blue)">${_esc(b.instagram_url)}</a>` : '<em style="color:var(--tx3)">—</em>';
    const linkedinHtml  = b.linkedin_url  ? `<a href="${_esc(b.linkedin_url)}"  target="_blank" style="color:var(--blue)">${_esc(b.linkedin_url)}</a>`  : '<em style="color:var(--tx3)">—</em>';

    return `
      <div class="prosp-row" id="prosp-row-${i}">
        <span class="prosp-score-badge prosp-score-${tier}" style="margin-top:2px">${emoji} ${score}</span>
        <div class="prosp-main">
          <div class="prosp-name">${_esc(b.business_name)}</div>
          <div class="prosp-addr">${_esc(b.address || b.city || '')}</div>
          <div class="prosp-meta">
            <span>${stars}</span>
            ${b.phone ? `<span>📞 ${_esc(b.phone)}</span>` : ''}
            <span>🌐 ${websiteHtml}</span>
          </div>
          <div class="prosp-expand" id="prosp-exp-${i}">
            <div class="prosp-field"><span class="prosp-field-label">Email:</span><span class="prosp-field-val">${b.email ? `<a href="mailto:${_esc(b.email)}" style="color:var(--blue)">${_esc(b.email)}</a>` : '<em style="color:var(--tx3)">Not found</em>'}</span></div>
            <div class="prosp-field"><span class="prosp-field-label">Facebook:</span><span class="prosp-field-val">${facebookHtml}</span></div>
            <div class="prosp-field"><span class="prosp-field-label">Instagram:</span><span class="prosp-field-val">${instagramHtml}</span></div>
            <div class="prosp-field"><span class="prosp-field-label">LinkedIn:</span><span class="prosp-field-val">${linkedinHtml}</span></div>
            <div class="prosp-field"><span class="prosp-field-label">Source:</span><span class="prosp-field-val"><span class="prosp-source">${_esc(b.source || 'places')}</span></span></div>
            <div class="btn-row" style="margin-top:10px">
              <button class="btn btn-sm btn-primary" onclick="saveAsProspect(${i})">💼 Save as Prospect</button>
              <button class="btn btn-sm btn-sec"     onclick="saveAsCompetitor(${i})">🕵️ Add as Competitor</button>
              ${b.email ? `<button class="btn btn-sm btn-green" onclick="openOnboardModal(${i})">✅ Onboard Client</button>` : ''}
              ${b.email ? `<button class="btn btn-sm btn-sec"   onclick="_copyToClipboard('${_esc(b.email).replace(/'/g,"\\'")}')">📋 Copy Email</button>` : ''}
            </div>
          </div>
        </div>
        <div class="prosp-actions">
          <button class="btn btn-sm btn-sec" id="prosp-exp-btn-${i}" onclick="toggleProspectExpand(${i})">Details ▾</button>
        </div>
      </div>`;
  }).join('');
}

function toggleProspectExpand(idx) {
  const panel = document.getElementById(`prosp-exp-${idx}`);
  const btn   = document.getElementById(`prosp-exp-btn-${idx}`);
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  if (btn) btn.textContent = isOpen ? 'Details ▾' : 'Details ▴';
}

async function saveAsProspect(idx) {
  const b = _prospectorResults[idx];
  if (!b) return;
  try {
    const r = await fetch('/api/prospector/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
      body: JSON.stringify({ ...b, save_type: 'prospect' })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Save failed');
    toast('✅ Saved to Prospects Pipeline!');
    loadProspectPipeline();
  } catch (e) {
    toast('Save failed: ' + e.message, true);
  }
}

async function saveAsCompetitor(idx) {
  const b = _prospectorResults[idx];
  if (!b) return;
  try {
    const r = await fetch('/api/prospector/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
      body: JSON.stringify({ ...b, save_type: 'competitor' })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Save failed');
    toast('✅ Added to Competitor Intel!');
  } catch (e) {
    toast('Save failed: ' + e.message, true);
  }
}

function openOnboardModal(idx) {
  const b = _prospectorResults[idx];
  if (!b) return;
  // Navigate to Tenants tab and open the invite modal with pre-filled data
  showSection('tenants');
  setTimeout(() => {
    showInviteModal();
    setTimeout(() => {
      const nameEl  = document.getElementById('tn-f-name');
      const emailEl = document.getElementById('tn-f-email');
      const noteEl  = document.getElementById('tn-f-notes');
      if (nameEl)  nameEl.value  = b.business_name || '';
      if (emailEl && b.email) emailEl.value = b.email;
      if (noteEl)  noteEl.value  = [
        b.phone      ? `Phone: ${b.phone}` : '',
        b.address    ? `Address: ${b.address}` : '',
        b.website_url ? `Website: ${b.website_url}` : 'NO WEBSITE',
        `SLM Score: ${b.slm_score || 0}`,
      ].filter(Boolean).join('\n');
    }, 350);
  }, 150);
}

async function loadProspectPipeline() {
  const el = document.getElementById('prosp-pipeline-body');
  if (!el) return;
  el.innerHTML = '<p style="color:var(--tx3);font-size:13px">Loading…</p>';
  try {
    const r = await fetch('/api/prospector/prospects', {
      headers: { Authorization: `Bearer ${getStoredToken()}` }
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Load failed');
    const prospects = d.prospects || [];

    if (!prospects.length) {
      el.innerHTML = '<p style="color:var(--tx3);font-size:13px">No saved prospects yet. Search for businesses above and click <strong>Save as Prospect</strong>.</p>';
      return;
    }

    const rows = prospects.map(p => {
      const score = p.slm_score || 0;
      const tier  = score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold';
      const emoji = tier === 'hot' ? '🔥' : tier === 'warm' ? '♨️' : '🧊';
      const statuses = ['new','contacted','qualified','converted','lost'];
      const opts = statuses.map(s =>
        `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
      ).join('');
      const contactHtml = [
        p.phone ? `📞 ${_esc(p.phone)}` : '',
        p.email ? `✉️ <a href="mailto:${_esc(p.email)}" style="color:var(--blue)">${_esc(p.email)}</a>` : '',
      ].filter(Boolean).join('<br>') || '<span style="color:var(--tx3);font-size:11px">No contact</span>';

      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.03)">
            <div style="font-weight:600;font-size:13px">${_esc(p.business_name)}</div>
            <div style="font-size:11px;color:var(--tx3)">${_esc(p.city || '')}</div>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.03)">
            <span class="prosp-score-badge prosp-score-${tier}">${emoji} ${score}</span>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.03);font-size:12px">${contactHtml}</td>
          <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.03)">
            <select style="font-size:12px;padding:4px 8px;border-radius:6px;border:1px solid var(--bd);background:var(--bg-in);color:var(--tx)" onchange="updateProspectStatus(${p.id}, this.value)">${opts}</select>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.03);white-space:nowrap">
            ${p.email ? `<button class="btn btn-sm btn-sec" onclick="_copyToClipboard('${_esc(p.email).replace(/'/g,"\\'")}')">📋</button> ` : ''}
            <button class="btn btn-sm btn-sec" onclick="deleteProspect(${p.id})" style="color:#f87171" title="Remove">🗑</button>
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--tx3);border-bottom:1px solid var(--bd)">Business</th>
              <th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--tx3);border-bottom:1px solid var(--bd)">Score</th>
              <th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--tx3);border-bottom:1px solid var(--bd)">Contact</th>
              <th style="text-align:left;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--tx3);border-bottom:1px solid var(--bd)">Status</th>
              <th style="padding:8px;border-bottom:1px solid var(--bd)"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) {
    el.innerHTML = `<p style="color:#f87171;font-size:13px">Error: ${_esc(e.message)}</p>`;
  }
}

async function updateProspectStatus(id, status) {
  try {
    const r = await fetch(`/api/prospector/prospects/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
      body: JSON.stringify({ status })
    });
    if (!r.ok) throw new Error('Update failed');
    toast('Status updated');
  } catch (e) {
    toast('Status update failed: ' + e.message, true);
  }
}

async function deleteProspect(id) {
  if (!confirm('Remove this prospect from the pipeline?')) return;
  try {
    const r = await fetch(`/api/prospector/prospects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getStoredToken()}` }
    });
    if (!r.ok) throw new Error('Delete failed');
    toast('Prospect removed');
    loadProspectPipeline();
  } catch (e) {
    toast('Delete failed: ' + e.message, true);
  }
}

async function exportProspects() {
  try {
    const r = await fetch('/api/prospector/export', {
      headers: { Authorization: `Bearer ${getStoredToken()}` }
    });
    if (!r.ok) throw new Error('Export failed');
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    toast('Export failed: ' + e.message, true);
  }
}

function _copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('Copied!')).catch(() => _copyFallback(text));
  } else {
    _copyFallback(text);
  }
}

function _copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity  = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); toast('Copied!'); } catch { toast('Copy failed', true); }
  document.body.removeChild(ta);
}
