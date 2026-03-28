import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { APP_HTML, SERVICE_LEADS_HTML, LOGIN_HTML } from './pages'

type Bindings = { KV: KVNamespace; DB: D1Database }
type User = { id: string; email: string; role: string; company_id: number | null; name: string; company_key: string | null }
type Variables = { user: User }

const COMPANIES: Record<string, any> = {
  Restoration: {
    name: '911 Restoration Ottawa', phone: '(613) 909-9911', domain: '911restorationottawa.ca',
    budget: 35, targetCPA: 65, colors: { bg: '#1A1A2E', accent: '#CC0000' },
    callouts: ['IICRC Certified', '45-Min Response', '24/7 Emergency', 'Insurance Direct Billing', 'Free Inspection'],
    sitelinks: [
      { text: 'Free Inspection', url: '/free-inspection' },
      { text: 'Water Damage', url: '/water-damage' },
      { text: 'Mold Removal', url: '/mold-removal' },
      { text: 'Fire Damage', url: '/fire-damage' }
    ]
  },
  Renovation: {
    name: '911 Renovation', phone: '(613) 909-9911', domain: '911renovation.ca',
    budget: 25, targetCPA: 120, colors: { bg: '#0A1628', accent: '#F59E0B' },
    callouts: ['Licensed & Insured', 'Free Estimates', 'Ottawa Local', '10-Year Warranty', 'Senior Discounts'],
    sitelinks: [
      { text: 'Free Estimate', url: '/free-estimate' },
      { text: 'Basement Reno', url: '/basement-renovation' },
      { text: 'Kitchen Reno', url: '/kitchen-renovation' },
      { text: 'Bathroom Reno', url: '/bathroom-renovation' }
    ]
  },
  Kitchen: {
    name: 'Ottawa Kitchen Cabinetry', phone: '(613) 800-5555', domain: 'ottawakitchencabinetry.ca',
    budget: 25, targetCPA: 95, colors: { bg: '#1C1408', accent: '#D97706' },
    callouts: ['Custom Cabinets', 'Free Design Consult', 'Solid Wood', '15-Year Warranty', 'Ottawa Factory Direct'],
    sitelinks: [
      { text: 'Free Design Consult', url: '/free-design' },
      { text: 'Kitchen Cabinets', url: '/kitchen-cabinets' },
      { text: 'Cabinet Refacing', url: '/cabinet-refacing' },
      { text: 'Gallery', url: '/gallery' }
    ]
  }
}

