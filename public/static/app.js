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
  } catch(e) {
    console.warn('Could not load companies:', e.message);
  }
}

function _populateCompanySelects() {
  ['lp-company', 'ads-company', 'seo-company'].forEach(id => {
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

// ── DOMAINS ───────────────────────────────────────────────────────────────

async function loadDomains() {
  try {
    const r = await fetch('/api/domains');
    const data = await r.json();
    allDomains = data.domains || [];
    renderDomains(allDomains);
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
  tbody.innerHTML = domains.map(d => {
    const cat      = d.category === 'emergency' ? 'pill-emergency' : d.category === 'renovation' ? 'pill-renovation' : 'pill-kitchen';
    const status   = d.status === 'Active' ? 'pill-active' : d.status === 'Building' ? 'pill-building' : 'pill-parked';
    const authOk   = d.authorized === 1 || d.authorized === true;
    const authBadge = authOk
      ? `<span class="pill pill-auth-ok">✓ Auth</span>`
      : `<span class="pill pill-auth-pending">Pending</span>`;
    const genBtns  = authOk
      ? `<button class="qf qf-lp"  onclick="event.stopPropagation();fillLP('${esc(d.domain)}','${esc(d.keyword)}','${esc(d.service)}','${esc(d.co)}')">LP</button>
         <button class="qf qf-ads" onclick="event.stopPropagation();fillAds('${esc(d.domain)}','${esc(d.keyword)}','${esc(d.service)}','${esc(d.co)}')">ADS</button>`
      : '';
    const adminBtn  = isSA
      ? authOk
        ? `<button class="qf qf-revoke" onclick="event.stopPropagation();authorizeDomain(${d.id},'revoke')">Revoke</button>`
        : `<button class="qf qf-auth"   onclick="event.stopPropagation();authorizeDomain(${d.id},'authorize')">✓ Auth</button>`
      : '';
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
  ['lp','ads','seo'].forEach(p => {
    document.getElementById(p+'-domain').value  = domain;
    document.getElementById(p+'-keyword').value = keyword;
    document.getElementById(p+'-service').value = service;
    document.getElementById(p+'-company').value = co;
  });
  showSection('landing');
  toast('Fields filled from: ' + domain);
}

function fillLP(domain, keyword, service, co) {
  document.getElementById('lp-domain').value  = domain;
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

// ── LANDING PAGE GENERATOR ────────────────────────────────────────────────

async function generateLP() {
  const keyword = document.getElementById('lp-keyword').value;
  const service = document.getElementById('lp-service').value;
  const domain  = document.getElementById('lp-domain').value;
  const company = document.getElementById('lp-company').value;
  if (!keyword || !service || !domain) { toast('Fill keyword, service & domain', 'error'); return; }
  document.getElementById('lp-output').textContent = 'Generating…';
  const r = await fetch('/api/generate/landing-page', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({keyword, service, domain, company})
  });
  const d = await r.json();
  lastLpHtml = d.html;
  document.getElementById('lp-output').textContent = d.html;
  toast('Generated for ' + d.brand);
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
