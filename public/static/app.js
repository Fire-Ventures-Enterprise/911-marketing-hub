// 911 Marketing Hub — app.js v2.0
// Frontend logic for the 7-tab Marketing Hub
// Tab navigation, API calls, generators

let allDomains = [];
let lastLpHtml = '';
let lastAdsCampaign = null;
let lastSeoContent = null;

function showTab(id, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.getElementById('pane-' + id).classList.add('active');
  el.classList.add('active');
  if (id === 'leads') loadLeads();
  if (id === 'ads') loadPushHistory();
  if (id === 'publish') initPublishDomains();
}

// Load domains
async function loadDomains() {
  try {
    const r = await fetch('/api/domains');
    const { domains } = await r.json();
    allDomains = domains;
    renderDomains(domains);
  } catch(e) {
    document.getElementById('domains-tbody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:#71717A;padding:20px">Error loading domains: ' + e.message + '</td></tr>';
  }
}

function renderDomains(domains) {
  const tbody = document.getElementById('domains-tbody');
  if (!domains || !domains.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#71717A;padding:20px">No domains found.</td></tr>';
    return;
  }
  tbody.innerHTML = domains.map(d => {
    const catClass = d.category === 'emergency' ? 'pill-emergency' : d.category === 'renovation' ? 'pill-renovation' : 'pill-kitchen';
    const statusClass = d.status === 'Active' ? 'pill-active' : d.status === 'Building' ? 'pill-building' : 'pill-parked';
    const prioClass = 'p' + d.priority;
    return '<tr onclick="fillFromDomain(\'' + d.domain + '\',\'' + d.keyword + '\',\'' + d.service + '\',\'' + d.co + '\')" style="cursor:pointer">' +
      '<td><strong>' + d.domain + '</strong></td>' +
      '<td style="color:#71717A">' + d.keyword + '</td>' +
      '<td>' + d.service + '</td>' +
      '<td><span class="pill ' + catClass + '">' + d.co + '</span></td>' +
      '<td style="color:#4ade80">$' + d.budget + '/day</td>' +
      '<td><span class="pill ' + statusClass + '">' + d.status + '</span></td>' +
      '<td class="' + prioClass + '">' + d.priority + '</td>' +
      '<td>' +
        '<button class="qf qf-lp" onclick="event.stopPropagation();fillLP(\'' + d.domain + '\',\'' + d.keyword + '\',\'' + d.service + '\',\'' + d.co + '\')">LP</button>' +
        '<button class="qf qf-ads" onclick="event.stopPropagation();fillAds(\'' + d.domain + '\',\'' + d.keyword + '\',\'' + d.service + '\',\'' + d.co + '\')">ADS</button>' +
      '</td></tr>';
  }).join('');
}

function filterDomains(filter, el) {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  let filtered = allDomains;
  if (['emergency','renovation','kitchen'].includes(filter)) {
    filtered = allDomains.filter(d => d.category === filter);
  } else if (filter !== 'all') {
    filtered = allDomains.filter(d => d.status === filter);
  }
  renderDomains(filtered);
}

function fillFromDomain(domain, keyword, service, co) {
  ['lp','ads','seo'].forEach(prefix => {
    document.getElementById(prefix+'-domain').value = domain;
    document.getElementById(prefix+'-keyword').value = keyword;
    document.getElementById(prefix+'-service').value = service;
    document.getElementById(prefix+'-company').value = co;
  });
  showTabByName('landing');
  toast('Fields filled from: ' + domain);
}

function fillLP(domain, keyword, service, co) {
  document.getElementById('lp-domain').value = domain;
  document.getElementById('lp-keyword').value = keyword;
  document.getElementById('lp-service').value = service;
  document.getElementById('lp-company').value = co;
  showTabByName('landing');
}

function fillAds(domain, keyword, service, co) {
  document.getElementById('ads-domain').value = domain;
  document.getElementById('ads-keyword').value = keyword;
  document.getElementById('ads-service').value = service;
  document.getElementById('ads-company').value = co;
  showTabByName('ads');
}

function showTabByName(name) {
  const tabs = ['domains','landing','ads','seo','publish','leads','dashboard'];
  document.querySelectorAll('.tab').forEach((t, i) => {
    const active = tabs[i] === name;
    t.classList.toggle('active', active);
    document.getElementById('pane-' + tabs[i]).classList.toggle('active', active);
  });
}

// Landing Page Generator
async function generateLP() {
  const keyword = document.getElementById('lp-keyword').value;
  const service = document.getElementById('lp-service').value;
  const domain = document.getElementById('lp-domain').value;
  const company = document.getElementById('lp-company').value;
  if (!keyword || !service || !domain) { toast('Fill keyword, service & domain', 'error'); return; }
  document.getElementById('lp-output').textContent = 'Generating...';
  const r = await fetch('/api/generate/landing-page', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({keyword,service,domain,company}) });
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
  const r = await fetch('/api/deploy/landing-page', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({domain,html:lastLpHtml}) });
  const d = await r.json();
  toast(d.message || 'Deployed!');
}