const DOMAINS = {
  emergency: [
    { domain: 'basementfloodedottawa.com', keyword: 'basement flooded ottawa', service: 'Emergency Basement Flood Extraction', budget: 35, status: 'Active', priority: 1, notes: 'Top converter', co: 'Restoration' },
    { domain: 'waterdamageottawa.ca', keyword: 'water damage ottawa', service: 'Water Damage Restoration', budget: 35, status: 'Active', priority: 1, notes: 'High volume', co: 'Restoration' },
    { domain: 'ottawawaterdamage.com', keyword: 'ottawa water damage', service: 'Water Damage Cleanup Ottawa', budget: 35, status: 'Active', priority: 1, notes: '', co: 'Restoration' },
    { domain: 'moldinspectionottawa.ca', keyword: 'mold inspection ottawa', service: 'Professional Mold Inspection', budget: 30, status: 'Active', priority: 2, notes: '', co: 'Restoration' },
    { domain: 'moldremovalottawa.ca', keyword: 'mold removal ottawa', service: 'Mold Removal & Remediation', budget: 30, status: 'Active', priority: 2, notes: '', co: 'Restoration' },
    { domain: 'ottawamoldremoval.com', keyword: 'ottawa mold removal', service: 'Ottawa Mold Remediation', budget: 30, status: 'Active', priority: 2, notes: '', co: 'Restoration' },
    { domain: 'firerestorationottawa.ca', keyword: 'fire restoration ottawa', service: 'Fire Damage Restoration', budget: 35, status: 'Active', priority: 1, notes: '', co: 'Restoration' },
    { domain: 'sewagebackupottawa.com', keyword: 'sewage backup ottawa', service: 'Emergency Sewage Backup Cleanup', budget: 35, status: 'Building', priority: 2, notes: '', co: 'Restoration' },
    { domain: 'emergencyplumberottawa.ca', keyword: 'emergency plumber ottawa', service: 'Emergency Water Extraction', budget: 35, status: 'Building', priority: 2, notes: '', co: 'Restoration' },
    { domain: 'floodcleanupottawa.ca', keyword: 'flood cleanup ottawa', service: 'Flood Cleanup & Restoration', budget: 35, status: 'Active', priority: 2, notes: '', co: 'Restoration' },
    { domain: 'basementleakottawa.com', keyword: 'basement leak ottawa', service: 'Basement Leak Detection & Repair', budget: 30, status: 'Building', priority: 3, notes: '', co: 'Restoration' },
    { domain: 'wetbasementottawa.ca', keyword: 'wet basement ottawa', service: 'Wet Basement Waterproofing', budget: 30, status: 'Building', priority: 3, notes: '', co: 'Restoration' },
    { domain: 'roofleakottawa.com', keyword: 'roof leak ottawa', service: 'Emergency Roof Leak Repair', budget: 30, status: 'Building', priority: 3, notes: '', co: 'Restoration' },
    { domain: 'biohazardcleanupottawa.ca', keyword: 'biohazard cleanup ottawa', service: 'Biohazard & Crime Scene Cleanup', budget: 35, status: 'Parked', priority: 4, notes: '', co: 'Restoration' },
    { domain: 'asbestosremovalottawa.ca', keyword: 'asbestos removal ottawa', service: 'Asbestos Testing & Removal', budget: 30, status: 'Parked', priority: 4, notes: '', co: 'Restoration' },
    { domain: 'smokedamageottawa.com', keyword: 'smoke damage ottawa', service: 'Smoke Damage Restoration', budget: 30, status: 'Building', priority: 3, notes: '', co: 'Restoration' }
  ],
  renovation: [
    { domain: 'basementrenovationottawa.ca', keyword: 'basement renovation ottawa', service: 'Basement Renovation & Finishing', budget: 25, status: 'Active', priority: 1, notes: '', co: 'Renovation' },
    { domain: 'homeadditionsottawa.ca', keyword: 'home additions ottawa', service: 'Home Additions & Extensions', budget: 25, status: 'Active', priority: 2, notes: '', co: 'Renovation' },
    { domain: 'bathroomrenovationottawa.ca', keyword: 'bathroom renovation ottawa', service: 'Bathroom Renovation Services', budget: 25, status: 'Building', priority: 2, notes: '', co: 'Renovation' },
    { domain: 'kitchenrenovationottawa.ca', keyword: 'kitchen renovation ottawa', service: 'Kitchen Renovation & Remodeling', budget: 25, status: 'Building', priority: 2, notes: '', co: 'Renovation' }
  ],
  kitchen: [
    { domain: 'kitchencabinetsottawa.ca', keyword: 'kitchen cabinets ottawa', service: 'Custom Kitchen Cabinets Ottawa', budget: 25, status: 'Active', priority: 1, notes: '', co: 'Kitchen' },
    { domain: 'ottawakitchencabinets.com', keyword: 'ottawa kitchen cabinets', service: 'Ottawa Kitchen Cabinet Design', budget: 25, status: 'Active', priority: 1, notes: '', co: 'Kitchen' },
    { domain: 'customkitchensottawa.ca', keyword: 'custom kitchens ottawa', service: 'Custom Kitchen Design & Install', budget: 25, status: 'Active', priority: 1, notes: '', co: 'Kitchen' },
    { domain: 'kitchenremodelingottawa.ca', keyword: 'kitchen remodeling ottawa', service: 'Kitchen Remodeling Services', budget: 25, status: 'Active', priority: 2, notes: '', co: 'Kitchen' },
    { domain: 'cabinetrefacingottawa.com', keyword: 'cabinet refacing ottawa', service: 'Cabinet Refacing & Resurfacing', budget: 20, status: 'Active', priority: 2, notes: '', co: 'Kitchen' },
    { domain: 'ottawacabinetmakers.com', keyword: 'ottawa cabinet makers', service: 'Custom Cabinet Makers Ottawa', budget: 20, status: 'Building', priority: 2, notes: '', co: 'Kitchen' },
    { domain: 'kitchendesignottawa.ca', keyword: 'kitchen design ottawa', service: 'Kitchen Design Consultation', budget: 20, status: 'Building', priority: 3, notes: '', co: 'Kitchen' },
    { domain: 'shaker-cabinets-ottawa.com', keyword: 'shaker cabinets ottawa', service: 'Shaker Style Kitchen Cabinets', budget: 20, status: 'Building', priority: 3, notes: '', co: 'Kitchen' },
    { domain: 'rta-cabinets-ottawa.ca', keyword: 'rta cabinets ottawa', service: 'RTA Kitchen Cabinets Ottawa', budget: 20, status: 'Parked', priority: 4, notes: '', co: 'Kitchen' },
    { domain: 'paintedkitchencabinets-ottawa.com', keyword: 'painted kitchen cabinets ottawa', service: 'Painted Kitchen Cabinets', budget: 20, status: 'Parked', priority: 4, notes: '', co: 'Kitchen' },
    { domain: 'kitchencountertopsottawa.ca', keyword: 'kitchen countertops ottawa', service: 'Kitchen Countertops & Surfaces', budget: 20, status: 'Building', priority: 3, notes: '', co: 'Kitchen' },
    { domain: 'ottawakitchenrenovations.com', keyword: 'ottawa kitchen renovations', service: 'Ottawa Kitchen Renovations', budget: 25, status: 'Active', priority: 2, notes: '', co: 'Kitchen' },
    { domain: 'affordablekitchensottawa.ca', keyword: 'affordable kitchens ottawa', service: 'Affordable Kitchen Solutions Ottawa', budget: 20, status: 'Parked', priority: 4, notes: '', co: 'Kitchen' }
  ]
}

