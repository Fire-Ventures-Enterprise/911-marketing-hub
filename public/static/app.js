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
  super_admin:   { bg: 'rgba(217,119,6,0.15)',   color: '#D97706', border: 'rgba(217,119,6,0.3)' },
  company_admin: { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
  manager:       { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80', border: 'rgba(74,222,128,0.25)' },
  staff:         { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: 'rgba(148,163,184,0.25)' }
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
  } catch (e) {
    if (e) window.location.replace('/login');
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
  leads:     'Inbound Leads'
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

  if (id === 'leads')   loadLeads();
  if (id === 'ads')     loadPushHistory();
  if (id === 'publish') initPublishDomains();

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
    const r = await fetch('/api/companies');
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

  const countByKey = {};
  allDomains.forEach(d => { countByKey[d.co] = (countByKey[d.co] || 0) + 1; });

  el.innerHTML = allCompanies.map(co => {
    const accent = co.color_accent || '#CC0000';
    const count  = countByKey[co.key] || 0;
    return `<div class="co-card" style="--ca:${accent}">
      <div class="co-name">${co.name}</div>
      <div class="co-meta">
        ${count} domains &middot; ${co.phone}<br>
        $${co.budget}/day &middot; Target CPA $${co.target_cpa}<br>
        <a href="https://${co.domain}" target="_blank">${co.domain}</a>
      </div>
    </div>`;
  }).join('');
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
  toast(`Generated [${mode.toUpperCase()}] for ` + d.brand);
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