// Ads Generator
async function generateAds() {
  const domain = document.getElementById('ads-domain').value;
  const service = document.getElementById('ads-service').value;
  const keyword = document.getElementById('ads-keyword').value;
  const company = document.getElementById('ads-company').value;
  if (!domain || !service || !keyword) { toast('Fill all fields', 'error'); return; }
  document.getElementById('ads-output').textContent = 'Generating...';
  const r = await fetch('/api/generate/ads-campaign', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({domain,service,keyword,company}) });
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
  const r = await fetch('/api/google-ads/push', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...lastAdsCampaign, dry_run: dryRun}) });
  const d = await r.json();
  document.getElementById('ads-output').textContent = JSON.stringify(d, null, 2);
  toast(d.message || d.error);
  loadPushHistory();
}

async function checkGoogleAuth() {
  const r = await fetch('/api/auth/google/status');
  const d = await r.json();
  document.getElementById('oauth-status').innerHTML = d.connected
    ? '<span style="color:#4ade80">Connected — ' + Math.round(d.expires_in_seconds/60) + ' mins remaining</span>'
    : '<span style="color:#f87171">Not connected</span>';
}

async function loadPushHistory() {
  const r = await fetch('/api/google-ads/history');
  const { history } = await r.json();
  const el = document.getElementById('push-history');
  if (!history || !history.length) { el.innerHTML = '<p style="color:#71717A;font-size:13px">No history yet.</p>'; return; }
  el.innerHTML = history.map(h =>
    '<div style="padding:8px 0;border-bottom:1px solid #1a1a1a;font-size:13px">' +
    '<span style="color:' + (h.status==='demo'?'#f59e0b':'#4ade80') + '">' + (h.status==='demo'?'Demo':'Live') + '</span> ' +
    '<strong>' + h.campaign + '</strong> ' +
    '<span style="color:#71717A">' + new Date(h.ts).toLocaleString() + '</span></div>'
  ).join('');
}

// SEO Generator
async function generateSEO() {
  const domain = document.getElementById('seo-domain').value;
  const keyword = document.getElementById('seo-keyword').value;
  const service = document.getElementById('seo-service').value;
  const company = document.getElementById('seo-company').value;
  if (!domain || !keyword || !service) { toast('Fill all fields', 'error'); return; }
  document.getElementById('seo-output').innerHTML = '<p style="color:#71717A;padding:20px">Generating...</p>';
  const r = await fetch('/api/generate/seo-content', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({domain,keyword,service,company}) });
  lastSeoContent = await r.json();
  document.getElementById('seo-output').innerHTML =
    '<div class="card"><h3>Title</h3><p style="color:#a8ff78;font-family:monospace;margin-top:8px">' + lastSeoContent.title + '</p></div>' +
    '<div class="card"><h3>Meta Description</h3><p style="color:#a8ff78;font-family:monospace;margin-top:8px">' + lastSeoContent.metaDesc + '</p></div>' +
    '<div class="card"><h3>FAQs (' + lastSeoContent.faqs.length + ')</h3>' + lastSeoContent.faqs.map(f => '<div style="margin-top:10px"><strong>' + f.question + '</strong><p style="color:#71717A;font-size:13px;margin-top:4px">' + f.answer + '</p></div>').join('') + '</div>' +
    '<div class="card"><h3>JSON-LD Schema</h3><pre>' + JSON.stringify(lastSeoContent.schema, null, 2) + '</pre></div>' +
    '<div class="card"><h3>Article</h3><pre style="color:#e2e8f0">' + lastSeoContent.article + '</pre></div>';
  toast('SEO generated for ' + lastSeoContent.brand);
}