function detectCompany(domain: string, keyword: string, override?: string): string {
  if (override && COMPANIES[override]) return override
  const text = (domain + ' ' + keyword).toLowerCase()
  if (text.includes('kitchen') || text.includes('cabinet') || text.includes('cabinetry')) return 'Kitchen'
  if (text.includes('renovation') || text.includes('remodel') || text.includes('addition')) return 'Renovation'
  return 'Restoration'
}

function generateLandingPage(keyword: string, service: string, domain: string, co: string) {
  const company = COMPANIES[co]
  const year = new Date().getFullYear()
  const phone = company.phone
  const phoneDigits = phone.replace(/[^0-9]/g, '')
  const calloutHtml = company.callouts.map((c: string) => `<span class="callout">${c}</span>`).join('')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${service} Ottawa | ${company.name}</title><meta name="description" content="Professional ${service.toLowerCase()} in Ottawa. ${company.name} - call ${phone}."><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#fff;color:#1a1a1a}header{background:${company.colors.bg};color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center}.brand{font-size:20px;font-weight:800}.cta-header{background:${company.colors.accent};color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;font-weight:700}.hero{background:linear-gradient(135deg,${company.colors.bg},${company.colors.accent});color:#fff;padding:80px 24px;text-align:center}.hero h1{font-size:40px;font-weight:900;margin-bottom:16px}.hero p{font-size:18px;margin-bottom:32px}.hero-cta{background:#fff;color:${company.colors.bg};padding:16px 36px;border-radius:6px;text-decoration:none;font-weight:800;font-size:18px}.section{max-width:900px;margin:0 auto;padding:60px 24px}.callouts{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}.callout{background:${company.colors.bg};color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600}form{background:#f8f8f8;border-radius:10px;padding:32px}input,textarea{width:100%;padding:12px;border:2px solid #ddd;border-radius:6px;font-size:15px;margin-bottom:14px}.submit-btn{background:${company.colors.accent};color:#fff;border:none;padding:16px 32px;border-radius:6px;font-size:18px;font-weight:800;cursor:pointer;width:100%}footer{background:${company.colors.bg};color:#fff;text-align:center;padding:20px;font-size:13px}</style></head><body><header><div class="brand">${company.name}</div><a href="tel:${phoneDigits}" class="cta-header">Call ${phone}</a></header><div class="hero"><h1>${service} in Ottawa</h1><p>Fast, professional service — call now.</p><a href="tel:${phoneDigits}" class="hero-cta">Call ${phone}</a></div><div class="section"><h2>Why Choose ${company.name}?</h2><div class="callouts">${calloutHtml}</div><h2 style="margin-top:32px">Get a Free Quote</h2><form onsubmit="handleSubmit(event)"><input type="text" name="name" placeholder="Your Name" required><input type="tel" name="phone" placeholder="Phone Number" required><input type="email" name="email" placeholder="Email"><textarea name="message" rows="3" placeholder="Describe your situation..."></textarea><button type="submit" class="submit-btn">Get My Free Quote</button></form></div><footer><p>${company.name} | ${phone} | ${year}</p></footer><script>async function handleSubmit(e){e.preventDefault();const btn=e.target.querySelector(".submit-btn");btn.textContent="Sending...";const data=Object.fromEntries(new FormData(e.target));data.source="landing-page";data.page=window.location.hostname;data.company="${co}";try{await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});btn.textContent="Submitted!";btn.style.background="#22c55e";e.target.reset();}catch{btn.textContent="Error - call us";}}<\/script></body></html>`
}

function generateAdsCampaign(domain: string, service: string, keyword: string, co: string) {
  const company = COMPANIES[co]
  return {
    company: co,
    campaign: {
      name: `[${domain}] ${service} — Ottawa Search`,
      budget: `$${company.budget}/day CAD`,
      bidStrategy: `Maximize Conversions (Target CPA: $${company.targetCPA})`,
      schedule: co === 'Restoration' ? [{ days: 'Monday-Sunday', hours: '24 Hours' }] : [{ days: 'Monday-Friday', hours: '7am-7pm' }, { days: 'Saturday', hours: '8am-5pm' }],
      targeting: { location: 'Ottawa, ON, Canada', radius: '40km', language: ['English', 'French'] }
    },
    adGroup: {
      name: `${keyword} — Exact/Phrase/Broad`,
      keywords: [
        { match: 'Exact', text: `[${keyword}]`, bid: '$4.50 CAD' },
        { match: 'Phrase', text: `"${keyword}"`, bid: '$3.50 CAD' },
        { match: 'Broad', text: keyword, bid: '$2.50 CAD' }
      ]
    },
    ads: [{
      type: 'Responsive Search Ad',
      headlines: [`${service} Ottawa`, company.name, `Call ${company.phone}`, 'Free Estimate', '24/7 Ottawa', 'Licensed & Insured'],
      descriptions: [`Professional ${service} in Ottawa. ${company.callouts.slice(0,2).join(', ')}. Call ${company.phone}.`, `${company.name} — Ottawa trusted experts. Free estimates. Call: ${company.phone}`],
      finalUrl: `https://${domain}`
    }],
    extensions: { callouts: company.callouts, sitelinks: company.sitelinks }
  }
}

function generateSeoContent(domain: string, keyword: string, service: string, co: string) {
  const company = COMPANIES[co]
  const year = new Date().getFullYear()
  return {
    title: `${service} in Ottawa | ${company.name} — ${year}`,
    metaDesc: `Expert ${service.toLowerCase()} in Ottawa, ON. ${company.name} — ${company.callouts.slice(0,2).join(', ')}. Call ${company.phone}.`,
    faqs: [
      { question: `How much does ${service.toLowerCase()} cost in Ottawa?`, answer: `Call ${company.phone} for a free estimate. Cost varies by scope.` },
      { question: 'How quickly can you respond?', answer: co === 'Restoration' ? '45-minute response time, 24/7 emergency service.' : 'Consultations within 24-48 hours.' },
      { question: `Is ${company.name} licensed in Ottawa?`, answer: 'Yes, fully licensed, bonded, and insured in Ontario.' },
      { question: 'What areas do you serve?', answer: 'Ottawa, Kanata, Nepean, Orleans, Barrhaven, Gloucester, Stittsville, Manotick.' }
    ],
    schema: { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: company.name, telephone: company.phone, url: `https://${domain}`, address: { '@type': 'PostalAddress', addressLocality: 'Ottawa', addressRegion: 'ON', addressCountry: 'CA' } },
    article: `# ${service} in Ottawa (${year})\n\n${company.callouts.map((c: string) => `- ${c}`).join('\n')}\n\nPhone: ${company.phone}\nWebsite: https://${domain}`,
    company: co, brand: company.name, domain
  }
}