function copySEO() {
  if (!lastSeoContent) { toast('Generate first', 'error'); return; }
  navigator.clipboard.writeText(JSON.stringify(lastSeoContent, null, 2));
  toast('Copied!');
}

// Leads
async function loadLeads() {
  const r = await fetch('/api/leads');
  const { leads, message } = await r.json();
  if (message) {
    document.getElementById('leads-list').innerHTML = '<div style="background:#1c1d07;border:1px solid #333;border-radius:8px;padding:20px;text-align:center"><p style="color:#fde68a;margin-bottom:8px">Demo Mode</p><p style="color:#71717A;font-size:13px">' + message + '</p></div>';
    ['leads-total','leads-restoration','leads-renovation','leads-kitchen','dash-leads'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = '-'; });
    return;
  }
  const byC = { Restoration:0, Renovation:0, Kitchen:0 };
  leads.forEach(l => { if(byC[l.company]!==undefined) byC[l.company]++; });
  const setEl = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setEl('leads-total', leads.length);
  setEl('leads-restoration', byC.Restoration);
  setEl('leads-renovation', byC.Renovation);
  setEl('leads-kitchen', byC.Kitchen);
  setEl('dash-leads', leads.length);
  document.getElementById('leads-list').innerHTML = leads.slice(0,50).map(l =>
    '<div class="lead-row">' +
    '<div style="font-size:22px">' + (l.company==='Restoration'?'🚨':l.company==='Renovation'?'🔨':'🍳') + '</div>' +
    '<div style="flex:1"><div style="font-weight:700">' + (l.name||'Anonymous') + ' — ' + (l.phone||l.email) + '</div>' +
    '<div style="color:#71717A;font-size:12px">' + l.source + ' · ' + new Date(l.timestamp).toLocaleString() + '</div></div>' +
    '</div>'
  ).join('') || '<p style="color:#71717A;text-align:center;padding:20px">No leads yet.</p>';
}

// Publish batch
function initPublishDomains() {
  if (!allDomains.length) { setTimeout(initPublishDomains, 500); return; }
  document.getElementById('publish-domains').innerHTML = allDomains.map(d =>
    '<label class="domain-check">' +
    '<input type="checkbox" value="' + d.domain + '" data-keyword="' + d.keyword + '" data-service="' + d.service + '" data-co="' + d.co + '">' +
    '<span><strong>' + d.domain + '</strong><span style="color:#71717A;font-size:11px;display:block">' + d.co + ' · ' + d.status + '</span></span>' +
    '</label>'
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
  const log = document.getElementById('pub-log');
  prog.style.display = 'block';
  log.innerHTML = '';
  let done = 0;
  const addLog = msg => { log.innerHTML += msg + '\n'; log.scrollTop = log.scrollHeight; };
  for (const inp of checked) {
    const domain = inp.value, kw = inp.dataset.keyword, svc = inp.dataset.service, co = inp.dataset.co;
    done++;
    fill.style.width = Math.round((done/checked.length)*100) + '%';
    try {
      if (action === 'lp') {
        const r = await fetch('/api/generate/landing-page', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keyword:kw,service:svc,domain,company:co})});
        const d = await r.json();
        addLog('LP: ' + domain + ' (' + d.brand + ')');
      } else if (action === 'ads') {
        const r = await fetch('/api/generate/ads-campaign', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain,service:svc,keyword:kw,company:co})});
        const d = await r.json();
        addLog('Ads: ' + d.campaign.name);
      } else if (action === 'seo') {
        await fetch('/api/generate/seo-content', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain,keyword:kw,service:svc,company:co})});
        addLog('SEO: ' + domain);
      } else {
        addLog('Queued: ' + domain + ' (demo mode)');
      }
    } catch(e) {
      addLog('Error: ' + domain + ' - ' + e.message);
    }
  }
  addLog('\nDone! ' + checked.length + ' domains processed.');
  toast(checked.length + ' domains processed');
}

// Toast
let toastTimer;
function toast(msg, type) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); document.body.appendChild(t); }
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if(t.parentNode) t.parentNode.removeChild(t); }, 3000);
}