// ── AUTH HELPERS ─────────────────────────────────────────────────────────

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split(':')
    if (parts.length !== 3) return false
    const saltHex = parts[1]
    const storedHash = parts[2]
    if (!saltHex || !storedHash) return false
    const enc = new TextEncoder()
    const saltBytes = saltHex.match(/.{2}/g)
    if (!saltBytes) return false
    const salt = new Uint8Array(saltBytes.map((b: string) => parseInt(b, 16)))
    const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: { name: 'SHA-256' } },
      key, 256
    )
    const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex === storedHash
  } catch (err: any) {
    console.error('[verifyPassword Error]', err?.message)
    return false
  }
}

function getToken(c: any): string | null {
  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const cookie = c.req.header('Cookie') || ''
  const match = cookie.match(/slm_token=([^;]+)/)
  return match ? match[1] : null
}

const SKIP_AUTH = new Set([
  'POST /api/leads', 'GET /api/status',
  'POST /api/auth/login', 'POST /api/auth/logout',
  'GET /api/auth/google', 'GET /api/auth/google/callback', 'GET /api/auth/google/status'
])

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Always return JSON for unhandled errors — prevents "Network error" in the browser
app.onError((err, c) => {
  console.error('[SLM Error]', err.message, err.stack)
  return c.json({ error: 'Internal server error', detail: err.message }, 500)
})
app.use('/api/*', cors({ origin: '*', allowMethods: ['POST', 'GET', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'] }))
app.use('/api/*', async (c, next) => {
  const key = `${c.req.method} ${new URL(c.req.url).pathname}`
  if (SKIP_AUTH.has(key)) return next()
  if (!c.env?.DB) return next()
  const token = getToken(c)
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT s.token as tok, u.id, u.email, u.role, u.company_id, u.name, u.active, co.key as company_key FROM sessions s JOIN users u ON s.user_id = u.id LEFT JOIN companies co ON u.company_id = co.id WHERE s.token = ? AND s.expires_at > ?'
  ).bind(token, new Date().toISOString()).first() as any
  if (!session || !session.active) return c.json({ error: 'Unauthorized' }, 401)
  c.set('user', { id: session.id, email: session.email, role: session.role, company_id: session.company_id, name: session.name, company_key: session.company_key })
  return next()
})
app.use('/static/*', serveStatic({ root: './' }))
app.get('/favicon.ico', (c) => c.body(null, 204))
app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /api/\n'))

app.get('/api/status', (c) => {
  const all = [...DOMAINS.emergency, ...DOMAINS.renovation, ...DOMAINS.kitchen]
  return c.json({
    status: 'operational', version: '2.0.0', timestamp: new Date().toISOString(),
    domains: { total: all.length, active: all.filter(d=>d.status==='Active').length, building: all.filter(d=>d.status==='Building').length, parked: all.filter(d=>d.status==='Parked').length },
    companies: Object.keys(COMPANIES),
    features: ['landing-page-generator','ads-campaign-generator','seo-content-generator','google-ads-api-v18','oauth-flow','lead-capture','domain-deployment']
  })
})

app.get('/api/domains', async (c) => {
  // Read from D1 — includes authorization columns added in 0004_domain_auth.sql
  // Falls back to in-memory DOMAINS if DB is unavailable (dev/demo mode)
  if (!c.env?.DB) {
    const user = c.get('user')
    let all = [
      ...DOMAINS.emergency.map(d => ({ ...d, category: 'emergency', authorized: 1, authorized_by: null, authorized_at: null, owned_by_tenant: 0 })),
      ...DOMAINS.renovation.map(d => ({ ...d, category: 'renovation', authorized: 1, authorized_by: null, authorized_at: null, owned_by_tenant: 0 })),
      ...DOMAINS.kitchen.map(d => ({ ...d, category: 'kitchen', authorized: 1, authorized_by: null, authorized_at: null, owned_by_tenant: 0 }))
    ]
    if (user && user.role !== 'super_admin' && user.company_key) {
      all = all.filter(d => d.co === user.company_key)
    }
    return c.json({ total: all.length, domains: all })
  }
  const user = c.get('user')
  const base = 'SELECT id, domain, keyword, service, budget, status, priority, notes, company AS co, category, authorized, authorized_by, authorized_at, owned_by_tenant FROM domains'
  let result
  if (user && user.role !== 'super_admin' && user.company_key) {
    result = await c.env.DB.prepare(base + ' WHERE company = ? ORDER BY authorized DESC, priority ASC, domain ASC').bind(user.company_key).all()
  } else {
    result = await c.env.DB.prepare(base + ' ORDER BY authorized DESC, category ASC, priority ASC, domain ASC').all()
  }
  const domains = result.results || []
  return c.json({ total: domains.length, domains })
})

app.post('/api/domains/:id/authorize', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden — super admin only' }, 403)
  if (!c.env?.DB) return c.json({ error: 'Database not configured' }, 500)
  const id = parseInt(c.req.param('id'))
  if (!id || isNaN(id)) return c.json({ error: 'Invalid domain id' }, 400)
  const now = new Date().toISOString()
  await c.env.DB.prepare('UPDATE domains SET authorized = 1, authorized_by = ?, authorized_at = ? WHERE id = ?').bind(user.id, now, id).run()
  return c.json({ success: true, authorized: true })
})

app.post('/api/domains/:id/revoke', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden — super admin only' }, 403)
  if (!c.env?.DB) return c.json({ error: 'Database not configured' }, 500)
  const id = parseInt(c.req.param('id'))
  if (!id || isNaN(id)) return c.json({ error: 'Invalid domain id' }, 400)
  await c.env.DB.prepare('UPDATE domains SET authorized = 0, authorized_by = NULL, authorized_at = NULL WHERE id = ?').bind(id).run()
  return c.json({ success: true, authorized: false })
})

app.post('/api/domains/:id/request-auth', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (user.role === 'super_admin') return c.json({ error: 'Super admin should use /authorize directly' }, 400)
  const id = parseInt(c.req.param('id'))
  if (!id || isNaN(id)) return c.json({ error: 'Invalid domain id' }, 400)
  // Log the request to KV so super admin can review pending requests
  if (c.env?.KV) {
    const requestKey = `auth_request:${id}:${user.id}`
    await c.env.KV.put(requestKey, JSON.stringify({
      domain_id: id, requested_by: user.id, requester_name: user.name,
      requester_email: user.email, company_key: user.company_key,
      requested_at: new Date().toISOString()
    }), { expirationTtl: 60 * 60 * 24 * 30 }) // 30 days
  }
  return c.json({ success: true, message: 'Authorization request submitted — pending super admin approval' })
})

app.get('/api/companies', async (c) => {
  if (!c.env?.DB) return c.json({ companies: [] })
  const user = c.get('user')
  let query = 'SELECT id, key, name, phone, domain, budget, target_cpa, color_bg, color_accent, callouts, sitelinks FROM companies'
  let result
  if (user && user.role !== 'super_admin' && user.company_id !== null) {
    result = await c.env.DB.prepare(query + ' WHERE id = ? ORDER BY id').bind(user.company_id).all()
  } else {
    result = await c.env.DB.prepare(query + ' ORDER BY id').all()
  }
  return c.json({ companies: result.results || [] })
})

app.post('/api/generate/landing-page', async (c) => {
  const { keyword, service, domain, company: co } = await c.req.json()
  if (!keyword || !service || !domain) return c.json({ error: 'keyword, service, domain required' }, 400)
  const detected = detectCompany(domain, keyword, co)
  return c.json({ html: generateLandingPage(keyword, service, domain, detected), company: detected, brand: COMPANIES[detected].name, domain })
})

app.post('/api/generate/ads-campaign', async (c) => {
  const { domain, service, keyword, company: co } = await c.req.json()
  if (!domain || !service || !keyword) return c.json({ error: 'domain, service, keyword required' }, 400)
  const detected = detectCompany(domain, keyword, co)
  return c.json({ ...generateAdsCampaign(domain, service, keyword, detected), generatedAt: new Date().toISOString() })
})

app.post('/api/generate/seo-content', async (c) => {
  const { domain, keyword, service, company: co } = await c.req.json()
  if (!domain || !keyword || !service) return c.json({ error: 'domain, keyword, service required' }, 400)
  const detected = detectCompany(domain, keyword, co)
  return c.json(generateSeoContent(domain, keyword, service, detected))
})

app.post('/api/leads', async (c) => {
  try {
    const body = await c.req.json()
    const lead = { ...body, ip: c.req.header('CF-Connecting-IP')||'', country: c.req.header('CF-IPCountry')||'', timestamp: new Date().toISOString() }
    if (c.env?.DB) await c.env.DB.prepare('INSERT INTO leads (name,phone,email,message,source,keyword,company,ip,country,referer,timestamp) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(lead.name||'',lead.phone||'',lead.email||'',lead.message||'',lead.source||'direct',lead.keyword||'',lead.company||'Restoration',lead.ip,lead.country,c.req.header('Referer')||'',lead.timestamp).run()
    if (c.env?.KV) await c.env.KV.put(`lead:${Date.now()}:${lead.phone||lead.email}`, JSON.stringify(lead), { expirationTtl: 60*60*24*365 })
    return c.json({ success: true, message: 'Lead captured' })
  } catch { return c.json({ success: true }) }
})

app.get('/api/leads', async (c) => {
  if (!c.env?.DB) return c.json({ leads: [], message: 'DB not configured — running in demo mode' })
  const user = c.get('user')
  let result
  if (user && user.role !== 'super_admin' && user.company_key) {
    result = await c.env.DB.prepare('SELECT * FROM leads WHERE company = ? ORDER BY timestamp DESC LIMIT 100').bind(user.company_key).all()
  } else {
    result = await c.env.DB.prepare('SELECT * FROM leads ORDER BY timestamp DESC LIMIT 100').all()
  }
  return c.json({ leads: result.results || [], total: result.results?.length || 0 })
})

// ── SLM AUTH ──────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { email, password } = body as any
    if (!email || !password) return c.json({ error: 'Email and password required' }, 400)
    if (!c.env?.DB) return c.json({ error: 'Database not configured' }, 500)

    const user = await c.env.DB.prepare(
      'SELECT id, email, password_hash, role, company_id, name, active FROM users WHERE email = ? AND active = 1'
    ).bind(String(email).toLowerCase().trim()).first() as any

    if (!user) return c.json({ error: 'Invalid credentials' }, 401)

    const valid = await verifyPassword(String(password), String(user.password_hash))
    if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

    const sessionId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 86400000).toISOString()

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(sessionId, user.id, token, expiresAt, now).run()

    await c.env.DB.prepare(
      'UPDATE users SET last_login = ? WHERE id = ?'
    ).bind(now, user.id).run()

    // Return raw Response — bypasses Hono's Set-Cookie header staging which calls
    // Headers.prototype.getSetCookie() (unavailable in some CF Workers runtimes)
    return new Response(JSON.stringify({
      success: true,
      user: { id: user.id, email: user.email, role: user.role, company_id: user.company_id, name: user.name }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `slm_token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`
      }
    })
  } catch (err: any) {
    console.error('[Login Error]', err?.message, err?.stack)
    return c.json({ error: 'Login failed', detail: err?.message }, 500)
  }
})

app.post('/api/auth/logout', async (c) => {
  try {
    const token = getToken(c)
    if (token && c.env?.DB) await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  } catch {}
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'slm_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
    }
  })
})

app.get('/api/auth/me', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  return c.json({ user })
})

app.get('/api/auth/google', (c) => {
  const clientId = (c.env as any)?.GOOGLE_ADS_CLIENT_ID
  if (!clientId) return c.html('<html><body style="padding:40px;background:#09090B;color:#fff"><h2>Google Ads not configured</h2><p>Add GOOGLE_ADS_CLIENT_ID to env.</p><a href="/app" style="color:#388bfd">Back</a></body></html>')
  const redirectUri = new URL(c.req.url).origin + '/api/auth/google/callback'
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('https://www.googleapis.com/auth/adwords')}&access_type=offline&prompt=consent`)
})

app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code')
  const clientId = (c.env as any)?.GOOGLE_ADS_CLIENT_ID
  const clientSecret = (c.env as any)?.GOOGLE_ADS_CLIENT_SECRET
  const redirectUri = new URL(c.req.url).origin + '/api/auth/google/callback'
  if (!code) return c.html('<html><body style="padding:40px;background:#09090B;color:#fff"><h2>Auth Failed</h2><a href="/app">Back</a></body></html>')
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }) })
  const tokens = await tokenRes.json() as any
  if (tokens.access_token && c.env?.KV) await c.env.KV.put('google_oauth_tokens', JSON.stringify({ ...tokens, stored_at: Date.now() }), { expirationTtl: 60*60*24*30 })
  return c.html(`<html><body style="padding:40px;background:#09090B;color:#fff"><h2>${tokens.access_token ? '✅ Connected!' : '❌ Failed'}</h2><a href="/app" style="color:#388bfd">Back to Hub</a></body></html>`)
})

app.get('/api/auth/google/status', async (c) => {
  if (!c.env?.KV) return c.json({ connected: false, message: 'KV not configured' })
  const tokens = await c.env.KV.get('google_oauth_tokens')
  if (!tokens) return c.json({ connected: false })
  const t = JSON.parse(tokens)
  return c.json({ connected: true, expires_in_seconds: (t.expires_in||3600) - (Date.now()-t.stored_at)/1000, has_refresh: !!t.refresh_token })
})

app.post('/api/google-ads/push', async (c) => {
  const campaign = await c.req.json()
  const devToken = (c.env as any)?.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!devToken) {
    if (c.env?.KV) await c.env.KV.put(`push:${Date.now()}`, JSON.stringify({ campaign: campaign.campaign?.name||'Unknown', status: 'demo', ts: new Date().toISOString() }), { expirationTtl: 60*60*24*30 })
    return c.json({ success: true, status: 'demo', message: 'Campaign queued (demo mode — add Google Ads API credentials to enable)', campaign: campaign.campaign?.name, timestamp: new Date().toISOString() })
  }
  return c.json({ success: true, status: 'configured', message: 'Credentials detected — OAuth required', timestamp: new Date().toISOString() })
})

app.get('/api/google-ads/history', async (c) => {
  if (!c.env?.KV) return c.json({ history: [] })
  const list = await c.env.KV.list({ prefix: 'push:' })
  const history = await Promise.all(list.keys.slice(0,20).map(async ({name}) => { const val = await c.env.KV.get(name); try { return JSON.parse(val||'{}') } catch { return null } }))
  return c.json({ history: history.filter(Boolean) })
})

app.post('/api/deploy/landing-page', async (c) => {
  const { domain, html } = await c.req.json()
  if (!domain || !html) return c.json({ error: 'domain and html required' }, 400)
  return c.json({ success: true, status: 'demo', domain, message: `${domain} queued for deployment (demo mode)`, deployUrl: `https://${domain}`, timestamp: new Date().toISOString() })
})

app.get('/', (c) => c.html('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>911 Marketing Hub</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#09090B;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px}.logo{font-size:60px;margin-bottom:16px}h1{font-size:36px;font-weight:900;margin-bottom:8px}.sub{color:#71717A;margin-bottom:40px}.nav{display:flex;gap:16px;flex-wrap:wrap;justify-content:center}.btn{background:#1A1A2E;border:1px solid #333;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700}.btn.primary{background:#CC0000;border-color:#CC0000}</style></head><body><div class="logo">🚨</div><h1>911 Marketing Hub</h1><p class="sub">Ottawa EMD Army Command Center — v2.0.0</p><div class="nav"><a href="/app" class="btn primary">Marketing Hub</a><a href="/serviceleads" class="btn">Google API Setup</a><a href="/api/status" class="btn">API Status</a></div></body></html>'))

app.get('/login', (c) => c.html(LOGIN_HTML))
app.get('/app', (c) => {
  const token = getToken(c)
  if (!token) return c.redirect('/login')
  return c.html(APP_HTML)
})
app.get('/serviceleads', (c) => c.html(SERVICE_LEADS_HTML))

export default app
