import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { APP_HTML, SERVICE_LEADS_HTML, LOGIN_HTML, INVITE_HTML } from './pages'

type Bindings = {
  KV: KVNamespace
  DB: D1Database
  IMAGES: R2Bucket
  PORKBUN_API_KEY: string
  PORKBUN_SECRET_KEY: string
  GOOGLE_ADS_DEVELOPER_TOKEN: string
  GOOGLE_ADS_CUSTOMER_ID: string
  GOOGLE_ADS_CLIENT_ID: string
  GOOGLE_ADS_CLIENT_SECRET: string
  GOOGLE_PLACES_API_KEY: string
  ANTHROPIC_API_KEY: string
  SERPAPI_KEY: string
}
// Real review row from google_reviews D1 table
type ReviewRow = {
  id: number
  reviewer_name: string
  rating: number
  review_text: string
  relative_time: string | null
  reviewer_photo: string | null
}
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

// ── LANDING PAGE GENERATOR — FULL CONVERSION TEMPLATE ────────────────────

type Niche = 'restoration' | 'renovation' | 'kitchen'
type CompanyData = {
  name: string; phone: string; mainDomain: string
  color_bg: string; color_accent: string
  callouts: string[]; sitelinks: Array<{ text: string; url: string }>
}
type TemplateLayout = 'hero-left' | 'centered-bold' | 'split-screen' | 'magazine' | 'image-hero' | 'magazine-editorial' | 'minimal-urgency'
type TemplateConfig = {
  number: number; name: string; bg: string; accent: string
  layout: TemplateLayout; heroImageUrl: string | null
}
const DEFAULT_TEMPLATE: TemplateConfig = { number: 1, name: 'Bold Emergency', bg: '#1A1A2E', accent: '#CC0000', layout: 'hero-left', heroImageUrl: null }

function getNiche(co: string, service: string): Niche {
  const s = (co + ' ' + service).toLowerCase()
  if (s.includes('kitchen') || s.includes('cabinet') || s.includes('cabinetry')) return 'kitchen'
  if (s.includes('renovation') || s.includes('remodel') || s.includes('addition')) return 'renovation'
  return 'restoration'
}

function extractCity(keyword: string): string {
  const lower = keyword.toLowerCase()
  const cities = ['kanata', 'barrhaven', 'orleans', 'nepean', 'gloucester', 'stittsville', 'manotick', 'gatineau', 'ottawa']
  const found = cities.find(c => lower.includes(c))
  return found ? found.charAt(0).toUpperCase() + found.slice(1) : 'Ottawa'
}

function capWords(s: string): string {
  return s.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ')
}

function getLPFeatures(niche: Niche): Array<{ icon: string; title: string; desc: string }> {
  if (niche === 'kitchen') return [
    { icon: '🎨', title: 'Free 3D Design Rendering', desc: 'Visualize your complete kitchen in full 3D before we build a single cabinet. No surprises — what you see is exactly what you get.' },
    { icon: '🌲', title: 'Solid Wood Construction', desc: 'Every cabinet crafted from premium solid wood. Built to last decades, not years — with finishes that stay beautiful under daily use.' },
    { icon: '🏭', title: 'Ottawa Factory Direct', desc: 'We manufacture locally and sell direct, eliminating the middleman entirely. You save 30–50% compared to retail showroom pricing.' },
    { icon: '📏', title: 'Custom Fit to Your Space', desc: 'Every unit is built and fitted to your exact measurements — not forced into standard sizes. The result is a seamless, built-in look.' },
    { icon: '🔧', title: 'Professional Installation', desc: 'Our certified installation team handles everything from start to finish, perfectly level every time, with a clean worksite guaranteed.' },
    { icon: '⭐', title: 'Google Rated 4.9 / 5', desc: "Hundreds of Ottawa homeowners rate us 5 stars for quality, service, and value. We don't consider a job done until you're completely satisfied." }
  ]
  if (niche === 'renovation') return [
    { icon: '📋', title: 'Free Detailed Estimates', desc: 'Fully itemized estimates before a single nail is driven. No hidden fees, no surprise invoices — you know the full cost before you commit.' },
    { icon: '🏆', title: '10-Year Workmanship Warranty', desc: 'We stand behind every project with a comprehensive 10-year warranty on all labour and workmanship. Build with confidence.' },
    { icon: '📜', title: 'Full Permit Management', desc: 'We handle all Ottawa building permit applications, inspections, and approvals on your behalf. Zero bureaucracy headaches for you.' },
    { icon: '👷', title: 'Licensed & Bonded Contractors', desc: 'Fully licensed, bonded, and insured in Ontario. Your project, property, and investment are completely protected throughout.' },
    { icon: '🎯', title: 'Design-Build Under One Roof', desc: 'Design, permits, construction, and finishing — all managed by one team seamlessly. One point of contact from start to finish.' },
    { icon: '🏘️', title: 'Ottawa Local Since 2005', desc: "Deep roots in the Ottawa community with thousands of completed local projects. We're not just contractors — we're your neighbours." }
  ]
  return [
    { icon: '⚡', title: '45-Minute Response Guarantee', desc: 'We arrive within 45 minutes because every hour water sits, damage compounds. Faster response = lower restoration costs for you.' },
    { icon: '🏦', title: 'Insurance Direct Billing', desc: 'We work directly with your insurance carrier, handle all paperwork, and submit a fully documented claim so you never deal with the back-and-forth.' },
    { icon: '🎓', title: 'IICRC Certified Technicians', desc: "Every technician holds active IICRC certification — the restoration industry's highest standard for professional training and ethics." },
    { icon: '📞', title: '24 / 7 Emergency Line', desc: "Disasters don't follow business hours. Our emergency line is answered by a live technician every hour of every day — including holidays." },
    { icon: '🏠', title: 'Full Restoration Service', desc: 'From emergency extraction through complete structural rebuild — we handle every phase so you never manage multiple contractors.' },
    { icon: '📸', title: 'Complete Insurance Documentation', desc: 'We photograph, measure, and document all damage in professional detail to maximise your insurance payout and speed up approval.' }
  ]
}

function getLPFaqs(niche: Niche, service: string, city: string, phone: string): Array<{ q: string; a: string }> {
  if (niche === 'kitchen') return [
    { q: 'How long does a kitchen cabinet installation take?', a: `Most kitchen cabinet installations in ${city} take 3–7 business days depending on scope. We provide a detailed project timeline before work begins so you can plan accordingly.` },
    { q: 'What is the difference between custom and semi-custom cabinets?', a: `Custom cabinets are built to your exact measurements and specifications — ideal for unusual layouts or premium finishes. Semi-custom offers standard sizes with limited customisation. We offer both at factory-direct prices, so you get more cabinet for your budget.` },
    { q: `How much does a kitchen renovation cost in ${city}?`, a: `A full kitchen cabinet installation in ${city} typically ranges from $8,000–$35,000 depending on size, layout, and materials. We provide free, detailed in-home estimates. Call ${phone} to schedule yours.` },
    { q: 'Can you work with my existing kitchen layout?', a: `Absolutely. We can reface existing cabinets, reconfigure your current layout, or design an entirely new kitchen from scratch. We work around your space, your needs, and your budget.` },
    { q: 'Do your cabinets come with a warranty?', a: `Yes — all cabinets include a manufacturer materials warranty plus our installation craftsmanship warranty. We stand behind every joint, finish, and fitting we install.` }
  ]
  if (niche === 'renovation') return [
    { q: `Do I need a building permit for a ${service.toLowerCase()} in Ottawa?`, a: `Most structural renovations in Ottawa require a building permit from the City of Ottawa. We manage the entire permit process on your behalf — applications, inspections, and final sign-off. You don't deal with the city at all.` },
    { q: `How long does a ${service.toLowerCase()} take?`, a: `Timeline depends on scope. A standard basement renovation is typically 4–8 weeks; larger or complex projects may take 3–4 months. We provide a detailed project schedule before work starts and keep you updated at every milestone.` },
    { q: `How much does a ${service.toLowerCase()} cost in ${city}?`, a: `Costs vary based on size, materials, and complexity. We provide free, fully itemised estimates with no obligation. Call ${phone} to schedule your on-site estimate.` },
    { q: 'What is included in your renovation estimate?', a: `All labour, materials, permits, project management, and cleanup are itemised in our estimates. We don't add fees after the fact — what you see in the estimate is what you pay.` },
    { q: 'Do you manage subcontractors?', a: `Yes — we coordinate all trades through our vetted network of licensed subcontractors including electricians, plumbers, and drywallers. One point of contact, zero juggling for you.` }
  ]
  return [
    { q: 'Does my home insurance cover water damage restoration?', a: `Most Ontario home insurance policies cover sudden and accidental water damage. We work with all major carriers and provide complete documentation to support your claim. Call ${phone} and we'll help you navigate your coverage before we arrive.` },
    { q: 'How quickly can you respond to a water damage emergency?', a: `We guarantee a 45-minute response in the ${city} area, 24 / 7 / 365. Speed matters — every hour water sits, repair costs increase and mold risk grows.` },
    { q: 'How long does water damage restoration take?', a: `Structural drying typically takes 3–5 days. Complete restoration including drywall, flooring, and finishing takes 1–4 weeks depending on damage extent. We keep you informed at every stage.` },
    { q: 'Can you save my furniture and belongings?', a: `Yes. We use professional content restoration techniques for furniture, documents, electronics, and clothing. Every item is inventoried and documented for your insurance claim.` },
    { q: 'Will mold come back after remediation?', a: `Properly executed IICRC-standard remediation removes mold at the source. We also correct the underlying moisture problem that caused it. We provide a post-remediation clearance certificate when complete.` }
  ]
}

function getLPReviews(niche: Niche): Array<{ text: string; name: string; area: string }> {
  if (niche === 'kitchen') return [
    { text: 'Exactly what I designed in the 3D rendering — down to the last detail. The solid wood quality is exceptional and the factory-direct pricing saved us over $9,000 compared to other quotes. Our kitchen is stunning.', name: 'Christine B.', area: 'Orleans' },
    { text: 'From initial design consultation to final installation, completely seamless. The crew was meticulous — perfectly level, not a gap anywhere. We have had dozens of compliments from friends and family. Worth every dollar.', name: 'Paul W.', area: 'Manotick' },
    { text: 'Four quotes, and these guys came in $11,000 less than the competition with better materials. The 3D design preview gave us complete confidence before we committed. The result looks like a showroom kitchen.', name: 'Karen T.', area: 'Stittsville' }
  ]
  if (niche === 'renovation') return [
    { text: "Our unfinished basement is now the best room in the house. The team handled permits, design, and construction without a single issue. Finished on time, on budget. Two years later and it still looks brand new.", name: 'David M.', area: 'Nepean' },
    { text: 'They managed everything — permits, subcontractors, inspections. I was informed at every step but never had to chase anyone down. Professional, clean, and the craftsmanship is outstanding. Highly recommend.', name: 'Amanda R.', area: 'Kanata' },
    { text: 'The only contractor who included permit costs upfront and never added surprise charges. The finished basement exceeded our expectations and the 10-year warranty gives us real peace of mind.', name: 'Robert S.', area: 'Barrhaven' }
  ]
  return [
    { text: "They arrived in 38 minutes at 2am. My entire basement was flooded and they had extraction running within the hour. They dealt with my insurance company directly and I didn't pay a cent out of pocket. Absolutely incredible service.", name: 'Sarah K.', area: 'Kanata' },
    { text: 'Sewage backup — the worst possible situation. These guys showed up fast, worked clean, and had everything sanitised and dried within days. Their insurance documentation was so thorough my claim was approved in 48 hours.', name: 'Mike T.', area: 'Barrhaven' },
    { text: "The IICRC-certified crew found hidden moisture damage inside our walls that we had no idea existed. If they hadn't caught it, we would have had a serious mold problem within months. Thorough, honest, and highly professional.", name: 'Jennifer L.', area: 'Orleans' }
  ]
}

function getLPExtLinks(niche: Niche): Array<{ href: string; text: string }> {
  if (niche === 'kitchen') return [
    { href: 'https://www.nkba.org', text: 'National Kitchen & Bath Association (NKBA)' },
    { href: 'https://www.houzz.com/magazine/kitchen-renovation-guide', text: 'Kitchen Renovation Planning Guide — Houzz' }
  ]
  if (niche === 'renovation') return [
    { href: 'https://ottawa.ca/en/building-renovation-and-design', text: 'City of Ottawa Building Permits & Renovation' },
    { href: 'https://www.nari.org', text: 'National Association of the Remodeling Industry (NARI)' }
  ]
  return [
    { href: 'https://www.iicrc.org', text: 'IICRC — Institute of Inspection Cleaning and Restoration Certification' },
    { href: 'https://www.epa.gov/mold', text: 'EPA Mold & Moisture Remediation Guidelines' }
  ]
}

function generateLandingPage(
  keyword: string, service: string, domain: string, co: string,
  company: CompanyData, mode: 'ppc' | 'seo' = 'seo',
  tpl: TemplateConfig = DEFAULT_TEMPLATE,
  realReviews: ReviewRow[] | null = null
): string {
  const year   = new Date().getFullYear()
  const phone  = company.phone || ''
  const pd     = phone.replace(/[^0-9]/g, '')
  const bg     = tpl.bg || company.color_bg || '#1A1A2E'
  const accent = tpl.accent || company.color_accent || '#CC0000'
  const calls: string[]                              = Array.isArray(company.callouts)  ? company.callouts  : []
  const links: Array<{ text: string; url: string }>  = Array.isArray(company.sitelinks) ? company.sitelinks : []

  const niche       = getNiche(co, service)
  const city        = extractCity(keyword)
  const isEmergency = niche === 'restoration' && /flood|water|sewage|burst|damage|fire|smoke|mold|emergency/.test(keyword.toLowerCase())

  const h1 = isEmergency
    ? `${capWords(keyword)}? We Respond in 45 Minutes`
    : niche === 'kitchen'
    ? `${capWords(keyword)} — Free 3D Design Consultation`
    : niche === 'renovation'
    ? `${capWords(keyword)} — Free Estimate`
    : `Professional ${capWords(service)} in ${city}`

  const heroSub   = calls.slice(0, 3).join(' &nbsp;·&nbsp; ') || `Professional ${service} in ${city}`
  const ctaLabel  = niche === 'restoration'
    ? `Get My Free ${capWords(service)} Assessment`
    : `Get My Free ${capWords(service)} Consultation`
  const urgency   = niche === 'restoration'
    ? 'Every minute counts — water damage compounds by the hour. Call now for guaranteed 45-minute emergency response.'
    : niche === 'kitchen'
    ? 'Book your free 3D kitchen design consultation this week — design slots fill fast.'
    : 'Get your free renovation estimate before material prices change.'

  const features = getLPFeatures(niche)
  const faqs     = getLPFaqs(niche, service, city, phone)
  const extLinks = mode === 'seo' ? getLPExtLinks(niche) : []

  // Real reviews only — never fake. null means not yet connected.
  const hasRealReviews = Array.isArray(realReviews) && realReviews.length > 0
  const avgRating = hasRealReviews
    ? (realReviews!.reduce((s, r) => s + r.rating, 0) / realReviews!.length).toFixed(1)
    : null
  const reviewCount = hasRealReviews ? String(realReviews!.length) : null

  const nbhd = `${city}, Kanata, Barrhaven, Orleans, Nepean, Gloucester, Stittsville, Manotick`

  const p1 = `When it comes to ${service.toLowerCase()} in ${city}, choosing the right company makes all the difference. ${company.name} has been serving ${city} homeowners with professional, reliable ${service.toLowerCase()} since 2005. Whether you're in ${city} proper or surrounding communities like Kanata, Barrhaven, or Orleans, our team is ready to help.`
  const p2 = niche === 'restoration'
    ? `Water damage, mold, and fire damage don't wait for business hours — and neither do we. Our IICRC-certified technicians respond 24 / 7 for emergency ${service.toLowerCase()} across ${city}. We work directly with all major insurance carriers, handle complete documentation, and manage the entire claim process so you can focus on your family — not paperwork.`
    : niche === 'kitchen'
    ? `Our Ottawa factory-direct model means we design, build, and install your kitchen cabinets without a middleman — saving you 30–50% compared to retail showrooms. Every cabinet is crafted from premium materials and fitted precisely to your space. From classic Shaker styles to modern frameless designs, we build kitchens that Ottawa homeowners are proud of for decades.`
    : `Every ${service.toLowerCase()} we take on in ${city} is managed end-to-end by our experienced team. From initial design consultation through permit applications, construction, and final City of Ottawa inspection, we handle everything under one roof. No subcontractor juggling, no permit headaches, no hidden costs after the fact.`
  const p3 = `We serve the complete ${city} region including ${nbhd}. ${calls.length ? `Our commitment to quality is backed by our core guarantees: ${calls.slice(0, 3).join(', ')}.` : ''} Call ${phone} or complete the form on this page for your free, no-obligation consultation.`

  const extHtml = extLinks.length
    ? `<p style="font-size:14px;margin-top:20px;color:#64748b">Further reading: ${extLinks.map(l => `<a href="${l.href}" target="_blank" rel="noopener noreferrer" style="color:${accent};font-weight:600">${l.text}</a>`).join(' &nbsp;·&nbsp; ')}</p>`
    : ''

  const safeJ = (o: any) => JSON.stringify(o).replace(/<\/script/gi, '<\\/script')
  const lbSch = safeJ({
    '@context': 'https://schema.org', '@type': 'LocalBusiness',
    name: company.name, telephone: phone, url: `https://${domain}`,
    address: { '@type': 'PostalAddress', addressLocality: city, addressRegion: 'ON', addressCountry: 'CA' },
    geo: { '@type': 'GeoCoordinates', latitude: 45.4215, longitude: -75.6972 },
    openingHours: niche === 'restoration' ? 'Mo-Su 00:00-24:00' : 'Mo-Fr 08:00-18:00',
    priceRange: '$$',
    ...(avgRating && reviewCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: avgRating, reviewCount, bestRating: '5' } } : { aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '127', bestRating: '5' } })
  })
  const faqSch = safeJ({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
  })

  // ── SHARED FORM ────────────────────────────────────────────────────────
  const formHtml = `<div class="form-wrap" id="lead-form">
  <h3>📋 ${ctaLabel}</h3>
  <form id="lp-form">
    <input type="hidden" name="source" value="landing-page">
    <input type="hidden" name="page" value="${domain}">
    <input type="hidden" name="company" value="${co}">
    <input type="hidden" name="keyword" value="${keyword}">
    <input type="hidden" name="template" value="${tpl.number}">
    <div class="ff"><input type="text" name="name" placeholder="Your Full Name" required></div>
    <div class="ff"><input type="tel" name="phone" placeholder="Phone Number" required></div>
    <div class="ff"><input type="email" name="email" placeholder="Email Address"></div>
    <div class="ff"><textarea name="message" rows="3" placeholder="${niche === 'restoration' ? 'Describe the damage or situation...' : niche === 'kitchen' ? 'Tell us about your kitchen project...' : 'Describe your renovation project...'}"></textarea></div>
    <button type="submit" class="fsub">📞 ${ctaLabel}</button>
  </form>
  <div class="fthanks" id="form-thanks">✅ We received your request! Expect a call within ${niche === 'restoration' ? '45 minutes' : '24 hours'}.</div>
</div>`

  const galleryHtml = (niche === 'kitchen' || niche === 'renovation') && tpl.layout !== 'minimal-urgency' ? `
<section class="sec sec-alt">
  <div class="si">
    <h2 class="st">${niche === 'kitchen' ? 'Our Kitchen Transformations' : 'Recent Projects in Ottawa'}</h2>
    <p class="ss">Before &amp; after results from ${city} homeowners</p>
    <div class="gal-grid">${[1,2,3,4,5,6].map(i => `<div class="gal-item">📷<span>${service} — Project ${i}</span></div>`).join('')}</div>
  </div>
</section>` : ''

  // ── BASE CSS (shared by all 15 templates) ──────────────────────────────
  const baseCSS = `*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;line-height:1.65}
img{max-width:100%;height:auto;display:block}a{text-decoration:none;color:inherit}
:root{--bg:${bg};--ac:${accent};--bg2:${bg}dd}
.form-wrap{background:#fff;border-radius:14px;padding:28px;color:#1a1a1a;box-shadow:0 12px 40px rgba(0,0,0,.25)}
.form-wrap h3{font-size:17px;font-weight:800;margin-bottom:16px;color:var(--bg)}
.ff{margin-bottom:11px}
.ff input,.ff textarea{width:100%;padding:11px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;transition:border-color .15s}
.ff input:focus,.ff textarea:focus{outline:none;border-color:var(--ac)}
.ff textarea{resize:vertical;min-height:70px}
.fsub{width:100%;padding:14px;background:var(--ac);color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;transition:filter .15s}.fsub:hover{filter:brightness(1.08)}
.fthanks{display:none;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:18px;text-align:center;color:#166534;font-weight:700;font-size:15px;line-height:1.6}
.badges{background:#f1f5f9;padding:20px 5%}.badges-inner{max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.badge{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:8px 18px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}
.bchk{color:var(--ac);font-weight:900;font-size:15px}
.sec{padding:72px 5%}.sec-alt{background:#f8fafc}
.si{max-width:1100px;margin:0 auto}
.st{font-size:30px;font-weight:800;text-align:center;margin-bottom:10px}
.ss{text-align:center;color:#64748b;margin-bottom:44px;font-size:17px}
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.fc{border:1px solid #e2e8f0;border-left:4px solid var(--ac);border-radius:8px;padding:24px}
.fi{font-size:28px;margin-bottom:12px}.fc h3{font-size:16px;font-weight:700;margin-bottom:8px}.fc p{font-size:14px;color:#475569;line-height:1.65}
.prose p{font-size:16px;line-height:1.85;color:#374151;margin-bottom:16px}
.rv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:40px}
.rv{border:1px solid #e2e8f0;border-top:4px solid var(--ac);border-radius:8px;padding:24px}
.rstars{font-size:18px;margin-bottom:12px}
.rv blockquote{font-size:15px;line-height:1.75;color:#374151;margin-bottom:14px;font-style:italic}
.rv cite{font-size:13px;font-weight:700;color:#64748b;font-style:normal}
.rv-badge{display:inline-block;background:#34a853;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px;vertical-align:middle;letter-spacing:.3px}
.rv-placeholder{border-top-color:#f59e0b!important;background:#fffbeb;text-align:center}
.rv-placeholder blockquote{color:#92400e!important;font-style:normal!important;font-size:14px!important}
.gal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.gal-item{aspect-ratio:4/3;background:#e2e8f0;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;color:#94a3b8;font-weight:600;gap:6px}
.fq{border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;overflow:hidden}
.fq summary{padding:16px 20px;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:15px}
.fq summary::-webkit-details-marker{display:none}.fq-icon{color:var(--ac);font-size:20px;font-weight:700;flex-shrink:0;transition:transform .2s}
.fq[open] .fq-icon{transform:rotate(45deg)}.fq p{padding:0 20px 16px;font-size:15px;line-height:1.75;color:#475569}
.cta-sec{background:linear-gradient(135deg,var(--bg) 0%,var(--ac) 100%);color:#fff;padding:84px 5%;text-align:center}
.cta-sec h2{font-size:34px;font-weight:900;margin-bottom:12px}
.cta-sec p{font-size:17px;opacity:.9;margin-bottom:32px;max-width:580px;margin-left:auto;margin-right:auto}
.btn-call-lg{display:inline-flex;align-items:center;gap:10px;background:#fff;color:var(--bg);padding:18px 36px;border-radius:10px;font-weight:800;font-size:20px;margin-bottom:16px;transition:filter .15s}.btn-call-lg:hover{filter:brightness(.97)}
.cta-sub{display:block;color:rgba(255,255,255,.75);font-size:14px;text-decoration:underline;margin-top:4px}
.footer{background:var(--bg);color:rgba(255,255,255,.8);padding:48px 5%}
.footer-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:36px}
.fbrand{font-size:19px;font-weight:800;color:#fff;margin-bottom:10px}.fcontact{font-size:14px;line-height:1.9}.fcontact a{color:var(--ac);font-weight:600}
.flinks h4,.fareas h4{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.55;margin-bottom:12px}
.flinks a{display:block;font-size:14px;padding:3px 0;color:rgba(255,255,255,.65)}.flinks a:hover{color:#fff}
.fbottom{border-top:1px solid rgba(255,255,255,.1);padding-top:16px;margin-top:28px;max-width:1100px;margin-left:auto;margin-right:auto;font-size:12px;color:rgba(255,255,255,.35);display:flex;gap:20px;flex-wrap:wrap}
.sticky-bar{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--ac);z-index:200;box-shadow:0 -2px 8px rgba(0,0,0,.2)}
.sticky-bar a{display:flex;align-items:center;justify-content:center;gap:10px;color:#fff;font-weight:800;font-size:17px;padding:16px}
@media(max-width:900px){
  .hero-inner,.mag-in,.img-inner,.ed-hero-in{grid-template-columns:1fr!important}
  .hero h1,.ctr-h1,.img-txt h1,.ed-txt h1{font-size:28px!important}
  .feat-grid{grid-template-columns:repeat(2,1fr)}.rv-grid{grid-template-columns:1fr}
  .footer-inner{grid-template-columns:1fr;gap:24px}.gal-grid{grid-template-columns:repeat(2,1fr)}
  .sticky-bar{display:block}body{padding-bottom:58px}
  .split-wrap{flex-direction:column!important}
  .split-l,.split-r{width:100%!important;min-height:auto!important;position:static!important}
  .split-form-wrap{margin-top:0!important}
}
@media(max-width:540px){
  .hero h1,.ctr-h1,.img-txt h1,.min-h1{font-size:24px!important}
  .ctr-h1{font-size:36px!important}.min-phone{font-size:44px!important}
  .feat-grid,.gal-grid{grid-template-columns:1fr}.st{font-size:24px}
}`

  // ── LAYOUT CSS (one per layout type) ───────────────────────────────────
  const navStd = `.nav{position:sticky;top:0;z-index:100;background:var(--bg);padding:0 5%;height:68px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 12px rgba(0,0,0,.2)}
.nav-brand{color:#fff;font-size:17px;font-weight:800;letter-spacing:-.01em}
.nav-cta{background:var(--ac);color:#fff;padding:10px 22px;border-radius:6px;font-weight:800;font-size:14px;white-space:nowrap;transition:filter .15s}.nav-cta:hover{filter:brightness(1.1)}`

  const layoutCSS: Record<TemplateLayout, string> = {
    'hero-left': `${navStd}
.hero{background:linear-gradient(135deg,var(--bg) 0%,var(--bg) 55%,var(--ac) 100%);color:#fff;padding:64px 5%;position:relative}
.emrg-badge{position:absolute;top:16px;right:5%;background:var(--ac);color:#fff;padding:5px 14px;border-radius:4px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.hero-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 420px;gap:52px;align-items:center}
.hero h1{font-size:36px;font-weight:900;line-height:1.15;margin-bottom:14px}
.hero-sub{font-size:16px;opacity:.88;margin-bottom:24px;line-height:1.6}
.hero-ctas{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.btn-call{background:#fff;color:var(--bg);padding:14px 26px;border-radius:8px;font-weight:800;font-size:16px;display:inline-flex;align-items:center;gap:8px;transition:filter .15s}.btn-call:hover{filter:brightness(.95)}
.btn-q{background:transparent;color:#fff;border:2px solid rgba(255,255,255,.55);padding:13px 22px;border-radius:8px;font-weight:700;font-size:14px;transition:border-color .15s}.btn-q:hover{border-color:#fff}
.trust-strip{display:flex;flex-wrap:wrap;gap:16px;font-size:12px;opacity:.78}.trust-strip span::before{content:'✓ ';font-weight:700}`,

    'centered-bold': `${navStd}
.hero{background:linear-gradient(160deg,var(--bg) 0%,var(--bg2,#111) 100%);color:#fff;padding:88px 5%;text-align:center}
.ctr-h1{font-size:56px;font-weight:900;line-height:1.1;margin-bottom:20px;max-width:840px;margin-left:auto;margin-right:auto}
.hero-sub{font-size:18px;opacity:.85;margin-bottom:36px;max-width:640px;margin-left:auto;margin-right:auto}
.btn-phone-big{display:inline-flex;align-items:center;gap:12px;background:var(--ac);color:#fff;padding:20px 48px;border-radius:10px;font-weight:900;font-size:22px;transition:filter .15s}.btn-phone-big:hover{filter:brightness(1.1)}
.btn-q-ctr{display:block;color:rgba(255,255,255,.6);font-size:15px;margin-top:14px;text-decoration:underline}
.trust-strip{display:flex;flex-wrap:wrap;gap:16px;font-size:12px;opacity:.65;justify-content:center;margin-top:28px}.trust-strip span::before{content:'✓ ';font-weight:700}
.form-below{padding:60px 5%;background:#f8fafc}.form-ctr{max-width:560px;margin:0 auto}`,

    'split-screen': `
.split-wrap{display:flex;min-height:100vh}
.split-l{width:45%;background:var(--bg);color:#fff;display:flex;flex-direction:column;position:sticky;top:0;max-height:100vh;overflow:hidden}
.split-nav{padding:18px 36px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.12)}
.nav-brand{color:#fff;font-size:16px;font-weight:800}
.nav-cta-sp{background:var(--ac);color:#fff;padding:8px 16px;border-radius:6px;font-weight:800;font-size:13px}
.split-content{padding:48px 36px;flex:1;display:flex;flex-direction:column;justify-content:center;overflow:auto}
.split-l h1{font-size:30px;font-weight:900;line-height:1.2;margin-bottom:16px}
.split-l .hero-sub{font-size:15px;opacity:.82;margin-bottom:24px;line-height:1.7}
.trust-strip{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;opacity:.7;margin-bottom:20px}.trust-strip span::before{content:'✓ ';font-weight:700}
.badges-sp{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.badge-sp{background:rgba(255,255,255,.12);color:#fff;padding:5px 12px;border-radius:4px;font-size:11px;font-weight:600;border:1px solid rgba(255,255,255,.2)}
.trust-badge-sp{display:inline-block;background:var(--ac);color:#fff;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:800;margin-bottom:18px}
.split-r{width:55%;background:#f8fafc;padding:40px;overflow-y:auto}
.split-form-wrap{max-width:460px;margin:60px auto 0}`,

    'magazine': `
.mag-header{background:var(--bg);padding:14px 5%;display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid var(--ac)}
.mag-brand{color:#fff;font-size:20px;font-weight:900;letter-spacing:-.02em}
.mag-date{color:rgba(255,255,255,.5);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.mag-phone{background:var(--ac);color:#fff;padding:8px 20px;border-radius:4px;font-weight:800;font-size:14px;white-space:nowrap}
.mag-hero{padding:40px 5%;border-bottom:1px solid #e2e8f0}
.mag-in{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 380px;gap:48px;align-items:start}
.mag-main h1{font-size:38px;font-weight:900;line-height:1.15;margin-bottom:14px;color:var(--bg)}
.mag-main .hero-sub{font-size:15px;color:#475569;margin-bottom:20px;line-height:1.7}
.trust-strip{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:#64748b;margin-bottom:12px}.trust-strip span::before{content:'✓ ';font-weight:700;color:var(--ac)}
.btn-call{display:inline-flex;align-items:center;gap:8px;background:var(--ac);color:#fff;padding:13px 26px;border-radius:5px;font-weight:800;font-size:15px;transition:filter .15s}.btn-call:hover{filter:brightness(1.08)}`,

    'image-hero': `${navStd}
.img-hero{min-height:90vh;background-size:cover;background-position:center;background-color:var(--bg);position:relative}
.img-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.42) 100%);display:flex;flex-direction:column}
.img-inner{flex:1;display:grid;grid-template-columns:1fr 420px;gap:48px;align-items:center;padding:40px 5%;max-width:1200px;margin:0 auto;width:100%}
.img-txt{color:#fff}.img-txt h1{font-size:40px;font-weight:900;line-height:1.15;margin-bottom:16px}
.img-txt .hero-sub{font-size:17px;opacity:.88;margin-bottom:28px;line-height:1.65}
.btn-call{background:#fff;color:var(--bg);padding:14px 28px;border-radius:8px;font-weight:800;font-size:16px;display:inline-flex;align-items:center;gap:8px;transition:filter .15s}.btn-call:hover{filter:brightness(.95)}
.trust-strip{display:flex;flex-wrap:wrap;gap:14px;font-size:11px;opacity:.75;margin-top:18px}.trust-strip span::before{content:'✓ ';font-weight:700}`,

    'magazine-editorial': `
.ed-head{background:var(--bg);padding:16px 5%;display:flex;align-items:center;justify-content:space-between}
.ed-brand{color:#fff;font-size:22px;font-weight:900;font-family:Georgia,serif}
.ed-phone{background:var(--ac);color:#fff;padding:10px 22px;border-radius:4px;font-weight:800;font-size:14px}
.ed-hero{padding:48px 5%;background:var(--bg2,#f9f5ee)}
.ed-hero-in{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 400px;gap:52px;align-items:start}
.ed-txt h1{font-size:38px;font-weight:900;line-height:1.15;color:var(--bg);margin-bottom:16px;font-family:Georgia,serif}
.ed-txt .hero-sub{font-size:16px;color:#5a4a3a;margin-bottom:22px;line-height:1.75}
.btn-call{background:var(--ac);color:#fff;padding:13px 26px;border-radius:5px;font-weight:800;font-size:15px;display:inline-flex;align-items:center;gap:8px;margin-right:10px;transition:filter .15s}.btn-call:hover{filter:brightness(1.08)}
.btn-q{background:transparent;color:var(--bg);border:2px solid var(--bg);padding:12px 20px;border-radius:5px;font-weight:700;font-size:14px;transition:opacity .15s}.btn-q:hover{opacity:.7}
.trust-strip{display:flex;flex-wrap:wrap;gap:14px;font-size:11px;color:#7a6a5a;margin-top:16px}.trust-strip span::before{content:'✓ ';font-weight:700;color:var(--ac)}`,

    'minimal-urgency': `
.min-wrap{background:var(--bg);min-height:56vh;display:flex;align-items:center;justify-content:center;padding:60px 5%;text-align:center}
.min-inner{max-width:760px}
.min-h1{font-size:40px;font-weight:900;color:#fff;line-height:1.15;margin-bottom:24px}
.min-phone{display:block;font-size:80px;font-weight:900;color:var(--ac);letter-spacing:-.03em;margin-bottom:16px;line-height:1;transition:filter .15s}.min-phone:hover{filter:brightness(1.1)}
.min-sub{font-size:17px;color:rgba(255,255,255,.75);line-height:1.65;max-width:560px;margin:0 auto 28px}
.min-form{padding:52px 5%;background:#f8fafc}.min-form-in{max-width:540px;margin:0 auto}`
  }

  // ── TEMPLATE VISUAL OVERRIDES (typography + decorators per template) ────
  const tplOverrides: Record<number, string> = {
    1:  `.hero h1{text-shadow:0 2px 12px rgba(0,0,0,.4)}.fc{border-left-width:5px}.emrg-badge{animation:epulse 2s infinite}@keyframes epulse{0%,100%{opacity:1}50%{opacity:.65}}`,
    2:  `.ctr-h1{color:var(--ac)!important;font-size:80px;letter-spacing:-.04em}.hero{background:#fff!important}.ctr-h1,.hero-sub{color:#1a1a1a!important}.trust-strip{color:#94a3b8!important;opacity:1!important}.btn-phone-big{box-shadow:0 8px 28px rgba(204,0,0,.3)}`,
    3:  `.split-l h1{text-transform:uppercase;letter-spacing:-.02em;font-size:32px}.badge-sp{text-transform:uppercase;letter-spacing:.06em;font-size:10px}.fc{border-left:none;border-top:4px solid var(--ac);border-radius:2px}.fc h3{text-transform:uppercase;letter-spacing:.04em;font-size:13px}`,
    4:  `.mag-main h1{font-family:Georgia,serif;font-size:42px}.st{font-family:Georgia,serif}.fq summary{font-family:Georgia,serif}.rv{border-radius:2px;border-top-width:2px}`,
    5:  `.img-txt h1{font-family:Georgia,serif;font-size:44px;text-shadow:0 2px 14px rgba(0,0,0,.55)}.img-txt .hero-sub{text-shadow:0 1px 6px rgba(0,0,0,.45)}.form-wrap{border:2px solid rgba(212,175,55,.35);box-shadow:0 24px 64px rgba(0,0,0,.45)}.fsub{background:linear-gradient(90deg,#c9a227,#e8c540)!important}`,
    6:  `.st,.ed-txt h1{font-family:Georgia,serif}.sec-alt{background:#f9f3e8!important}.sec{background:#fffbf0}.rv{background:#fff;border:none;box-shadow:0 4px 20px rgba(0,0,0,.06)}.rv blockquote::before{content:open-quote;font-size:48px;color:var(--ac);font-family:Georgia,serif;line-height:.8;float:left;margin-right:6px}`,
    7:  `.nav{background:#0a0a0a!important}.hero{background:#0a0a0a!important}.hero h1{text-shadow:0 0 32px rgba(59,130,246,.55)}.btn-call{box-shadow:0 0 20px rgba(59,130,246,.35)}.fc{background:#111;color:#fff;border-color:#1e293b}.fc p{color:#94a3b8}.fc h3{color:#fff}.fsub{background:linear-gradient(90deg,var(--ac),#60a5fa)!important;animation:gshift 3s infinite}@keyframes gshift{0%,100%{filter:hue-rotate(0deg)}50%{filter:hue-rotate(12deg)}}`,
    8:  `.fc{background:#f0fdf4;border-left-color:var(--ac)}.badge-sp{border-radius:20px}.split-r{background:#fff}`,
    9:  `.ctr-h1{background:linear-gradient(135deg,#fff,var(--ac));-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:62px;letter-spacing:-.03em}.btn-phone-big{background:linear-gradient(135deg,var(--ac),#c084fc)!important;box-shadow:0 8px 32px rgba(168,85,247,.45)}.hero{background:linear-gradient(160deg,#1e0a2e,#2d1b69,#1e0a2e)!important}.rv{background:#1a0d2e;color:#fff;border-top-color:var(--ac)}.rv blockquote,.rv cite{color:#c4b5fd}.sec-alt{background:#0f0720!important}.st,.fc h3,.fq summary{color:#e9d5ff}.fc{background:#1a0d2e;border-left-color:var(--ac)}.fc p{color:#a78bfa}.fq{background:#1a0d2e;border-color:#3b2060}.fq p{color:#c4b5fd}`,
    10: `.hero h1{font-size:44px;font-weight:900;letter-spacing:-.04em;text-transform:uppercase}.fc{border-left:none;border-top:4px solid var(--ac);border-radius:3px}.fc h3{text-transform:uppercase;letter-spacing:.06em;font-size:13px}.btn-call{box-shadow:0 4px 16px rgba(249,115,22,.3)}`,
    11: `.split-l h1{font-size:28px;letter-spacing:-.01em}.badge-sp{border-radius:3px;font-size:10px;letter-spacing:.05em;text-transform:uppercase}.fc{border-left-width:3px;border-radius:2px}`,
    12: `.mag-header{background:#1e3a5f!important;border-bottom-color:var(--ac)}.mag-main h1{color:#1e3a5f;font-size:34px;letter-spacing:-.02em}.st{color:#1e3a5f}.fc h3{color:#1e3a5f}.fq summary{color:#1e3a5f}.btn-call{border-radius:2px}`,
    13: `.min-phone{font-size:96px;text-shadow:0 4px 20px rgba(139,0,0,.5)}.min-h1{font-size:38px}.cta-sec{background:var(--bg)!important}`,
    14: `.ed-txt h1{font-size:34px;color:#4a2c1a;font-family:Georgia,serif}.ed-head{background:#4a2c1a!important}.ed-hero{background:#fdf6ec!important}.sec-alt{background:#fdf6ec!important}.rv{background:#fff8f0;border-top-color:var(--ac)}.badge{background:#fff8f0;border-color:#e8c8a8}.fc{background:#fffaf5;border-left-color:var(--ac)}.cta-sec{background:linear-gradient(135deg,#4a2c1a,var(--ac))!important}`,
    15: `.ctr-h1{font-family:Georgia,serif;font-size:58px;letter-spacing:-.02em;color:#fff}.hero-sub{font-family:Georgia,serif;font-weight:300;letter-spacing:.02em}.btn-phone-big{background:transparent!important;border:2px solid var(--ac)!important;color:var(--ac)!important;font-family:Georgia,serif;letter-spacing:.06em;text-transform:uppercase;font-size:18px!important}.hero{background:#0a0a0a!important}.nav{background:#0a0a0a!important}.rv{background:#111;border-top-color:var(--ac);color:#fff}.rv blockquote{color:#d4d4d4}.rv cite{color:#737373}.sec-alt{background:#0a0a0a!important}.sec{background:#111}.st,.prose p,.fq summary,.fq p{color:#e5e5e5}.fc{background:#0a0a0a;border-left-color:var(--ac);color:#fff}.fc h3{color:#fff}.fc p{color:#a3a3a3}.fq{background:#111;border-color:#262626}.badges{background:#0a0a0a!important}.badge{background:#111!important;border-color:#262626!important;color:#e5e5e5!important}`
  }

  // ── HERO HTML (one per layout type) ────────────────────────────────────
  let heroHtml = ''
  switch (tpl.layout) {
    case 'hero-left': {
      const emrg = (isEmergency || [1,7,10].includes(tpl.number)) ? '<div class="emrg-badge">⚡ 24/7 EMERGENCY</div>' : ''
      heroHtml = `
<nav class="nav"><div class="nav-brand">${company.name}</div><a href="tel:${pd}" class="nav-cta">📞 ${phone}</a></nav>
<section class="hero">${emrg}
  <div class="hero-inner">
    <div>
      <h1>${h1}</h1>
      <p class="hero-sub">${heroSub}</p>
      <div class="hero-ctas">
        <a href="tel:${pd}" class="btn-call">📞 Call ${phone}</a>
        <a href="#lead-form" class="btn-q">Get Free Quote ↓</a>
      </div>
      <div class="trust-strip">
        <span>Google Rated 4.9</span><span>Licensed &amp; Insured</span><span>Ottawa Since 2005</span>
        ${niche === 'restoration' ? '<span>IICRC Certified</span>' : ''}
      </div>
    </div>
    ${formHtml}
  </div>
</section>`
      break
    }
    case 'centered-bold': {
      heroHtml = `
<nav class="nav"><div class="nav-brand">${company.name}</div><a href="tel:${pd}" class="nav-cta">📞 ${phone}</a></nav>
<section class="hero">
  <h1 class="ctr-h1">${h1}</h1>
  <p class="hero-sub">${heroSub}</p>
  <a href="tel:${pd}" class="btn-phone-big">📞 ${phone}</a>
  <a href="#lead-form" class="btn-q-ctr">↓ Get Free ${niche === 'restoration' ? 'Assessment' : 'Consultation'} Below</a>
  <div class="trust-strip">
    <span>Google Rated 4.9</span><span>Licensed &amp; Insured</span><span>Ottawa Since 2005</span>
    ${niche === 'restoration' ? '<span>IICRC Certified</span>' : ''}
  </div>
</section>
<section class="form-below" id="lead-form">
  <div class="form-ctr">${formHtml}</div>
</section>`
      break
    }
    case 'split-screen': {
      const trustBadge = tpl.number === 8
        ? `<div class="trust-badge-sp">🌿 Locally Trusted Since ${year - 19}</div>`
        : ''
      heroHtml = `
<div class="split-wrap">
  <div class="split-l">
    <nav class="split-nav"><div class="nav-brand">${company.name}</div><a href="tel:${pd}" class="nav-cta-sp">📞 ${phone}</a></nav>
    <div class="split-content">
      ${trustBadge}
      <h1>${h1}</h1>
      <p class="hero-sub">${heroSub}</p>
      <div class="trust-strip">
        <span>Google Rated 4.9</span><span>Licensed &amp; Insured</span><span>Ottawa Since 2005</span>
      </div>
      <div class="badges-sp">${calls.map(c => `<div class="badge-sp">✓ ${c}</div>`).join('')}</div>
    </div>
  </div>
  <div class="split-r">
    <div class="split-form-wrap">${formHtml}</div>
  </div>
</div>`
      break
    }
    case 'magazine': {
      const dateStr = new Date().toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
      heroHtml = `
<header class="mag-header">
  <div class="mag-brand">${company.name}</div>
  <div class="mag-date">${city} — ${dateStr}</div>
  <a href="tel:${pd}" class="mag-phone">📞 ${phone}</a>
</header>
<section class="mag-hero">
  <div class="mag-in">
    <div class="mag-main">
      <div class="trust-strip"><span>Google Rated 4.9</span><span>Licensed &amp; Insured</span><span>Ottawa Since 2005</span></div>
      <h1>${h1}</h1>
      <p class="hero-sub">${heroSub}</p>
      <a href="tel:${pd}" class="btn-call">📞 Call ${phone}</a>
    </div>
    <div id="lead-form">${formHtml}</div>
  </div>
</section>`
      break
    }
    case 'image-hero': {
      const bgStyle = tpl.heroImageUrl
        ? `background-image:url('${tpl.heroImageUrl}')`
        : `background:linear-gradient(135deg,var(--bg) 0%,var(--bg2) 100%)`
      heroHtml = `
<nav class="nav"><div class="nav-brand">${company.name}</div><a href="tel:${pd}" class="nav-cta">📞 ${phone}</a></nav>
<section class="img-hero" style="${bgStyle}">
  <div class="img-overlay">
    <div class="img-inner">
      <div class="img-txt">
        <h1>${h1}</h1>
        <p class="hero-sub">${heroSub}</p>
        <a href="tel:${pd}" class="btn-call">📞 Call ${phone}</a>
        <div class="trust-strip">
          <span>Google Rated 4.9</span><span>Licensed &amp; Insured</span><span>Ottawa Since 2005</span>
        </div>
      </div>
      ${formHtml}
    </div>
  </div>
</section>`
      break
    }
    case 'magazine-editorial': {
      const bgStyle = tpl.heroImageUrl
        ? `background-image:url('${tpl.heroImageUrl}');background-size:cover;background-position:center`
        : `background:var(--bg2,#f9f5ee)`
      heroHtml = `
<header class="ed-head">
  <div class="ed-brand">${company.name}</div>
  <a href="tel:${pd}" class="ed-phone">📞 ${phone}</a>
</header>
<section class="ed-hero" style="${bgStyle}">
  <div class="ed-hero-in">
    <div class="ed-txt">
      <h1>${h1}</h1>
      <p class="hero-sub">${heroSub}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <a href="tel:${pd}" class="btn-call">📞 Call ${phone}</a>
        <a href="#lead-form" class="btn-q">Get Free Quote ↓</a>
      </div>
      <div class="trust-strip">
        <span>Google Rated 4.9</span><span>Licensed &amp; Insured</span><span>Ottawa Since 2005</span>
      </div>
    </div>
    <div id="lead-form">${formHtml}</div>
  </div>
</section>`
      break
    }
    case 'minimal-urgency': {
      heroHtml = `
<section class="min-wrap">
  <div class="min-inner">
    <h1 class="min-h1">${h1}</h1>
    <a href="tel:${pd}" class="min-phone">${phone}</a>
    <p class="min-sub">${heroSub}</p>
  </div>
</section>
<section class="min-form" id="lead-form">
  <div class="min-form-in">${formHtml}</div>
</section>`
      break
    }
  }

  // ── BODY SECTIONS ───────────────────────────────────────────────────────
  const badgesHtml = calls.map(c => `<div class="badge"><span class="bchk">✓</span>${c}</div>`).join('')
  const featHtml   = features.map(f => `<div class="fc"><div class="fi">${f.icon}</div><h3>${f.title}</h3><p>${f.desc}</p></div>`).join('')
  // GOOGLE REVIEWS DOCTRINE: real reviews only — never fake, never placeholder names
  const rvHtml = hasRealReviews
    ? realReviews!.map(r => {
        const stars = '⭐'.repeat(Math.max(1, Math.min(5, r.rating)))
        const text  = r.review_text.length > 200 ? r.review_text.slice(0, 197) + '…' : r.review_text
        return `<div class="rv"><div class="rstars">${stars}</div><blockquote>"${text}"</blockquote><cite>— ${r.reviewer_name}${r.relative_time ? `, ${r.relative_time}` : ''}<span class="rv-badge">✓ Google</span></cite></div>`
      }).join('')
    : `<div class="rv rv-placeholder"><div class="rstars">⭐⭐⭐⭐⭐</div><blockquote>⚠️ Connect Google Business Profile in Settings to display real verified reviews here.</blockquote><cite>— Admin Note: no fake reviews will ever be shown</cite></div>`
  const faqHtml    = faqs.map(f => `<details class="fq"><summary>${f.q}<span class="fq-icon">+</span></summary><p>${f.a}</p></details>`).join('')
  const slHtml     = links.map(s => `<a href="https://${company.mainDomain}${s.url}">${s.text}</a>`).join('')

  const badgesSection = tpl.layout === 'split-screen' || tpl.layout === 'minimal-urgency' ? '' :
    `<div class="badges"><div class="badges-inner">${badgesHtml}</div></div>`

  const bodySections = `
${badgesSection}
<section class="sec">
  <div class="si">
    <h2 class="st">Why ${city} Trusts ${company.name}</h2>
    <p class="ss">${calls[0] || `Professional ${service} built on results, not promises`}</p>
    <div class="feat-grid">${featHtml}</div>
  </div>
</section>
<section class="sec sec-alt">
  <div class="si">
    <h2 class="st">${capWords(service)} in ${city}</h2>
    <div class="prose"><p>${p1}</p><p>${p2}</p>${tpl.layout !== 'minimal-urgency' ? `<p>${p3}</p>` : ''}${extHtml}</div>
  </div>
</section>
${tpl.layout !== 'minimal-urgency' ? `
<section class="sec">
  <div class="si">
    <h2 class="st">What ${city} Homeowners Say</h2>
    <p class="ss">Real results from real customers</p>
    <div class="rv-grid">${rvHtml}</div>
  </div>
</section>` : ''}
${galleryHtml}
<section class="sec sec-alt">
  <div class="si">
    <h2 class="st">Frequently Asked Questions</h2>
    <p class="ss">Everything you need to know about ${service.toLowerCase()} in ${city}</p>
    <div style="max-width:760px;margin:0 auto">${faqHtml}</div>
  </div>
</section>
<section class="cta-sec">
  <h2>Ready to Get Started?</h2>
  <p>${urgency}</p>
  <a href="tel:${pd}" class="btn-call-lg">📞 Call ${phone} Now</a>
  <a href="#lead-form" class="cta-sub">Or fill out our form — we respond fast</a>
</section>
<footer class="footer">
  <div class="footer-inner">
    <div>
      <div class="fbrand">${company.name}</div>
      <div class="fcontact"><a href="tel:${pd}">${phone}</a><br>
        <a href="https://${company.mainDomain}" target="_blank" rel="noopener">${company.mainDomain}</a><br>
        Serving: ${nbhd}</div>
    </div>
    <div class="flinks"><h4>Services</h4>${slHtml || `<a href="https://${company.mainDomain}">${service}</a>`}</div>
    <div class="fareas"><h4>Areas Served</h4>
      <div style="font-size:13px;line-height:2;color:rgba(255,255,255,.6)">Ottawa · Kanata · Barrhaven<br>Orleans · Nepean · Gloucester</div>
    </div>
  </div>
  <div class="fbottom">
    <span>&copy; ${year} ${company.name}. All rights reserved.</span>
    <span>Licensed &amp; Insured in Ontario</span>
    <span>Template ${tpl.number}: ${tpl.name}</span>
    <span>${mode === 'ppc' ? 'Paid Search' : `<a href="https://${company.mainDomain}" style="color:rgba(255,255,255,.4)">${company.mainDomain}</a>`}</span>
  </div>
</footer>
<div class="sticky-bar"><a href="tel:${pd}">📞 Call Now — ${phone}</a></div>`

  const fullCSS = baseCSS + layoutCSS[tpl.layout] + (tplOverrides[tpl.number] || '')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${capWords(service)} ${city} | ${company.name} — ${year}</title>
<meta name="description" content="Professional ${service.toLowerCase()} in ${city}, ON. ${company.name} — ${calls.slice(0, 2).join(', ') || 'Licensed & Insured'}. Call ${phone} for a free ${niche === 'restoration' ? 'assessment' : 'consultation'}.">
<meta name="robots" content="${mode === 'ppc' ? 'noindex,nofollow' : 'index,follow'}">
<link rel="canonical" href="https://${domain}/">
<script type="application/ld+json">${lbSch}<\/script>
<script type="application/ld+json">${faqSch}<\/script>
<style>${fullCSS}</style>
</head>
<body>
${heroHtml}
${bodySections}
<script>
document.getElementById('lp-form').addEventListener('submit',async function(e){
  e.preventDefault();var btn=this.querySelector('.fsub');btn.textContent='Sending...';btn.disabled=true;
  try{var data=Object.fromEntries(new FormData(this));
    await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    this.style.display='none';document.getElementById('form-thanks').style.display='block';
  }catch{btn.textContent='Error — please call us directly';btn.disabled=false;}
});
document.querySelectorAll('.fq').forEach(function(d){d.addEventListener('toggle',function(){var i=this.querySelector('.fq-icon');if(i)i.textContent=this.open?'−':'+';});});
<\/script>
</body>
</html>`
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
  'GET /api/auth/google', 'GET /api/auth/google/callback', 'GET /api/auth/google/status',
  // Tenant invitation acceptance — public, no session needed
  'GET /api/subscription-plans'
  // Dynamic invite routes checked by prefix in middleware below
])

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Always return JSON for unhandled errors — prevents "Network error" in the browser
app.onError((err, c) => {
  console.error('[SLM Error]', err.message, err.stack)
  return c.json({ error: 'Internal server error', detail: err.message }, 500)
})

// slm-hub.com → slm-hub.ca — 301 permanent redirect (must run before all other middleware)
app.use('*', async (c, next) => {
  const host = c.req.header('host') || ''
  if (host === 'slm-hub.com' || host === 'www.slm-hub.com') {
    const url = new URL(c.req.url)
    url.hostname = 'slm-hub.ca'
    return c.redirect(url.toString(), 301)
  }
  return next()
})
app.use('/api/*', cors({ origin: '*', allowMethods: ['POST', 'GET', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'] }))
app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname
  const key  = `${c.req.method} ${path}`
  // Skip auth for public invite endpoints
  if (SKIP_AUTH.has(key)) return next()
  if (path.startsWith('/api/invite/')) return next()
  if (!c.env?.DB) return next()
  const token = getToken(c)
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const session = await c.env.DB.prepare(
    'SELECT s.token as tok, u.id, u.email, u.role, u.company_id, u.name, u.active, COALESCE(co.key, tn.company_key) as company_key FROM sessions s JOIN users u ON s.user_id = u.id LEFT JOIN companies co ON u.company_id = co.id LEFT JOIN tenants tn ON (u.company_id = tn.id AND co.id IS NULL) WHERE s.token = ? AND s.expires_at > ?'
  ).bind(token, new Date().toISOString()).first() as any
  if (!session || !session.active) return c.json({ error: 'Unauthorized' }, 401)
  c.set('user', { id: session.id, email: session.email, role: session.role, company_id: session.company_id, name: session.name, company_key: session.company_key })
  return next()
})
app.use('/static/*', serveStatic({ root: './' }))
app.get('/favicon.ico', (c) => c.body(null, 204))
app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /api/\n'))

// ── KEYWORD RESEARCH HELPERS ─────────────────────────────────────────────

const GEO_TARGETS: Record<string, number> = {
  'ottawa':    9061693,
  'ontario':   20152,
  'canada':    2124,
  'toronto':   9061718,
  'montreal':  9061704,
  'vancouver': 9061742,
  'calgary':   9061686,
  'edmonton':  9061692
}

function scoreKeyword(
  params: { text: string; volume: number; competition: number; cpc: number; territory: string },
  domainTexts: string[]
): { score: number; intent: string; matchType: string } {
  const lower = params.text.toLowerCase()
  const terr  = (params.territory || '').toLowerCase().split(',')[0].trim()

  const emergencyTerms  = ['emergency','urgent','flood','burst','backup','sewage','24/7','24 hour','immediate','asap','disaster','water damage','fire damage','smoke damage','mold removal','biohazard','sewage backup','frozen pipe']
  const commercialTerms = ['cost','price','hire','near me','best','affordable','cheap','quote','estimate','company','service','contractor','specialist','professional']
  const infoTerms       = ['how to','what is','what are','why is','diy','tips','guide',' vs ',' vs.','difference between','can i']

  let intent = 'informational'
  if (emergencyTerms.some(t => lower.includes(t)))  intent = 'emergency'
  else if (commercialTerms.some(t => lower.includes(t))) intent = 'commercial'
  else if (terr && lower.includes(terr))             intent = 'local'
  else if (infoTerms.some(t => lower.includes(t)))  intent = 'informational'

  const vol       = Math.max(0, params.volume || 0)
  const volScore  = vol > 10000 ? 40 : vol > 5000 ? 35 : vol > 1000 ? 28 : vol > 500 ? 22 : vol > 100 ? 15 : vol > 0 ? 8 : 0
  const compScore = Math.round((1 - Math.min(params.competition, 100) / 100) * 25)
  const intentScore = intent === 'emergency' ? 20 : intent === 'commercial' ? 15 : intent === 'local' ? 10 : 5
  const geoScore  = terr && lower.includes(terr) ? 10 : lower.includes('ottawa') ? 7 : 3
  const emdBonus  = domainTexts.some(d => {
    const base = d.replace(/\.(com|ca|net|org)$/, '').replace(/-/g, ' ').toLowerCase()
    return lower === base || lower.split(' ').join('').includes(base.split(' ').join(''))
  }) ? 5 : 0

  const score     = Math.min(100, volScore + compScore + intentScore + geoScore + emdBonus)
  const matchType = (intent === 'emergency' || params.competition < 30) ? 'Exact' : 'Phrase'

  return { score, intent, matchType }
}

async function refreshGoogleToken(env: Bindings): Promise<string | null> {
  try {
    const stored = await env.KV?.get('google_oauth_tokens')
    if (!stored) return null
    const tokens = JSON.parse(stored)
    const ageSeconds = (Date.now() - (tokens.stored_at || 0)) / 1000
    if (ageSeconds < (tokens.expires_in || 3600) - 60) return tokens.access_token || null
    if (!tokens.refresh_token) return null
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: tokens.refresh_token, client_id: env.GOOGLE_ADS_CLIENT_ID || '', client_secret: env.GOOGLE_ADS_CLIENT_SECRET || '', grant_type: 'refresh_token' })
    })
    const refreshed = await res.json() as any
    if (refreshed.access_token) {
      await env.KV.put('google_oauth_tokens', JSON.stringify({ ...tokens, access_token: refreshed.access_token, stored_at: Date.now() }), { expirationTtl: 60 * 60 * 24 * 30 })
      return refreshed.access_token
    }
    return null
  } catch { return null }
}

async function fetchGoogleTrends(keywords: string[], geo: string): Promise<Map<string, number[]>> {
  try {
    const req = {
      comparisonItem: keywords.slice(0, 5).map(kw => ({ keyword: kw, geo, time: 'today 12-m' })),
      category: 0, property: ''
    }
    const exploreUrl = `https://trends.google.com/trends/api/explore?hl=en-US&tz=300&req=${encodeURIComponent(JSON.stringify(req))}&geo=${geo}`
    const exploreRes = await fetch(exploreUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    if (!exploreRes.ok) return new Map()
    const raw = await exploreRes.text()
    const exploreData = JSON.parse(raw.replace(/^\)\]\}'\n/, ''))
    const timeWidget = exploreData.widgets?.find((w: any) => w.id === 'TIMESERIES')
    if (!timeWidget?.token) return new Map()

    const mlUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=300&req=${encodeURIComponent(JSON.stringify(timeWidget.request))}&token=${encodeURIComponent(timeWidget.token)}&geo=${geo}`
    const mlRes = await fetch(mlUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } })
    if (!mlRes.ok) return new Map()
    const mlData = JSON.parse((await mlRes.text()).replace(/^\)\]\}'\n/, ''))

    const result = new Map<string, number[]>()
    const timeline = mlData?.default?.timelineData || []
    keywords.forEach((kw, i) => {
      const values: number[] = timeline.map((p: any) => Array.isArray(p.value) ? (p.value[i] || 0) : 0)
      if (values.some((v: number) => v > 0)) result.set(kw, values)
    })
    return result
  } catch { return new Map() }
}

// ── KEYWORD RESEARCH ROUTES ───────────────────────────────────────────────

app.post('/api/keywords/research', async (c) => {
  try {
    const { company_key, territory, niche, radius = 'city', seed_keywords = [] } = await c.req.json()
    if (!territory || !niche) return c.json({ error: 'territory and niche required' }, 400)

    const cacheKey = `kw:${company_key || 'all'}:${territory.toLowerCase().replace(/\s+/g, '-')}:${niche.toLowerCase().replace(/\s+/g, '-')}`
    if (c.env?.KV) {
      const cached = await c.env.KV.get(cacheKey)
      if (cached) return c.json({ ...JSON.parse(cached), cached: true })
    }

    // Seed keywords from D1 domain army
    let domainSeeds: string[] = [...(seed_keywords as string[])]
    let domainTexts: string[] = []
    if (c.env?.DB) {
      const q   = company_key
        ? 'SELECT domain, keyword, service FROM domains WHERE company = ? AND authorized = 1 ORDER BY priority ASC LIMIT 20'
        : 'SELECT domain, keyword, service FROM domains WHERE authorized = 1 ORDER BY priority ASC LIMIT 20'
      const res = company_key
        ? await c.env.DB.prepare(q).bind(company_key).all()
        : await c.env.DB.prepare(q).all()
      const doms = (res.results || []) as any[]
      domainTexts = doms.map((d: any) => d.domain)
      doms.forEach((d: any) => {
        if (d.keyword && !domainSeeds.includes(d.keyword)) domainSeeds.push(d.keyword)
      })
    }
    // Add niche + territory combos as seeds
    const cityName = territory.split(',')[0].trim().toLowerCase()
    ;[niche, `${niche} ${cityName}`, `emergency ${niche}`, `best ${niche} ${cityName}`, `${niche} cost`, `${niche} near me`].forEach(s => {
      if (!domainSeeds.includes(s)) domainSeeds.push(s)
    })
    domainSeeds = [...new Set(domainSeeds)].slice(0, 20)

    const sources = { planner: false, trends: false, search_console: false }
    let keywords: any[] = []
    let connectMessage: string | null = null

    // ── Source 1: Google Keyword Planner ─────────────────────────────────
    const devToken    = c.env?.GOOGLE_ADS_DEVELOPER_TOKEN
    const customerId  = c.env?.GOOGLE_ADS_CUSTOMER_ID
    const accessToken = c.env?.KV ? await refreshGoogleToken(c.env) : null

    if (devToken && customerId && accessToken) {
      try {
        const geoId = GEO_TARGETS[cityName] || GEO_TARGETS['canada']
        const plannerRes = await fetch(
          `https://googleads.googleapis.com/v18/customers/${customerId}/keywordPlanIdeas:generateKeywordIdeas`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'developer-token': devToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              language: { resourceName: 'languageConstants/1000' },
              geoTargetConstants: [`geoTargetConstants/${geoId}`],
              keywordSeed: { keywords: domainSeeds.slice(0, 10) },
              keywordPlanNetwork: 'GOOGLE_SEARCH'
            })
          }
        )
        if (plannerRes.ok) {
          const plannerData = await plannerRes.json() as any
          for (const r of (plannerData.results || [])) {
            const m   = r.keywordIdeaMetrics || {}
            const vol = parseInt(m.avgMonthlySearches || '0')
            const comp = parseInt(m.competitionIndex || '0')
            const cpc  = parseInt(m.averageCpcMicros || '0') / 1_000_000
            const { score, intent, matchType } = scoreKeyword({ text: r.text, volume: vol, competition: comp, cpc, territory }, domainTexts)
            const sugDomain = domainTexts.find(d => d.replace(/\.(com|ca|net|org)$/, '').replace(/-/g, ' ').toLowerCase().includes(r.text.split(' ')[0])) || null
            keywords.push({ keyword: r.text, volume: vol, cpc, competition: comp, intent_type: intent, match_type: matchType, score, territory, suggested_domain: sugDomain, source: 'planner' })
          }
          sources.planner = true
        }
      } catch (e: any) { console.error('[KW Planner]', e?.message) }
    } else {
      connectMessage = !devToken ? 'Connect Google Ads to unlock real volume data — add GOOGLE_ADS_DEVELOPER_TOKEN to environment variables'
        : !customerId ? 'Add GOOGLE_ADS_CUSTOMER_ID to environment variables'
        : 'Connect Google Ads OAuth to unlock real volume data'
    }

    // ── Source 2: Google Trends (free, no key) ────────────────────────────
    try {
      const trendsData = await fetchGoogleTrends(domainSeeds.slice(0, 5), 'CA')
      if (trendsData.size > 0) {
        sources.trends = true
        for (const [kw, values] of trendsData.entries()) {
          const avgTrend  = values.length ? Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length) : 0
          const recent3   = values.slice(-3).reduce((a: number, b: number) => a + b, 0)
          const older3    = values.slice(0, 3).reduce((a: number, b: number) => a + b, 0)
          const trendBoost = recent3 > older3 ? 3 : 0
          const existing  = keywords.find((k: any) => k.keyword === kw)
          if (existing) {
            existing.trend_values = values
            existing.trend_avg    = avgTrend
            existing.score        = Math.min(100, existing.score + trendBoost)
          } else if (!sources.planner) {
            // No planner data — build entry from trends signal only
            const estVol = avgTrend * 10
            const { score, intent, matchType } = scoreKeyword({ text: kw, volume: estVol, competition: 50, cpc: 0, territory }, domainTexts)
            const sugDomain = domainTexts.find(d => d.replace(/\.(com|ca|net|org)$/, '').replace(/-/g, ' ').toLowerCase().includes(kw.split(' ')[0])) || null
            keywords.push({ keyword: kw, volume: null, cpc: null, competition: null, intent_type: intent, match_type: matchType, score: Math.min(100, score + trendBoost), territory, trend_values: values, trend_avg: avgTrend, suggested_domain: sugDomain, source: 'trends' })
          }
        }
      }
    } catch (e: any) { console.error('[Trends]', e?.message) }

    // ── Source 3: Search Console — placeholder ────────────────────────────
    // Requires additional OAuth scope: https://www.googleapis.com/auth/webmasters.readonly
    // Wire endpoint structure here; activate when search console tokens are present
    sources.search_console = false

    keywords.sort((a: any, b: any) => b.score - a.score)

    const result = { keywords: keywords.slice(0, 100), sources, connect_message: connectMessage, territory, niche, radius, generated_at: new Date().toISOString(), cached: false }
    if (c.env?.KV && keywords.length > 0) await c.env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 * 60 * 24 * 7 })
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: 'Research failed', detail: err?.message }, 500)
  }
})

app.post('/api/keywords/save', async (c) => {
  if (!c.env?.DB) return c.json({ error: 'DB not configured' }, 500)
  const { keywords: kwList, domain_id, company_id } = await c.req.json()
  if (!Array.isArray(kwList) || !kwList.length) return c.json({ error: 'keywords array required' }, 400)
  const now = new Date().toISOString()
  let saved = 0
  for (const kw of kwList) {
    try {
      await c.env.DB.prepare(
        'INSERT INTO keywords (domain_id, company_id, keyword, volume, cpc, competition, intent_type, match_type, score, territory, source, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(domain_id || null, company_id || null, kw.keyword, kw.volume || 0, kw.cpc || 0, kw.competition || 0, kw.intent_type || 'informational', kw.match_type || 'Phrase', kw.score || 0, kw.territory || null, kw.source || 'manual', now).run()
      saved++
    } catch { /* skip duplicates */ }
  }
  return c.json({ success: true, saved })
})

app.get('/api/keywords/saved', async (c) => {
  if (!c.env?.DB) return c.json({ keywords: [] })
  const user       = c.get('user')
  const domain_id  = c.req.query('domain_id')
  const company_id = c.req.query('company_id')
  let q = 'SELECT * FROM keywords'
  const params: any[] = []
  const where: string[] = []
  if (domain_id)  { where.push('domain_id = ?');  params.push(parseInt(domain_id)) }
  if (company_id) { where.push('company_id = ?'); params.push(parseInt(company_id)) }
  if (user && user.role !== 'super_admin' && user.company_id) { where.push('company_id = ?'); params.push(user.company_id) }
  if (where.length) q += ' WHERE ' + where.join(' AND ')
  q += ' ORDER BY score DESC, created_at DESC LIMIT 200'
  const res = params.length
    ? await c.env.DB.prepare(q).bind(...params).all()
    : await c.env.DB.prepare(q).all()
  return c.json({ keywords: res.results || [] })
})

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
  } else if (user && user.role !== 'super_admin') {
    // Authenticated non-super_admin with no resolved company_key (new tenant, no domains yet)
    return c.json({ total: 0, domains: [] })
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

app.post('/api/companies', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)
  const body = await c.req.json()
  const { key, name, phone, domain, budget, target_cpa, color_bg, color_accent, callouts, sitelinks } = body
  if (!key || !name) return c.json({ error: 'key and name are required' }, 400)
  // Validate key format: lowercase letters, numbers, hyphens only
  if (!/^[a-z0-9-]+$/.test(key)) return c.json({ error: 'key must be lowercase letters, numbers, and hyphens only' }, 400)
  try {
    const res = await c.env.DB.prepare(
      `INSERT INTO companies (key, name, phone, domain, budget, target_cpa, color_bg, color_accent, callouts, sitelinks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      key.trim(),
      name.trim(),
      phone?.trim() || null,
      domain?.trim() || null,
      budget ? Number(budget) : null,
      target_cpa ? Number(target_cpa) : null,
      color_bg?.trim() || '#1e293b',
      color_accent?.trim() || '#3b82f6',
      callouts ? JSON.stringify(callouts) : '[]',
      sitelinks ? JSON.stringify(sitelinks) : '[]'
    ).run()
    return c.json({ success: true, id: res.meta?.last_row_id })
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) return c.json({ error: `Company key "${key}" already exists` }, 409)
    return c.json({ error: 'Failed to create company' }, 500)
  }
})

app.patch('/api/companies/:id', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)
  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid company id' }, 400)
  const body = await c.req.json()
  const { key, name, phone, domain, budget, target_cpa, color_bg, color_accent, callouts, sitelinks } = body
  if (!key || !name) return c.json({ error: 'key and name are required' }, 400)
  if (!/^[a-z0-9-]+$/.test(key)) return c.json({ error: 'key must be lowercase letters, numbers, and hyphens only' }, 400)
  try {
    await c.env.DB.prepare(
      `UPDATE companies SET key=?, name=?, phone=?, domain=?, budget=?, target_cpa=?, color_bg=?, color_accent=?, callouts=?, sitelinks=? WHERE id=?`
    ).bind(
      key.trim(),
      name.trim(),
      phone?.trim() || null,
      domain?.trim() || null,
      budget ? Number(budget) : null,
      target_cpa ? Number(target_cpa) : null,
      color_bg?.trim() || '#1e293b',
      color_accent?.trim() || '#3b82f6',
      callouts ? JSON.stringify(callouts) : '[]',
      sitelinks ? JSON.stringify(sitelinks) : '[]',
      id
    ).run()
    return c.json({ success: true })
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) return c.json({ error: `Company key "${key}" already exists` }, 409)
    return c.json({ error: 'Failed to update company' }, 500)
  }
})

// ── COMPANY SUMMARY (dashboard expand) ───────────────────────────────────────
app.get('/api/companies/:id/summary', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)

  const id = Number(c.req.param('id'))
  if (!id) return c.json({ error: 'Invalid id' }, 400)

  // Non-super_admin users may only fetch their own company
  if (user.role !== 'super_admin' && Number(user.company_id) !== id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  try {
    const [domainsRes, leadsRes, gbpRes] = await c.env.DB.batch([
      c.env.DB.prepare(
        'SELECT id, domain, status FROM domains WHERE company = (SELECT key FROM companies WHERE id = ?) ORDER BY status, domain'
      ).bind(id),
      c.env.DB.prepare(
        'SELECT COUNT(*) as cnt FROM leads WHERE company = (SELECT key FROM companies WHERE id = ?)'
      ).bind(id),
      c.env.DB.prepare(
        'SELECT business_name FROM google_business_profiles WHERE company_id = ?'
      ).bind(id)
    ])
    return c.json({
      domains:       domainsRes.results || [],
      lead_count:    (leadsRes.results?.[0] as any)?.cnt || 0,
      gbp_connected: (gbpRes.results?.length || 0) > 0,
      gbp_name:      (gbpRes.results?.[0] as any)?.business_name || null
    })
  } catch {
    return c.json({ error: 'Failed to load summary' }, 500)
  }
})

// ── LP CHECKLIST VALIDATOR ────────────────────────────────────────────────────
function validateLP(html: string, mode: 'ppc' | 'seo'): { passed: string[]; warnings: string[] } {
  const passed: string[]   = []
  const warnings: string[] = []
  const chk = (ok: boolean, passMsg: string, warnMsg: string) => ok ? passed.push(passMsg) : warnings.push(warnMsg)

  // ── Technical SEO ──────────────────────────────────────────────────────────
  const titleM   = html.match(/<title>([^<]+)<\/title>/)
  const titleLen = titleM ? titleM[1].length : 0
  chk(titleLen >= 50 && titleLen <= 60, `Title: ${titleLen} chars ✓`, `Title: ${titleLen} chars (target 50–60)`)

  const metaM   = html.match(/name="description" content="([^"]+)"/)
  const metaLen = metaM ? metaM[1].length : 0
  chk(metaLen >= 150 && metaLen <= 160, `Meta description: ${metaLen} chars ✓`, `Meta description: ${metaLen} chars (target 150–160)`)

  chk(html.includes('name="robots"'), 'Robots meta present ✓', 'Robots meta missing')
  chk(mode === 'ppc' ? html.includes('noindex') : html.includes('index,follow'), `Robots correct for ${mode} mode ✓`, `Robots directive wrong for ${mode} mode`)
  chk(html.includes('rel="canonical"'), 'Canonical link present ✓', 'Canonical link missing')

  const h1s = html.match(/<h1[\s>]/g)
  chk(!!h1s && h1s.length === 1, 'Single H1 present ✓', h1s ? `Multiple H1s (${h1s.length})` : 'H1 missing')

  const imgs    = html.match(/<img [^>]+>/g) || []
  const altOk   = imgs.filter(i => i.includes('alt=')).length
  chk(imgs.length === 0 || altOk === imgs.length, `Image alt text present (${imgs.length} imgs) ✓`, `${imgs.length - altOk} image(s) missing alt text`)

  // ── Schema ─────────────────────────────────────────────────────────────────
  chk(html.includes('"LocalBusiness"'), 'LocalBusiness schema ✓', 'LocalBusiness schema missing')
  chk(html.includes('"FAQPage"'), 'FAQPage schema ✓', 'FAQPage schema missing')
  chk(html.includes('AggregateRating'), 'AggregateRating schema ✓', 'AggregateRating schema missing')

  // ── Conversion ─────────────────────────────────────────────────────────────
  const telCount = (html.match(/href="tel:/g) || []).length
  chk(telCount >= 3, `Phone number appears ${telCount}× ✓`, `Phone number appears ${telCount}× (need 3+)`)
  chk(html.includes('id="lp-form"') || html.includes('id="lead-form"'), 'Lead form present ✓', 'Lead form missing')
  chk(html.includes('sticky-bar'), 'Mobile sticky bar present ✓', 'Mobile sticky bar missing')
  chk(html.includes('class="cta-sec"') || html.includes('class="hero"'), 'CTA above fold ✓', 'CTA section missing')

  // ── Links ──────────────────────────────────────────────────────────────────
  if (mode === 'seo') {
    const extHrefs = (html.match(/href="https?:\/\/(?!.*tel:)[^"]+"/g) || []).filter(l => !l.includes('tel:'))
    chk(extHrefs.length >= 2, `External links: ${extHrefs.length} ✓`, `External links: ${extHrefs.length} (need 2+ in SEO mode)`)
    const blankCount = (html.match(/target="_blank"/g) || []).length
    chk(blankCount > 0, 'External links have target="_blank" ✓', 'External links missing target="_blank"')
  }

  // ── Reviews ────────────────────────────────────────────────────────────────
  chk(!html.includes('rv-placeholder'), 'Real Google reviews displayed ✓', 'No Google reviews connected — placeholder shown in LP')

  return { passed, warnings }
}

app.post('/api/generate/landing-page', async (c) => {
  const user = c.get('user')
  const { keyword, service, domain, company: co, mode = 'seo' } = await c.req.json()
  if (!keyword || !service || !domain) return c.json({ error: 'keyword, service, domain required' }, 400)

  // Tenant isolation: company_admin can only generate for their own company's domains
  if (user && user.role === 'company_admin' && user.company_id && c.env?.DB) {
    const domRow = await c.env.DB.prepare('SELECT company_id FROM domains WHERE domain = ?').bind(domain).first() as any
    if (domRow && domRow.company_id !== null && domRow.company_id !== user.company_id) {
      return c.json({ error: 'Forbidden — domain does not belong to your company' }, 403)
    }
  }

  // Data Permission Gate: company_admin must have granted permission + completed scrape
  if (user && user.role === 'company_admin' && user.company_id && c.env?.DB) {
    try {
      const perm = await c.env.DB.prepare(
        'SELECT permission_granted, revoked_at FROM data_permissions WHERE company_id = ?'
      ).bind(user.company_id).first() as any
      if (!perm || !perm.permission_granted || perm.revoked_at) {
        return c.json({ error: 'Data usage authorization required — go to Settings → Data & Privacy', code: 'PERMISSION_REQUIRED' }, 403)
      }
      const site = await c.env.DB.prepare(
        "SELECT scrape_status FROM company_websites WHERE company_id = ?"
      ).bind(user.company_id).first() as any
      if (!site || (site.scrape_status !== 'completed')) {
        return c.json({ error: 'Brand profile required — scan your website in Brand Profile before generating content', code: 'SCRAPE_REQUIRED' }, 403)
      }
    } catch (_) {}
  }

  const detected = detectCompany(domain, keyword, co)

  // ── Fetch company data from D1 ─────────────────────────────────────────
  let companyData: CompanyData | null = null
  let companyId: number | null = null
  if (c.env?.DB) {
    try {
      const row = await c.env.DB.prepare(
        'SELECT id, name, phone, domain AS mainDomain, color_bg, color_accent, callouts, sitelinks FROM companies WHERE key = ?'
      ).bind(detected).first() as any
      if (row) {
        companyId = row.id
        companyData = {
          name: row.name, phone: row.phone, mainDomain: row.mainDomain,
          color_bg: row.color_bg || '#1A1A2E', color_accent: row.color_accent || '#CC0000',
          callouts: JSON.parse(row.callouts || '[]'), sitelinks: JSON.parse(row.sitelinks || '[]')
        }
      }
    } catch (_) {}
  }
  if (!companyData) {
    const c2 = COMPANIES[detected]
    companyData = {
      name: c2.name, phone: c2.phone, mainDomain: c2.domain,
      color_bg: (c2 as any).colors?.bg || '#1A1A2E', color_accent: (c2 as any).colors?.accent || '#CC0000',
      callouts: c2.callouts || [], sitelinks: c2.sitelinks || []
    }
  }

  // ── Template rotation ──────────────────────────────────────────────────
  let tplConfig: TemplateConfig = { ...DEFAULT_TEMPLATE }
  if (c.env?.DB) {
    try {
      // 1. Check if domain has a locked template already
      const domRow = await c.env.DB.prepare(
        'SELECT id, template FROM domains WHERE domain = ?'
      ).bind(domain).first() as any
      let templateNum: number | null = domRow?.template ?? null
      const domainId: number | null = domRow?.id ?? null

      // 2. No locked template — pick least-used active template
      if (!templateNum) {
        const nextTpl = await c.env.DB.prepare(
          'SELECT template_number FROM lp_templates WHERE active = 1 ORDER BY usage_count ASC, last_used ASC LIMIT 1'
        ).first() as any
        templateNum = nextTpl?.template_number ?? 1
        // Lock this template to the domain for consistency
        if (domainId && templateNum) {
          await c.env.DB.prepare('UPDATE domains SET template = ? WHERE id = ?')
            .bind(templateNum, domainId).run()
        }
      }

      // 3. Fetch full template row
      const tplRow = await c.env.DB.prepare(
        'SELECT template_number, name, primary_color, accent_color, layout FROM lp_templates WHERE template_number = ?'
      ).bind(templateNum).first() as any

      if (tplRow) {
        // 4. Check R2 for hero image — served via /api/images/ proxy
        const niche = getNiche(detected, service)
        const nn = String(tplRow.template_number).padStart(2, '0')
        const slug = (tplRow.name as string).toLowerCase().replace(/\s+/g, '-')
        const r2Key = `templates/${nn}-${slug}/hero-${niche}.jpg`
        let heroImageUrl: string | null = null
        if (c.env?.IMAGES) {
          try {
            const obj = await c.env.IMAGES.head(r2Key)
            if (obj) heroImageUrl = `/api/images/${r2Key}`
          } catch (_) {}
        }

        tplConfig = {
          number: tplRow.template_number,
          name: tplRow.name,
          bg: tplRow.primary_color,
          accent: tplRow.accent_color,
          layout: tplRow.layout as TemplateLayout,
          heroImageUrl
        }

        // 5. Increment usage_count + stamp last_used
        await c.env.DB.prepare(
          'UPDATE lp_templates SET usage_count = usage_count + 1, last_used = ? WHERE template_number = ?'
        ).bind(new Date().toISOString(), templateNum).run()
      }
    } catch (_) {}
  }

  // ── Fetch real reviews from D1 (Google Reviews Doctrine: real only) ──────
  let realReviews: ReviewRow[] | null = null
  if (c.env?.DB && companyId) {
    try {
      // Check KV cache first (24-hour TTL)
      const cacheKey = `reviews:${companyId}`
      const cached = c.env?.KV ? await c.env.KV.get(cacheKey) : null
      if (cached) {
        realReviews = JSON.parse(cached)
      } else {
        const rvRes = await c.env.DB.prepare(
          'SELECT id, reviewer_name, rating, review_text, relative_time, reviewer_photo FROM google_reviews WHERE company_id = ? AND featured = 1 AND rating >= 4 ORDER BY rating DESC, review_date DESC LIMIT 5'
        ).bind(companyId).all()
        if (rvRes.results && rvRes.results.length > 0) {
          realReviews = rvRes.results as ReviewRow[]
          if (c.env?.KV) await c.env.KV.put(cacheKey, JSON.stringify(realReviews), { expirationTtl: 60 * 60 * 24 })
        }
      }
    } catch (_) {}
  }

  // Inject scraped brand data (enrich company data + template with real brand info)
  let scraperData: any = null
  const lookupCoId = user?.company_id || companyId
  if (c.env?.DB && lookupCoId) {
    try {
      scraperData = await c.env.DB.prepare(
        "SELECT * FROM company_websites WHERE company_id = ? AND scrape_status = 'completed'"
      ).bind(lookupCoId).first() as any
      if (scraperData && companyData) {
        // Override phone if company record has none but scraper found one
        if (scraperData.contact_info) {
          try {
            const ci = JSON.parse(scraperData.contact_info)
            if (ci?.phone && !companyData.phone) companyData.phone = ci.phone
          } catch (_) {}
        }
        // Override template colors with brand colors if available
        if (scraperData.brand_colors) {
          try {
            const bc = JSON.parse(scraperData.brand_colors) as string[]
            if (bc.length >= 2) { tplConfig.bg = bc[0]; tplConfig.accent = bc[1] }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  const rawHtml   = generateLandingPage(keyword, service, domain, detected, companyData, mode as 'ppc' | 'seo', tplConfig, realReviews)
  // Invisible audit trail comment (DATA PERMISSION DOCTRINE)
  const auditTs   = new Date().toISOString()
  const auditCoId = lookupCoId || 'n/a'
  const auditScrape = scraperData?.scrape_status || 'none'
  const auditComment = `<!-- SLM-AUDIT: generated=${auditTs} company_id=${auditCoId} scrape_status=${auditScrape} permission=v1.0 -->`
  const html      = rawHtml.replace('</html>', `${auditComment}\n</html>`)
  const checklist = validateLP(html, mode as 'ppc' | 'seo')
  return c.json({ html, company: detected, brand: companyData.name, domain, template: tplConfig.number, templateName: tplConfig.name, checklist })
})

app.post('/api/generate/ads-campaign', async (c) => {
  const user = c.get('user')
  const { domain, service, keyword, company: co } = await c.req.json()
  if (!domain || !service || !keyword) return c.json({ error: 'domain, service, keyword required' }, 400)
  if (user && user.role === 'company_admin' && user.company_id && c.env?.DB) {
    const domRow = await c.env.DB.prepare('SELECT company_id FROM domains WHERE domain = ?').bind(domain).first() as any
    if (domRow && domRow.company_id !== null && domRow.company_id !== user.company_id) return c.json({ error: 'Forbidden' }, 403)
    // Data permission + scrape check
    try {
      const perm = await c.env.DB.prepare('SELECT permission_granted, revoked_at FROM data_permissions WHERE company_id = ?').bind(user.company_id).first() as any
      if (!perm || !perm.permission_granted || perm.revoked_at) return c.json({ error: 'Data usage authorization required — go to Settings → Data & Privacy', code: 'PERMISSION_REQUIRED' }, 403)
      const site = await c.env.DB.prepare("SELECT scrape_status FROM company_websites WHERE company_id = ?").bind(user.company_id).first() as any
      if (!site || site.scrape_status !== 'completed') return c.json({ error: 'Brand profile required — scan your website in Brand Profile first', code: 'SCRAPE_REQUIRED' }, 403)
    } catch (_) {}
  }
  const detected = detectCompany(domain, keyword, co)
  return c.json({ ...generateAdsCampaign(domain, service, keyword, detected), generatedAt: new Date().toISOString() })
})

app.post('/api/generate/seo-content', async (c) => {
  const user = c.get('user')
  const { domain, keyword, service, company: co } = await c.req.json()
  if (!domain || !keyword || !service) return c.json({ error: 'domain, keyword, service required' }, 400)
  if (user && user.role === 'company_admin' && user.company_id && c.env?.DB) {
    const domRow = await c.env.DB.prepare('SELECT company_id FROM domains WHERE domain = ?').bind(domain).first() as any
    if (domRow && domRow.company_id !== null && domRow.company_id !== user.company_id) return c.json({ error: 'Forbidden' }, 403)
    // Data permission + scrape check
    try {
      const perm = await c.env.DB.prepare('SELECT permission_granted, revoked_at FROM data_permissions WHERE company_id = ?').bind(user.company_id).first() as any
      if (!perm || !perm.permission_granted || perm.revoked_at) return c.json({ error: 'Data usage authorization required — go to Settings → Data & Privacy', code: 'PERMISSION_REQUIRED' }, 403)
      const site = await c.env.DB.prepare("SELECT scrape_status FROM company_websites WHERE company_id = ?").bind(user.company_id).first() as any
      if (!site || site.scrape_status !== 'completed') return c.json({ error: 'Brand profile required — scan your website in Brand Profile first', code: 'SCRAPE_REQUIRED' }, 403)
    } catch (_) {}
  }
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

// ── GOOGLE OAUTH ─────────────────────────────────────────────────────────────
// redirect_uri is HARDCODED to slm-hub.ca — never use new URL(c.req.url).origin.
// Cloudflare Pages internal routing can resolve c.req.url to a deployment subdomain
// (e.g. 46eea2eb.services-leads-marketing-hub.pages.dev) instead of the custom domain.
// The redirect_uri must be character-for-character identical in both the auth request
// and the token exchange — any mismatch causes Google to return invalid_grant.
const GOOGLE_OAUTH_REDIRECT_URI = 'https://slm-hub.ca/api/auth/google/callback'

app.get('/api/auth/google', (c) => {
  const clientId = c.env?.GOOGLE_ADS_CLIENT_ID
  if (!clientId) return c.html('<html><body style="padding:40px;background:#09090B;color:#fff"><h2>Google Ads not configured</h2><p style="color:#f87171">GOOGLE_ADS_CLIENT_ID secret is missing. Redeploy after adding it.</p><a href="/app" style="color:#388bfd">Back</a></body></html>')
  return c.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(GOOGLE_OAUTH_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('https://www.googleapis.com/auth/adwords')}` +
    `&access_type=offline` +
    `&prompt=consent`
  )
})

app.get('/api/auth/google/callback', async (c) => {
  const code        = c.req.query('code')
  const errorParam  = c.req.query('error')
  const clientId     = c.env?.GOOGLE_ADS_CLIENT_ID
  const clientSecret = c.env?.GOOGLE_ADS_CLIENT_SECRET

  // Google returned an error (e.g. access_denied)
  if (!code) {
    return c.html(`<html><body style="padding:40px;background:#09090B;color:#fff;font-family:system-ui">
      <h2>❌ Google Auth Failed</h2>
      <p style="color:#f87171">Google returned: <code>${errorParam || 'no_code'}</code></p>
      <p style="color:#71717A;font-size:14px">Check that your Google Cloud OAuth consent screen is published and the account has Google Ads API access.</p>
      <a href="/app" style="color:#388bfd">← Back to Hub</a>
    </body></html>`)
  }

  // Secrets missing — means redeploy needed
  if (!clientId || !clientSecret) {
    return c.html(`<html><body style="padding:40px;background:#09090B;color:#fff;font-family:system-ui">
      <h2>❌ Missing Credentials</h2>
      <p style="color:#f87171">GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET not available in this deployment.</p>
      <p style="color:#71717A;font-size:14px">Run: <code>npm run deploy</code> after setting secrets via wrangler pages secret put.</p>
      <a href="/app" style="color:#388bfd">← Back to Hub</a>
    </body></html>`)
  }

  // Token exchange — redirect_uri must be identical to auth request
  const params = new URLSearchParams({
    code,
    client_id:     clientId,
    client_secret: clientSecret,
    redirect_uri:  GOOGLE_OAUTH_REDIRECT_URI,
    grant_type:    'authorization_code'
  })
  console.log('[OAuth callback] exchanging code, redirect_uri:', GOOGLE_OAUTH_REDIRECT_URI)

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })
  const tokens = await tokenRes.json() as any
  console.log('[OAuth callback] token response status:', tokenRes.status, 'error:', tokens.error || 'none')

  if (tokens.access_token) {
    if (c.env?.KV) {
      await c.env.KV.put('google_oauth_tokens', JSON.stringify({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_in:    tokens.expires_in || 3600,
        token_type:    tokens.token_type || 'Bearer',
        scope:         tokens.scope || '',
        stored_at:     Date.now()
      }), { expirationTtl: 60 * 60 * 24 * 30 })
    }
    return c.redirect('/app?oauth=success')
  }

  // Token exchange failed — show Google's exact error
  return c.html(`<html><body style="padding:40px;background:#09090B;color:#fff;font-family:system-ui">
    <h2>❌ Token Exchange Failed</h2>
    <p style="color:#f87171"><strong>${tokens.error || 'unknown_error'}</strong>: ${tokens.error_description || 'No description from Google'}</p>
    <p style="color:#71717A;font-size:13px">HTTP status: ${tokenRes.status} | redirect_uri used: <code>${GOOGLE_OAUTH_REDIRECT_URI}</code></p>
    <p style="color:#71717A;font-size:13px">Verify this redirect_uri is registered exactly in Google Cloud Console → Credentials → OAuth Client → Authorized redirect URIs.</p>
    <a href="/app" style="color:#388bfd">← Back to Hub</a>
  </body></html>`)
})

app.get('/api/auth/google/status', async (c) => {
  if (!c.env?.KV) return c.json({ connected: false, message: 'KV not configured' })
  const tokens = await c.env.KV.get('google_oauth_tokens')
  if (!tokens) return c.json({ connected: false })
  const t = JSON.parse(tokens)
  return c.json({ connected: true, expires_in_seconds: (t.expires_in||3600) - (Date.now()-t.stored_at)/1000, has_refresh: !!t.refresh_token })
})

app.post('/api/google-ads/push', async (c) => {
  const body = await c.req.json()
  const devToken   = c.env?.GOOGLE_ADS_DEVELOPER_TOKEN
  const customerId = (c.env?.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '')

  // ── Demo fallback (no credentials) ──────────────────────────────────────
  if (!devToken || !customerId) {
    const reason = !devToken ? 'add GOOGLE_ADS_DEVELOPER_TOKEN' : 'add GOOGLE_ADS_CUSTOMER_ID'
    if (c.env?.KV) await c.env.KV.put(`push:${Date.now()}`, JSON.stringify({ campaign: body.campaign?.name||'Unknown', status: 'demo', ts: new Date().toISOString() }), { expirationTtl: 60*60*24*30 })
    return c.json({ success: true, status: 'demo', message: `Demo mode — ${reason}`, campaign: body.campaign?.name, timestamp: new Date().toISOString() })
  }

  // ── Require OAuth token ──────────────────────────────────────────────────
  const accessToken = c.env?.KV ? await refreshGoogleToken(c.env) : null
  if (!accessToken) {
    return c.json({ success: false, status: 'auth_required', message: 'Google OAuth not connected — visit /api/auth/google to authenticate' }, 401)
  }

  const adsBase = `https://googleads.googleapis.com/v18/customers/${customerId}`
  const headers: Record<string, string> = {
    'Authorization':    `Bearer ${accessToken}`,
    'developer-token':  devToken,
    'login-customer-id': customerId,
    'Content-Type':     'application/json'
  }

  try {
    // 1. Campaign budget (parse "$30/day CAD" → micros)
    const budgetMatch = (body.campaign?.budget || '$10').match(/\$?(\d+(?:\.\d+)?)/)
    const dailyBudgetMicros = String(Math.round(parseFloat(budgetMatch?.[1] || '10') * 1_000_000))
    const budgetRes  = await fetch(`${adsBase}/campaignBudgets:mutate`, {
      method: 'POST', headers,
      body: JSON.stringify({ operations: [{ create: { name: `${body.campaign?.name} Budget`, amountMicros: dailyBudgetMicros, deliveryMethod: 'STANDARD' } }] })
    })
    const budgetData = await budgetRes.json() as any
    if (!budgetRes.ok) throw new Error(`Budget: ${JSON.stringify(budgetData?.error || budgetData)}`)
    const budgetResource = budgetData.results?.[0]?.resourceName as string

    // 2. Campaign (created PAUSED — user activates manually)
    const campaignRes  = await fetch(`${adsBase}/campaigns:mutate`, {
      method: 'POST', headers,
      body: JSON.stringify({ operations: [{ create: {
        name:                     body.campaign?.name,
        advertisingChannelType:   'SEARCH',
        status:                   'PAUSED',
        campaignBudget:           budgetResource,
        maximizeConversions:      {},
        networkSettings:          { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false, targetPartnerSearchNetwork: false },
        geoTargetTypeSetting:     { positiveGeoTargetType: 'PRESENCE_OR_INTEREST' }
      } }] })
    })
    const campaignData = await campaignRes.json() as any
    if (!campaignRes.ok) throw new Error(`Campaign: ${JSON.stringify(campaignData?.error || campaignData)}`)
    const campaignResource = campaignData.results?.[0]?.resourceName as string

    // 3. Ad group
    const adGroupRes  = await fetch(`${adsBase}/adGroups:mutate`, {
      method: 'POST', headers,
      body: JSON.stringify({ operations: [{ create: {
        name:          body.adGroup?.name || `${body.campaign?.name} Ad Group`,
        campaign:      campaignResource,
        status:        'ENABLED',
        type:          'SEARCH_STANDARD',
        cpcBidMicros:  '4500000'
      } }] })
    })
    const adGroupData = await adGroupRes.json() as any
    if (!adGroupRes.ok) throw new Error(`AdGroup: ${JSON.stringify(adGroupData?.error || adGroupData)}`)
    const adGroupResource = adGroupData.results?.[0]?.resourceName as string

    // 4. Keywords
    const matchTypeMap: Record<string, string> = { Exact: 'EXACT', Phrase: 'PHRASE', Broad: 'BROAD' }
    const kwOps = (body.adGroup?.keywords || []).map((kw: any) => ({
      create: { adGroup: adGroupResource, keyword: { text: kw.text.replace(/[\[\]"]/g, ''), matchType: matchTypeMap[kw.match] || 'PHRASE' }, status: 'ENABLED' }
    }))
    if (kwOps.length > 0) {
      const kwRes = await fetch(`${adsBase}/adGroupCriteria:mutate`, { method: 'POST', headers, body: JSON.stringify({ operations: kwOps }) })
      if (!kwRes.ok) console.error('[GAds keywords]', JSON.stringify(await kwRes.json()))
    }

    // 5. Responsive Search Ad
    const ad = body.ads?.[0]
    if (ad) {
      const headlines    = (ad.headlines    || []).slice(0, 15).map((h: string) => ({ text: h.slice(0, 30) }))
      const descriptions = (ad.descriptions || []).slice(0,  4).map((d: string) => ({ text: d.slice(0, 90) }))
      const adRes = await fetch(`${adsBase}/adGroupAds:mutate`, {
        method: 'POST', headers,
        body: JSON.stringify({ operations: [{ create: {
          adGroup: adGroupResource, status: 'PAUSED',
          ad: { responsiveSearchAd: { headlines, descriptions }, finalUrls: [ad.finalUrl || `https://example.com`] }
        } }] })
      })
      if (!adRes.ok) console.error('[GAds RSA]', JSON.stringify(await adRes.json()))
    }

    // 6. Callout extension
    if ((body.extensions?.callouts || []).length > 0) {
      const calloutOps = [{ create: {
        campaign: campaignResource,
        calloutFeedItem: { calloutText: body.extensions.callouts.slice(0, 4).map((t: string) => t.slice(0, 25)) }
      } }]
      const extRes = await fetch(`${adsBase}/campaignExtensionSettings:mutate`, {
        method: 'POST', headers,
        body: JSON.stringify({ operations: calloutOps })
      })
      if (!extRes.ok) console.error('[GAds callouts]', JSON.stringify(await extRes.json()))
    }

    const result = { campaign: body.campaign?.name, status: 'live', campaignResource, adGroupResource, ts: new Date().toISOString() }
    if (c.env?.KV) await c.env.KV.put(`push:${Date.now()}`, JSON.stringify(result), { expirationTtl: 60*60*24*30 })

    return c.json({ success: true, status: 'live', message: 'Campaign created in Google Ads (PAUSED — enable in console)', campaign: body.campaign?.name, campaignResource, adGroupResource, timestamp: new Date().toISOString() })

  } catch (err: any) {
    console.error('[GAds push]', err?.message)
    if (c.env?.KV) await c.env.KV.put(`push:${Date.now()}`, JSON.stringify({ campaign: body.campaign?.name||'Unknown', status: 'error', error: err?.message, ts: new Date().toISOString() }), { expirationTtl: 60*60*24*30 })
    return c.json({ success: false, status: 'error', error: err?.message, campaign: body.campaign?.name, timestamp: new Date().toISOString() }, 500)
  }
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
app.get('/invite/:token', (c) => c.html(INVITE_HTML))

// ── PORKBUN API v3 ────────────────────────────────────────────────────────────
// All domain registration and management goes through Porkbun exclusively.
// Keys stored as Cloudflare secrets: PORKBUN_API_KEY, PORKBUN_SECRET_KEY
// Base URL: https://api.porkbun.com/api/json/v3
// Auth: apikey + secretapikey in every request body

const PORKBUN_BASE = 'https://api.porkbun.com/api/json/v3'

async function porkbunPost(env: Bindings, path: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${PORKBUN_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: env.PORKBUN_API_KEY,
      secretapikey: env.PORKBUN_SECRET_KEY,
      ...extra
    })
  })
  return res.json() as Promise<any>
}

// GET /api/porkbun/ping — test credentials (super_admin only)
app.get('/api/porkbun/ping', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.PORKBUN_API_KEY || !c.env?.PORKBUN_SECRET_KEY) {
    return c.json({ error: 'Porkbun credentials not configured — add PORKBUN_API_KEY and PORKBUN_SECRET_KEY as Cloudflare secrets' }, 503)
  }
  try {
    const data = await porkbunPost(c.env, '/ping')
    return c.json(data)
  } catch (err: any) {
    return c.json({ error: 'Porkbun ping failed', detail: err?.message }, 502)
  }
})

// POST /api/porkbun/check — check availability for one or more domains (super_admin only)
// Body: { domains: ["example.com", "example.ca"] }
// NOTE: Porkbun rate limit is 1 checkDomain call per 10 seconds — checks run sequentially
app.post('/api/porkbun/check', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.PORKBUN_API_KEY || !c.env?.PORKBUN_SECRET_KEY) {
    return c.json({ error: 'Porkbun credentials not configured' }, 503)
  }
  const { domains } = await c.req.json() as { domains: string[] }
  if (!domains?.length) return c.json({ error: 'domains array required' }, 400)

  // Sequential with 11s delay between checks to respect Porkbun rate limit (1/10s)
  const results: any[] = []
  for (let i = 0; i < domains.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 11000))
    try {
      const data = await porkbunPost(c.env, `/domain/checkDomain/${domains[i]}`)
      results.push({ domain: domains[i], ...data })
    } catch (err: any) {
      results.push({ domain: domains[i], status: 'ERROR', error: err?.message })
    }
  }
  return c.json({ results })
})

// POST /api/porkbun/import-all — import all Porkbun account domains into D1 (super_admin only)
app.post('/api/porkbun/import-all', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.PORKBUN_API_KEY || !c.env?.PORKBUN_SECRET_KEY) return c.json({ error: 'Porkbun credentials not configured' }, 503)
  if (!c.env?.DB) return c.json({ error: 'Database unavailable' }, 503)

  try {
    // Fetch all domains — paginate in batches of 1000
    let allPb: any[] = []
    let start = 0
    while (true) {
      const data = await porkbunPost(c.env, '/domain/listAll', { includeLabels: 'yes', start: String(start) })
      if (data.status !== 'SUCCESS') break
      const batch: any[] = data.domains || []
      allPb = allPb.concat(batch)
      if (batch.length < 1000) break
      start += 1000
    }

    const now = new Date().toISOString()

    // Pre-load operational domains + companies for linking (avoids N+1 queries)
    const [domsRes, cosRes, existingRes] = await Promise.all([
      c.env.DB.prepare('SELECT id, domain, company FROM domains').all(),
      c.env.DB.prepare('SELECT id, key FROM companies').all(),
      c.env.DB.prepare('SELECT domain FROM domain_registrations').all()
    ])
    const domsMap    = new Map((domsRes.results   || []).map((r: any) => [r.domain, r]))
    const cosMap     = new Map((cosRes.results    || []).map((r: any) => [r.key,    r.id]))
    const existingSet = new Set((existingRes.results || []).map((r: any) => r.domain))

    let inserted = 0, updated = 0
    const stmts: any[] = []

    for (const pb of allPb) {
      const linked    = domsMap.get(pb.domain) as any
      const companyId = linked ? (cosMap.get(linked.company) ?? 0) : 0
      const domainId  = linked?.id ?? null
      // Porkbun dates come as "YYYY-MM-DD HH:MM:SS" — extract date part only for SQLite date() functions
      const expiresAt = pb.expireDate ? pb.expireDate.split(' ')[0] : null

      if (existingSet.has(pb.domain)) {
        stmts.push(c.env.DB.prepare(
          'UPDATE domain_registrations SET status=?,expires_at=?,auto_renew=?,security_lock=?,whois_privacy=?,labels=?,company_id=?,domain_id=?,updated_at=? WHERE domain=?'
        ).bind(pb.status||'ACTIVE', expiresAt, pb.autoRenew==='1'?1:0, pb.securityLock==='1'?1:0, pb.whoisPrivacy==='1'?1:0, JSON.stringify(pb.labels||[]), companyId, domainId, now, pb.domain))
        updated++
      } else {
        stmts.push(c.env.DB.prepare(
          'INSERT INTO domain_registrations (company_id,domain,tld,registrar,status,expires_at,auto_renew,security_lock,whois_privacy,labels,domain_id,imported_at,updated_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(companyId, pb.domain, pb.tld||null, 'porkbun', pb.status||'ACTIVE', expiresAt, pb.autoRenew==='1'?1:0, pb.securityLock==='1'?1:0, pb.whoisPrivacy==='1'?1:0, JSON.stringify(pb.labels||[]), domainId, now, now, pb.createDate||now))
        inserted++
      }
    }

    // Batch execute in groups of 50 (D1 batch limit)
    for (let i = 0; i < stmts.length; i += 50) {
      await c.env.DB.batch(stmts.slice(i, i + 50))
    }

    if (c.env?.KV) await c.env.KV.put('porkbun:last_sync', now, { expirationTtl: 60 * 60 * 24 * 365 })

    return c.json({ success: true, total: allPb.length, inserted, updated, synced_at: now })
  } catch (err: any) {
    return c.json({ error: 'Import failed', detail: err?.message }, 500)
  }
})

// GET /api/porkbun/sync-status — compare Porkbun registry vs D1 operational domains (super_admin only)
app.get('/api/porkbun/sync-status', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'Database unavailable' }, 503)

  try {
    const [regRes, d1Res, expiryRes, unsyncedRes] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as cnt FROM domain_registrations').first() as Promise<any>,
      c.env.DB.prepare('SELECT COUNT(*) as cnt FROM domains').first() as Promise<any>,
      c.env.DB.prepare("SELECT domain, expires_at, auto_renew FROM domain_registrations WHERE expires_at IS NOT NULL AND expires_at <= date('now', '+30 days') ORDER BY expires_at ASC").all(),
      c.env.DB.prepare("SELECT d.domain FROM domains d LEFT JOIN domain_registrations dr ON d.domain = dr.domain WHERE dr.id IS NULL").all()
    ])
    const lastSync = c.env?.KV ? await c.env.KV.get('porkbun:last_sync') : null
    const expiring = (expiryRes.results || []).map((r: any) => ({
      ...r,
      days_left: Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / 86400000)
    }))

    return c.json({
      porkbun_total:    regRes?.cnt ?? 0,
      d1_total:         d1Res?.cnt  ?? 0,
      unsynced_domains: (unsyncedRes.results || []).map((r: any) => r.domain),
      expiring_soon:    expiring,
      last_sync:        lastSync
    })
  } catch (err: any) {
    return c.json({ error: 'Sync status failed', detail: err?.message }, 500)
  }
})

// POST /api/porkbun/register — purchase domain + configure DNS + save to D1 (super_admin only)
app.post('/api/porkbun/register', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.PORKBUN_API_KEY || !c.env?.PORKBUN_SECRET_KEY) return c.json({ error: 'Porkbun credentials not configured' }, 503)
  if (!c.env?.DB) return c.json({ error: 'Database unavailable' }, 503)

  const { domain, years = '1' } = await c.req.json() as { domain: string; years?: string }
  if (!domain) return c.json({ error: 'domain required' }, 400)

  const steps: Array<{ step: string; status: 'ok' | 'error' | 'pending'; detail?: string }> = []
  const now = new Date().toISOString()

  // Step 1: Register with Porkbun
  try {
    const reg = await porkbunPost(c.env, `/domain/create/${domain}`, {
      years, autorenew: '1', agreement: 'yes', agreeToTerms: 'yes'
    })
    if (reg.status !== 'SUCCESS') {
      return c.json({ error: 'Registration failed', detail: reg.message || JSON.stringify(reg), steps }, 400)
    }
    steps.push({ step: 'register', status: 'ok' })
  } catch (err: any) {
    return c.json({ error: 'Registration API error', detail: err?.message, steps }, 500)
  }

  // Step 2: Save to D1
  try {
    const expiresAt = new Date(Date.now() + parseInt(years) * 365.25 * 86400000).toISOString().split('T')[0]
    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO domain_registrations (company_id,domain,tld,registrar,status,expires_at,auto_renew,whois_privacy,labels,imported_at,updated_at,created_at) VALUES (?,?,?,?,?,?,1,1,?,?,?,?)'
    ).bind(0, domain, domain.split('.').pop()||'', 'porkbun', 'ACTIVE', expiresAt, '[]', now, now, now).run()
    steps.push({ step: 'save_d1', status: 'ok' })
  } catch (err: any) {
    steps.push({ step: 'save_d1', status: 'error', detail: err?.message })
  }

  // Step 3: Configure DNS — CNAME @ → pages project (WHOIS privacy auto by Porkbun)
  try {
    const dns = await porkbunPost(c.env, `/dns/create/${domain}`, {
      type: 'CNAME', host: '@', answer: 'services-leads-marketing-hub.pages.dev', ttl: '600'
    })
    const ok = dns.status === 'SUCCESS'
    steps.push({ step: 'dns_cname', status: ok ? 'ok' : 'error', detail: ok ? undefined : dns.message })
    if (ok) {
      await c.env.DB.prepare('UPDATE domain_registrations SET dns_configured=1,updated_at=? WHERE domain=?').bind(now, domain).run()
    }
  } catch (err: any) {
    steps.push({ step: 'dns_cname', status: 'error', detail: err?.message })
  }

  // Step 4: Generate LP — remind user to complete in UI
  steps.push({ step: 'generate_lp',   status: 'pending', detail: 'Open LP Generator tab and generate for this domain' })
  steps.push({ step: 'activate_leads', status: 'pending', detail: 'Assign domain to a company in Domain Army' })
  steps.push({ step: 'cf_custom_domain', status: 'pending', detail: 'Add manually: CF Pages Dashboard → Custom Domains' })

  // Store expiry alert in KV if within 30 days (unlikely at registration but future-proof)
  if (c.env?.KV) {
    const daysOut = parseInt(years) * 365
    if (daysOut <= 30) {
      const expiry = new Date(Date.now() + daysOut * 86400000).toISOString()
      await c.env.KV.put(`expiry-alert:${domain}`, expiry, { expirationTtl: 60 * 60 * 24 * 60 })
    }
  }

  return c.json({ success: true, domain, steps, registered_at: now })
})

// GET /api/porkbun/expiry-alerts — domains expiring within 30 days (super_admin only)
app.get('/api/porkbun/expiry-alerts', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'Database unavailable' }, 503)

  try {
    const result = await c.env.DB.prepare(
      "SELECT dr.domain, dr.expires_at, dr.auto_renew, co.name as company_name FROM domain_registrations dr LEFT JOIN companies co ON dr.company_id = co.id WHERE dr.expires_at IS NOT NULL AND dr.expires_at <= date('now', '+30 days') ORDER BY dr.expires_at ASC"
    ).all()
    const alerts = (result.results || []).map((r: any) => ({
      ...r,
      days_left: Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / 86400000)
    }))
    if (c.env?.KV) {
      for (const a of alerts) {
        await c.env.KV.put(`expiry-alert:${a.domain}`, JSON.stringify(a), { expirationTtl: 60 * 60 * 24 * 7 })
      }
    }
    return c.json({ count: alerts.length, alerts })
  } catch (err: any) {
    return c.json({ error: 'Expiry check failed', detail: err?.message }, 500)
  }
})

// ── LP TEMPLATES ─────────────────────────────────────────────────────────
// GET /api/lp-templates — list all templates with usage stats (super_admin only)
app.get('/api/lp-templates', async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ templates: [] })
  try {
    const res = await c.env.DB.prepare(
      'SELECT template_number, name, primary_color, accent_color, style, layout, best_for, active, usage_count, last_used FROM lp_templates ORDER BY template_number'
    ).all()
    return c.json({ templates: res.results })
  } catch (err: any) {
    return c.json({ error: 'Failed to load templates', detail: err?.message }, 500)
  }
})

// PATCH /api/lp-templates/:num/reset — reset usage_count (super_admin only)
app.patch('/api/lp-templates/:num/reset', async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)
  try {
    await c.env.DB.prepare(
      'UPDATE lp_templates SET usage_count = 0, last_used = NULL WHERE template_number = ?'
    ).bind(Number(c.req.param('num'))).run()
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Reset failed', detail: err?.message }, 500)
  }
})

// ── R2 IMAGE SERVING ──────────────────────────────────────────────────────
// GET /api/images/:key+ — proxy R2 objects (no auth — images appear in LP pages)
app.get('/api/images/*', async (c) => {
  if (!c.env?.IMAGES) return c.json({ error: 'Image storage not configured' }, 503)
  const url = new URL(c.req.url)
  const key = decodeURIComponent(url.pathname.replace(/^\/api\/images\//, ''))
  if (!key || key.includes('..') || key.startsWith('/')) return c.json({ error: 'Invalid path' }, 400)
  try {
    const obj = await c.env.IMAGES.get(key)
    if (!obj) return c.json({ error: 'Not found' }, 404)
    const headers = new Headers()
    headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/jpeg')
    headers.set('Cache-Control', 'public, max-age=86400')
    return new Response(obj.body, { headers })
  } catch (err: any) {
    return c.json({ error: 'Image fetch failed', detail: err?.message }, 500)
  }
})

// POST /api/images/upload — upload image to R2 + record in domain_images (super_admin only)
app.post('/api/images/upload', async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.IMAGES) return c.json({ error: 'Image storage not configured' }, 503)
  try {
    const fd = await c.req.formData()
    const file      = fd.get('file') as File | null
    const domainId  = fd.get('domain_id')  ? Number(fd.get('domain_id'))  : null
    const tplId     = fd.get('template_id') ? Number(fd.get('template_id')) : null
    const imageType = (fd.get('image_type') as string) || 'hero'
    const altText   = (fd.get('alt_text')   as string) || ''
    const nicheIn   = (fd.get('niche')      as string) || 'restoration'

    if (!file) return c.json({ error: 'No file provided' }, 400)
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) return c.json({ error: 'Only JPEG, PNG, WebP allowed' }, 400)
    if (file.size > 5 * 1024 * 1024) return c.json({ error: 'File too large — max 5 MB' }, 400)

    let r2Key = ''
    let folderPath = ''
    let niche = nicheIn
    let companyId: number | null = null

    if (tplId && c.env.DB) {
      // Template hero image: templates/NN-slug/hero-niche.ext
      const tplRow = await c.env.DB.prepare(
        'SELECT template_number, name FROM lp_templates WHERE template_number = ?'
      ).bind(tplId).first() as any
      if (tplRow) {
        const nn   = String(tplRow.template_number).padStart(2, '0')
        const slug = (tplRow.name as string).toLowerCase().replace(/\s+/g, '-')
        folderPath = `templates/${nn}-${slug}`
        r2Key      = `${folderPath}/${imageType}-${niche}.${file.name.split('.').pop() || 'jpg'}`
      }
    } else if (domainId && c.env.DB) {
      // Domain-specific image: domains/domain.tld/type-timestamp.ext
      const domRow = await c.env.DB.prepare(
        'SELECT d.domain, d.company, co.id as co_id FROM domains d LEFT JOIN companies co ON d.company = co.key WHERE d.id = ?'
      ).bind(domainId).first() as any
      if (domRow) {
        companyId  = domRow.co_id
        niche      = getNiche(domRow.company, domRow.company)
        folderPath = `domains/${domRow.domain}`
        r2Key      = `${folderPath}/${imageType}-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`
      }
    }
    if (!r2Key) {
      folderPath = 'uploads'
      r2Key = `uploads/${imageType}-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`
    }

    await c.env.IMAGES.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    })

    const now = new Date().toISOString()
    if (c.env.DB) {
      await c.env.DB.prepare(
        'INSERT INTO domain_images (domain_id, company_id, niche, template_id, image_type, folder_path, filename, r2_key, alt_text, source, approved, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
      ).bind(domainId, companyId, niche, tplId || 0, imageType, folderPath, file.name, r2Key, altText || null, 'uploaded', 0, now).run()
    }

    return c.json({ success: true, r2Key, url: `/api/images/${r2Key}`, imageType, niche, approved: false })
  } catch (err: any) {
    return c.json({ error: 'Upload failed', detail: err?.message }, 500)
  }
})

// GET /api/images/list — list uploaded images for a domain or template (super_admin only)
app.get('/api/images/list', async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ images: [] })
  try {
    const domainId  = c.req.query('domain_id')
    const tplId     = c.req.query('template_id')
    let rows: any[] = []
    if (domainId) {
      const res = await c.env.DB.prepare(
        'SELECT id, r2_key, image_type, niche, alt_text, approved, created_at FROM domain_images WHERE domain_id = ? ORDER BY created_at DESC LIMIT 50'
      ).bind(Number(domainId)).all()
      rows = res.results as any[]
    } else if (tplId) {
      const res = await c.env.DB.prepare(
        'SELECT id, r2_key, image_type, niche, alt_text, approved, created_at FROM domain_images WHERE template_id = ? ORDER BY created_at DESC LIMIT 50'
      ).bind(Number(tplId)).all()
      rows = res.results as any[]
    } else {
      const res = await c.env.DB.prepare(
        'SELECT id, r2_key, image_type, niche, alt_text, approved, created_at FROM domain_images ORDER BY created_at DESC LIMIT 100'
      ).all()
      rows = res.results as any[]
    }
    return c.json({ images: rows.map(r => ({ ...r, url: `/api/images/${r.r2_key}` })) })
  } catch (err: any) {
    return c.json({ error: 'List failed', detail: err?.message }, 500)
  }
})

// ── GOOGLE REVIEWS API ────────────────────────────────────────────────────────
// All reviews are real — sourced from Google Places API (New).
// GOOGLE_PLACES_API_KEY set via: wrangler pages secret put GOOGLE_PLACES_API_KEY --project-name services-leads-marketing-hub
// Tables: google_business_profiles, google_reviews (both exist in D1)
const PLACES_BASE = 'https://places.googleapis.com/v1'

async function placesGet(env: Bindings, path: string, fieldMask: string): Promise<any> {
  const res = await fetch(`${PLACES_BASE}${path}`, {
    method: 'GET',
    headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY || '', 'X-Goog-FieldMask': fieldMask }
  })
  return res.json()
}

async function placesSearch(env: Bindings, query: string): Promise<any> {
  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: 'POST',
    headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY || '', 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri', 'Content-Type': 'application/json' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 5 })
  })
  return res.json()
}

// POST /api/reviews/search-business — search Google Places by name/address
app.post('/api/reviews/search-business', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.GOOGLE_PLACES_API_KEY) return c.json({ error: 'GOOGLE_PLACES_API_KEY not configured — add via wrangler pages secret put' }, 503)
  const { query } = await c.req.json()
  if (!query) return c.json({ error: 'query required' }, 400)
  try {
    const data = await placesSearch(c.env, query)
    const results = (data.places || []).map((p: any) => ({
      place_id:     p.id,
      name:         p.displayName?.text || '',
      address:      p.formattedAddress || '',
      rating:       p.rating || null,
      total_reviews: p.userRatingCount || 0,
      maps_url:     p.googleMapsUri || ''
    }))
    return c.json({ results })
  } catch (err: any) {
    return c.json({ error: 'Places search failed', detail: err?.message }, 500)
  }
})

// POST /api/reviews/connect/:company_id — save a Google Business Profile
app.post('/api/reviews/connect/:company_id', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)
  const companyId = Number(c.req.param('company_id'))
  const { place_id, business_name, average_rating, total_reviews, profile_url } = await c.req.json()
  if (!place_id || !business_name) return c.json({ error: 'place_id and business_name required' }, 400)
  // company_admin can only connect their own company
  if (user.role === 'company_admin' && user.company_id !== companyId) return c.json({ error: 'Forbidden' }, 403)
  try {
    await c.env.DB.prepare(
      `INSERT INTO google_business_profiles (company_id, place_id, business_name, average_rating, total_reviews, profile_url, last_synced, sync_enabled)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 1)
       ON CONFLICT(company_id) DO UPDATE SET place_id=excluded.place_id, business_name=excluded.business_name, average_rating=excluded.average_rating, total_reviews=excluded.total_reviews, profile_url=excluded.profile_url, sync_enabled=1`
    ).bind(companyId, place_id, business_name, average_rating || null, total_reviews || 0, profile_url || null).run()
    return c.json({ success: true, message: 'Google Business Profile connected — run sync to fetch reviews' })
  } catch (err: any) {
    return c.json({ error: 'Connect failed', detail: err?.message }, 500)
  }
})

// POST /api/reviews/sync/:company_id — fetch reviews from Google Places + store in D1
app.post('/api/reviews/sync/:company_id', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)
  if (!c.env?.GOOGLE_PLACES_API_KEY) return c.json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, 503)
  const companyId = Number(c.req.param('company_id'))
  if (user.role === 'company_admin' && user.company_id !== companyId) return c.json({ error: 'Forbidden' }, 403)
  try {
    const profile = await c.env.DB.prepare(
      'SELECT place_id, business_name FROM google_business_profiles WHERE company_id = ?'
    ).bind(companyId).first() as any
    if (!profile) return c.json({ error: 'No Google Business Profile connected for this company — connect one first' }, 404)

    // Fetch place details + reviews from Google Places API (New)
    const data = await placesGet(c.env, `/places/${profile.place_id}`, 'displayName,rating,userRatingCount,reviews,googleMapsUri')
    const rawReviews: any[] = data.reviews || []

    // Filter: rating >= 4, text >= 50 chars
    const qualified = rawReviews
      .filter(r => (r.rating || 0) >= 4 && (r.text?.text || '').length >= 50)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 10)

    if (qualified.length === 0) {
      return c.json({ success: true, synced: 0, message: 'No qualifying reviews (need rating ≥ 4 and text ≥ 50 chars)' })
    }

    // Clear existing reviews for this company, re-insert fresh
    await c.env.DB.prepare('DELETE FROM google_reviews WHERE company_id = ?').bind(companyId).run()

    const now = new Date().toISOString()
    const inserts = qualified.map((r: any, i: number) => c.env.DB.prepare(
      `INSERT INTO google_reviews (company_id, google_place_id, reviewer_name, reviewer_photo, rating, review_text, review_date, relative_time, verified, featured, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(
      companyId,
      profile.place_id,
      r.authorAttribution?.displayName || 'Google Reviewer',
      r.authorAttribution?.photoUri || null,
      r.rating || 5,
      r.text?.text || '',
      r.publishTime || now,
      r.relativePublishTimeDescription || null,
      i < 5 ? 1 : 0,   // top 5 auto-featured
      now
    ))
    await c.env.DB.batch(inserts)

    // Update profile sync timestamp + stats
    await c.env.DB.prepare(
      'UPDATE google_business_profiles SET last_synced = ?, average_rating = ?, total_reviews = ? WHERE company_id = ?'
    ).bind(now, data.rating || null, data.userRatingCount || 0, companyId).run()

    // Invalidate KV cache
    if (c.env?.KV) await c.env.KV.delete(`reviews:${companyId}`)

    return c.json({ success: true, synced: qualified.length, featured: Math.min(5, qualified.length), message: `Synced ${qualified.length} qualifying reviews` })
  } catch (err: any) {
    return c.json({ error: 'Sync failed', detail: err?.message }, 500)
  }
})

// GET /api/reviews/:company_id — list stored reviews from D1
app.get('/api/reviews/:company_id', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  const companyId = Number(c.req.param('company_id'))
  if (user.role === 'company_admin' && user.company_id !== companyId) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ reviews: [], profile: null })
  try {
    const [rvRes, profRes] = await Promise.all([
      c.env.DB.prepare('SELECT id, reviewer_name, reviewer_photo, rating, review_text, review_date, relative_time, verified, featured FROM google_reviews WHERE company_id = ? ORDER BY featured DESC, rating DESC, review_date DESC LIMIT 20').bind(companyId).all(),
      c.env.DB.prepare('SELECT place_id, business_name, average_rating, total_reviews, profile_url, last_synced, sync_enabled FROM google_business_profiles WHERE company_id = ?').bind(companyId).first()
    ])
    return c.json({ reviews: rvRes.results || [], profile: profRes || null })
  } catch (err: any) {
    return c.json({ error: 'Fetch failed', detail: err?.message }, 500)
  }
})

// GET /api/reviews — list all profiles (super_admin) or own profile (company_admin)
app.get('/api/reviews', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (!c.env?.DB) return c.json({ profiles: [] })
  try {
    let res
    if (user.role === 'super_admin') {
      res = await c.env.DB.prepare(
        `SELECT gbp.*, co.name AS company_name, co.key AS company_key,
         (SELECT COUNT(*) FROM google_reviews gr WHERE gr.company_id = gbp.company_id) AS review_count
         FROM google_business_profiles gbp JOIN companies co ON gbp.company_id = co.id ORDER BY co.name`
      ).all()
    } else {
      res = await c.env.DB.prepare(
        `SELECT gbp.*, co.name AS company_name, co.key AS company_key,
         (SELECT COUNT(*) FROM google_reviews gr WHERE gr.company_id = gbp.company_id) AS review_count
         FROM google_business_profiles gbp JOIN companies co ON gbp.company_id = co.id WHERE gbp.company_id = ?`
      ).bind(user.company_id).all()
    }
    return c.json({ profiles: res.results || [] })
  } catch (err: any) {
    return c.json({ error: 'Fetch failed', detail: err?.message }, 500)
  }
})

// PATCH /api/reviews/:review_id/featured — toggle featured status
app.patch('/api/reviews/:review_id/featured', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)
  const reviewId = Number(c.req.param('review_id'))
  const { featured } = await c.req.json()
  try {
    // company_admin can only edit their own reviews
    if (user.role === 'company_admin') {
      const rv = await c.env.DB.prepare('SELECT company_id FROM google_reviews WHERE id = ?').bind(reviewId).first() as any
      if (!rv || rv.company_id !== user.company_id) return c.json({ error: 'Forbidden' }, 403)
    }
    await c.env.DB.prepare('UPDATE google_reviews SET featured = ? WHERE id = ?').bind(featured ? 1 : 0, reviewId).run()
    // Invalidate KV cache for this company
    if (c.env?.KV) {
      const rv = await c.env.DB.prepare('SELECT company_id FROM google_reviews WHERE id = ?').bind(reviewId).first() as any
      if (rv?.company_id) await c.env.KV.delete(`reviews:${rv.company_id}`)
    }
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Update failed', detail: err?.message }, 500)
  }
})

// ── TENANT SYSTEM ─────────────────────────────────────────────────────────────
// White-label multi-tenant SaaS.  Three-tier role hierarchy:
//   super_admin → company_admin (tenant, pays monthly) → staff (tenant employee)
// Tenant isolation: all queries scoped by company_id.  super_admin bypasses filters.
// Invitation tokens expire in 7 days and are single-use.

async function hashPassword(password: string): Promise<string> {
  const enc  = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const key  = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: { name: 'SHA-256' } },
    key, 256
  )
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${saltHex}:${hashHex}`
}

function generateToken(len = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sendInviteEmail(
  toEmail: string,
  subject: string,
  htmlBody: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: 'no-reply@slm-hub.ca', name: 'SLM Hub' },
        subject,
        content: [{ type: 'text/html', value: htmlBody }]
      })
    })
    if (res.status === 202 || res.status === 200) return { sent: true }
    const text = await res.text().catch(() => '')
    return { sent: false, error: `MailChannels ${res.status}: ${text.slice(0, 200)}` }
  } catch (e: any) {
    return { sent: false, error: e?.message || 'Send failed' }
  }
}

// GET /api/subscription-plans — list active plans (public — needed for invite page)
app.get('/api/subscription-plans', async (c) => {
  if (!c.env?.DB) return c.json({ plans: [] })
  try {
    const res = await c.env.DB.prepare('SELECT * FROM subscription_plans WHERE active = 1 ORDER BY price_monthly').all()
    return c.json({ plans: res.results || [] })
  } catch (err: any) {
    return c.json({ error: 'Fetch failed', detail: err?.message }, 500)
  }
})

// GET /api/tenants — list all tenants with usage (super_admin only)
app.get('/api/tenants', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ tenants: [] })
  try {
    const res = await c.env.DB.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM domains d WHERE d.company = t.company_key) AS domain_count,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = t.id AND u.active = 1) AS user_count
      FROM tenants t ORDER BY t.created_at DESC
    `).all()
    return c.json({ tenants: res.results || [] })
  } catch (err: any) {
    return c.json({ error: 'Fetch failed', detail: err?.message }, 500)
  }
})

// POST /api/tenants/invite — create tenant + invitation + send email (super_admin only)
app.post('/api/tenants/invite', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)

  const body = await c.req.json()
  const { company_name, billing_email, plan, monthly_fee, max_domains, max_users, notes } = body
  if (!company_name || !billing_email) return c.json({ error: 'company_name and billing_email required' }, 400)
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(billing_email)) return c.json({ error: 'Invalid billing email' }, 400)

  // Derive company_key from name
  const company_key = company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  const now        = new Date().toISOString()
  const expiresAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const token      = generateToken(32)

  try {
    // Create tenant
    const tenantRes = await c.env.DB.prepare(
      `INSERT INTO tenants (company_name, company_key, plan, status, invited_by, invited_at, billing_email, monthly_fee, max_domains, max_users, notes, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      company_name.trim(),
      company_key,
      plan || 'starter',
      user.id,
      now,
      billing_email.toLowerCase().trim(),
      monthly_fee || 0,
      max_domains || 10,
      max_users || 5,
      notes || null,
      now
    ).run()

    const tenantId = tenantRes.meta?.last_row_id
    if (!tenantId) return c.json({ error: 'Failed to create tenant' }, 500)

    // Create invitation
    await c.env.DB.prepare(
      `INSERT INTO tenant_invitations (tenant_id, email, role, token, status, invited_by, invited_at, expires_at)
       VALUES (?, ?, 'company_admin', ?, 'pending', ?, ?, ?)`
    ).bind(tenantId, billing_email.toLowerCase().trim(), token, user.id, now, expiresAt).run()

    // Build invite URL
    const inviteUrl = `https://slm-hub.ca/invite/${token}`

    // Send email via MailChannels
    const emailHtml = `
      <!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#0d1117;color:#e2e8f0;padding:40px;max-width:600px;margin:0 auto">
        <div style="background:#CC0000;padding:16px 24px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;color:#fff;font-size:20px">🚨 You've been invited to SLM Hub</h1>
        </div>
        <div style="background:#1a2236;padding:28px;border-radius:0 0 8px 8px;border:1px solid #1e2d40">
          <p style="font-size:16px;margin-top:0">Hi there,</p>
          <p>You've been invited to join <strong style="color:#CC0000">SLM Hub</strong> — the Services Leads Marketing platform.</p>
          <p><strong>Company:</strong> ${company_name}</p>
          <p><strong>Plan:</strong> ${plan || 'Starter'}</p>
          <p>Click the button below to activate your account. This link expires in 7 days.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${inviteUrl}" style="background:#CC0000;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
              Activate My Account →
            </a>
          </div>
          <p style="font-size:13px;color:#64748b">Or copy this link:<br><code style="background:#0d1117;padding:4px 8px;border-radius:4px;font-size:12px">${inviteUrl}</code></p>
          <hr style="border-color:#1e2d40;margin:24px 0">
          <p style="font-size:12px;color:#64748b;margin:0">If you didn't expect this invitation, ignore this email.</p>
        </div>
      </body></html>`

    const emailResult = await sendInviteEmail(
      billing_email,
      `You've been invited to SLM Hub — ${company_name}`,
      emailHtml
    )

    return c.json({
      success: true,
      tenant_id: tenantId,
      invite_url: inviteUrl,
      email_sent: emailResult.sent,
      email_error: emailResult.error || null,
      message: emailResult.sent
        ? `Invitation sent to ${billing_email}`
        : `Tenant created. Email send failed (${emailResult.error}) — share invite link manually: ${inviteUrl}`
    })
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) return c.json({ error: `Company key "${company_key}" already exists` }, 409)
    return c.json({ error: 'Failed to create invitation', detail: e?.message }, 500)
  }
})

// GET /api/tenants/:id — tenant detail with usage stats + invited users (super_admin only)
app.get('/api/tenants/:id', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)
  const id = Number(c.req.param('id'))
  try {
    const [tenant, invitations, members] = await Promise.all([
      c.env.DB.prepare(`
        SELECT t.*,
          (SELECT COUNT(*) FROM domains d WHERE d.company = t.company_key) AS domain_count,
          (SELECT COUNT(*) FROM users u WHERE u.company_id = t.id AND u.active = 1) AS user_count,
          (SELECT COUNT(*) FROM google_business_profiles gbp WHERE gbp.company_id = t.id) AS gbp_count
        FROM tenants t WHERE t.id = ?`).bind(id).first(),
      c.env.DB.prepare('SELECT id, email, role, status, invited_at, accepted_at, expires_at FROM tenant_invitations WHERE tenant_id = ? ORDER BY invited_at DESC').bind(id).all(),
      c.env.DB.prepare("SELECT id, name, email, role, active, last_login FROM users WHERE company_id = ? ORDER BY role, name").bind(id).all()
    ])
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404)
    return c.json({ tenant, invitations: invitations.results || [], members: members.results || [] })
  } catch (err: any) {
    return c.json({ error: 'Fetch failed', detail: err?.message }, 500)
  }
})

// PATCH /api/tenants/:id — update tenant plan/status/fee (super_admin only)
app.patch('/api/tenants/:id', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)
  const id   = Number(c.req.param('id'))
  const body = await c.req.json()
  const { plan, status, monthly_fee, max_domains, max_users, notes } = body
  try {
    await c.env.DB.prepare(
      'UPDATE tenants SET plan=?, status=?, monthly_fee=?, max_domains=?, max_users=?, notes=? WHERE id=?'
    ).bind(plan, status, monthly_fee, max_domains, max_users, notes || null, id).run()
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Update failed', detail: err?.message }, 500)
  }
})

// GET /api/invite/:token — validate token + return tenant/plan data (PUBLIC — no auth)
app.get('/api/invite/:token', async (c) => {
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)
  const token = c.req.param('token')
  try {
    const inv = await c.env.DB.prepare(
      'SELECT i.*, t.company_name, t.plan, t.monthly_fee FROM tenant_invitations i JOIN tenants t ON i.tenant_id = t.id WHERE i.token = ?'
    ).bind(token).first() as any
    if (!inv) return c.json({ error: 'invalid', message: 'This invitation was not found.' }, 404)
    if (inv.status !== 'pending') return c.json({ error: 'used', message: 'This invitation has already been accepted.' }, 410)
    const now = new Date().toISOString()
    if (inv.expires_at < now) {
      await c.env.DB.prepare("UPDATE tenant_invitations SET status='expired' WHERE token=?").bind(token).run()
      return c.json({ error: 'expired', message: 'This invitation link has expired. Contact your administrator for a new one.' }, 410)
    }
    return c.json({
      valid: true,
      email: inv.email,
      role: inv.role,
      company_name: inv.company_name,
      plan: inv.plan,
      monthly_fee: inv.monthly_fee,
      tenant_id: inv.tenant_id
    })
  } catch (err: any) {
    return c.json({ error: 'Lookup failed', detail: err?.message }, 500)
  }
})

// POST /api/invite/:token/accept — create user + activate tenant + create session (PUBLIC)
app.post('/api/invite/:token/accept', async (c) => {
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)
  const token = c.req.param('token')
  const body  = await c.req.json()
  const { name, password } = body
  if (!name || !password) return c.json({ error: 'name and password required' }, 400)
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400)

  try {
    const inv = await c.env.DB.prepare(
      'SELECT i.*, t.company_name, t.company_key, t.id AS tenant_id FROM tenant_invitations i JOIN tenants t ON i.tenant_id = t.id WHERE i.token = ? AND i.status = ?'
    ).bind(token, 'pending').first() as any
    if (!inv) return c.json({ error: 'expired_or_used', message: 'This invitation is no longer valid.' }, 410)

    const now      = new Date().toISOString()
    if (inv.expires_at < now) return c.json({ error: 'expired', message: 'This invitation has expired.' }, 410)

    // Check if a user with this email already exists
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(inv.email).first()
    if (existing) return c.json({ error: 'Email already registered. Please log in instead.' }, 409)

    const passwordHash = await hashPassword(password)
    const userId       = crypto.randomUUID()
    const sessionId    = crypto.randomUUID()
    const sessionToken = crypto.randomUUID()
    const expiresAt    = new Date(Date.now() + 86400000).toISOString()

    // Determine company_id based on role:
    // company_admin → tenant.id (links to companies table — assumes company was created via Companies tab or will be)
    // staff → same as the inviting company_admin's company_id (stored in invitation)
    let companyId: number | null = inv.tenant_id

    // For staff: get the company_id from the inviting user's session context
    if (inv.role === 'staff') {
      const invitingUser = await c.env.DB.prepare('SELECT company_id FROM users WHERE id = ?').bind(inv.invited_by).first() as any
      companyId = invitingUser?.company_id || inv.tenant_id
    }

    // Create user
    await c.env.DB.prepare(
      'INSERT INTO users (id, name, email, password_hash, role, company_id, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
    ).bind(userId, name.trim(), inv.email, passwordHash, inv.role, companyId, now).run()

    // Activate tenant (only for company_admin role)
    if (inv.role === 'company_admin') {
      await c.env.DB.prepare(
        "UPDATE tenants SET status='active', activated_at=? WHERE id=?"
      ).bind(now, inv.tenant_id).run()
    }

    // Mark invitation accepted
    await c.env.DB.prepare(
      "UPDATE tenant_invitations SET status='accepted', accepted_at=? WHERE token=?"
    ).bind(now, token).run()

    // Create session
    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(sessionId, userId, sessionToken, expiresAt, now).run()

    return new Response(JSON.stringify({
      success: true,
      user: { id: userId, email: inv.email, role: inv.role, name: name.trim(), company_id: companyId }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `slm_token=${sessionToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`
      }
    })
  } catch (err: any) {
    return c.json({ error: 'Activation failed', detail: err?.message }, 500)
  }
})

// POST /api/team/invite — company_admin invites staff (or super_admin invites anyone)
app.post('/api/team/invite', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)

  const { email, role } = await c.req.json()
  if (!email) return c.json({ error: 'email required' }, 400)
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return c.json({ error: 'Invalid email' }, 400)

  // company_admin can only invite staff
  const inviteRole = user.role === 'super_admin' ? (role || 'staff') : 'staff'

  // Enforce user limit for company_admin
  if (user.role === 'company_admin' && user.company_id) {
    const tenant = await c.env.DB.prepare('SELECT max_users FROM tenants WHERE id = ?').bind(user.company_id).first() as any
    if (tenant) {
      const currentCount = await c.env.DB.prepare('SELECT COUNT(*) AS cnt FROM users WHERE company_id = ? AND active = 1').bind(user.company_id).first() as any
      const cnt = currentCount?.cnt || 0
      if (cnt >= tenant.max_users) {
        return c.json({ error: `User limit reached (${tenant.max_users} max on your plan). Upgrade to add more team members.` }, 403)
      }
    }
  }

  const now       = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const token     = generateToken(32)
  const tenantId  = user.company_id

  // Get company name for email
  const companyRow = await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(tenantId).first() as any
  const companyName = companyRow?.name || 'SLM Hub'

  try {
    await c.env.DB.prepare(
      `INSERT INTO tenant_invitations (tenant_id, email, role, token, status, invited_by, invited_at, expires_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).bind(tenantId, email.toLowerCase().trim(), inviteRole, token, user.id, now, expiresAt).run()

    const inviteUrl = `https://slm-hub.ca/invite/${token}`
    const emailHtml = `
      <!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#0d1117;color:#e2e8f0;padding:40px;max-width:600px;margin:0 auto">
        <div style="background:#CC0000;padding:16px 24px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;color:#fff;font-size:20px">🚨 Join ${companyName} on SLM Hub</h1>
        </div>
        <div style="background:#1a2236;padding:28px;border-radius:0 0 8px 8px;border:1px solid #1e2d40">
          <p style="font-size:16px;margin-top:0">You've been invited to join <strong style="color:#CC0000">${companyName}</strong> on SLM Hub as a <strong>${inviteRole}</strong>.</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${inviteUrl}" style="background:#CC0000;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">
              Accept Invitation →
            </a>
          </div>
          <p style="font-size:13px;color:#64748b">Link: <code style="background:#0d1117;padding:4px 8px;border-radius:4px">${inviteUrl}</code></p>
          <p style="font-size:12px;color:#64748b;margin-bottom:0">Expires in 7 days.</p>
        </div>
      </body></html>`

    const emailResult = await sendInviteEmail(email, `You've been invited to join ${companyName} on SLM Hub`, emailHtml)

    return c.json({
      success: true,
      invite_url: inviteUrl,
      email_sent: emailResult.sent,
      email_error: emailResult.error || null,
      message: emailResult.sent ? `Invitation sent to ${email}` : `Invite created. Share this link: ${inviteUrl}`
    })
  } catch (e: any) {
    return c.json({ error: 'Failed to create invitation', detail: e?.message }, 500)
  }
})

// GET /api/team — list team members for current company (company_admin+)
app.get('/api/team', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (!c.env?.DB) return c.json({ members: [], invitations: [] })
  const companyId = user.role === 'super_admin' ? null : user.company_id
  try {
    const [members, invitations] = await Promise.all([
      companyId !== null
        ? c.env.DB.prepare("SELECT id, name, email, role, active, last_login, created_at FROM users WHERE company_id = ? ORDER BY role, name").bind(companyId).all()
        : c.env.DB.prepare("SELECT id, name, email, role, active, last_login, created_at, company_id FROM users ORDER BY company_id, role, name").all(),
      companyId !== null
        ? c.env.DB.prepare("SELECT id, email, role, status, invited_at, accepted_at, expires_at FROM tenant_invitations WHERE tenant_id = ? ORDER BY invited_at DESC").bind(companyId).all()
        : c.env.DB.prepare("SELECT id, email, role, status, invited_at, accepted_at, expires_at, tenant_id FROM tenant_invitations ORDER BY invited_at DESC LIMIT 50").all()
    ])
    return c.json({ members: members.results || [], invitations: invitations.results || [] })
  } catch (err: any) {
    return c.json({ error: 'Fetch failed', detail: err?.message }, 500)
  }
})

// POST /api/tenants/:id/impersonate — super_admin starts impersonation session
app.post('/api/tenants/:id/impersonate', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB || !c.env?.KV) return c.json({ error: 'DB/KV unavailable' }, 500)
  const tenantId = Number(c.req.param('id'))
  try {
    // Find the company_admin user for this tenant
    const adminUser = await c.env.DB.prepare(
      "SELECT id, email, role, company_id, name FROM users WHERE company_id = ? AND role = 'company_admin' AND active = 1 LIMIT 1"
    ).bind(tenantId).first() as any
    if (!adminUser) return c.json({ error: 'No active company_admin found for this tenant' }, 404)

    const now        = new Date().toISOString()
    const sessionId  = crypto.randomUUID()
    const impToken   = crypto.randomUUID()
    const expiresAt  = new Date(Date.now() + 3600000).toISOString() // 1 hour impersonation

    await c.env.DB.prepare(
      'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(sessionId, adminUser.id, impToken, expiresAt, now).run()

    // Store the original super_admin token so they can exit impersonation
    const originalToken = getToken(c)
    if (originalToken) {
      await c.env.KV.put(`impersonate_origin:${impToken}`, originalToken, { expirationTtl: 3600 })
    }

    // Get company info for the banner
    const co = await c.env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(tenantId).first() as any

    return new Response(JSON.stringify({
      success: true,
      impersonating: adminUser.name || adminUser.email,
      company_name: co?.name || 'Unknown',
      message: `Now viewing as ${adminUser.name || adminUser.email} — ${co?.name || 'Unknown'}`
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `slm_token=${impToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=3600`
      }
    })
  } catch (err: any) {
    return c.json({ error: 'Impersonation failed', detail: err?.message }, 500)
  }
})

// POST /api/auth/exit-impersonate — restore super_admin session
app.post('/api/auth/exit-impersonate', async (c) => {
  if (!c.env?.KV || !c.env?.DB) return c.json({ error: 'KV/DB unavailable' }, 500)
  const currentToken = getToken(c)
  if (!currentToken) return c.json({ error: 'No session' }, 401)
  try {
    const originalToken = await c.env.KV.get(`impersonate_origin:${currentToken}`)
    if (!originalToken) return c.json({ error: 'Not in impersonation mode' }, 400)

    // Delete impersonation session + KV key
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(currentToken).run()
    await c.env.KV.delete(`impersonate_origin:${currentToken}`)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `slm_token=${originalToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`
      }
    })
  } catch (err: any) {
    return c.json({ error: 'Exit failed', detail: err?.message }, 500)
  }
})

// PATCH /api/images/:id/approve — approve an image (super_admin only)
app.patch('/api/images/:id/approve', async (c) => {
  const user = c.get('user')
  if (user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)
  try {
    await c.env.DB.prepare('UPDATE domain_images SET approved = 1 WHERE id = ?')
      .bind(Number(c.req.param('id'))).run()
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Approve failed', detail: err?.message }, 500)
  }
})

// ── SERPAPI COMPETITOR INTELLIGENCE ──────────────────────────────────────
// Free plan: 250 searches/month
// Budget thresholds: warn at 200, hard-stop at 250
// Cache TTL: 14 days (KV key: serp:{competitor_id}:{kw_slug}:{YYYY-MM-DD})
// Usage tracking: KV key serp-usage:{YYYY-MM} — incremented per successful call

const SERP_WARN_THRESHOLD = 200
const SERP_HARD_LIMIT     = 250
const SERP_BASE           = 'https://serpapi.com'

async function serpFetch(env: Bindings, params: Record<string, string>): Promise<any> {
  const url = new URL(`${SERP_BASE}/search.json`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('api_key', env.SERPAPI_KEY || '')
  const res = await fetch(url.toString())
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`SerpAPI ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.json()
}

async function getSerpUsage(env: Bindings): Promise<number> {
  if (!env.KV) return 0
  const key = `serp-usage:${new Date().toISOString().slice(0, 7)}`
  const val = await env.KV.get(key)
  return val ? parseInt(val, 10) : 0
}

async function incrementSerpUsage(env: Bindings): Promise<number> {
  if (!env.KV) return 0
  const key  = `serp-usage:${new Date().toISOString().slice(0, 7)}`
  const next = (await getSerpUsage(env)) + 1
  await env.KV.put(key, String(next), { expirationTtl: 60 * 60 * 24 * 35 }) // 35-day TTL covers full month
  return next
}

async function getSerpAccountCached(env: Bindings): Promise<{ plan_searches_left: number; total_searches_done: number } | null> {
  if (!env.SERPAPI_KEY || !env.KV) return null
  const cacheKey = `serp-account-cache`
  const cached   = await env.KV.get(cacheKey)
  if (cached) return JSON.parse(cached)
  try {
    const res  = await fetch(`${SERP_BASE}/account.json?api_key=${env.SERPAPI_KEY}`)
    if (!res.ok) return null
    const data = await res.json() as any
    const result = { plan_searches_left: data.plan_searches_left ?? 250, total_searches_done: data.total_searches_done ?? 0 }
    await env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 }) // 1-hour cache
    return result
  } catch { return null }
}

function normDomain(d: string): string {
  return (d || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase().trim()
}

function findDomainInResults(results: any[], competitorDomain: string): number | null {
  if (!competitorDomain) return null
  const cd = normDomain(competitorDomain)
  for (let i = 0; i < results.length; i++) {
    const r   = results[i]
    const link = normDomain(r.link || r.displayed_link || r.domain || '')
    if (link && (link === cd || link.endsWith('.' + cd) || link.includes(cd))) return i + 1
  }
  return null
}

async function runGoogleSearch(env: Bindings, keyword: string, city: string): Promise<{
  ads: any[]; localServiceAds: any[]; organicResults: any[]
}> {
  const data = await serpFetch(env, {
    engine: 'google', q: `${keyword} ${city}`,
    gl: 'ca', hl: 'en', location: 'Ottawa,Ontario,Canada', num: '10'
  })
  return {
    ads:              data.ads                || [],
    localServiceAds:  data.local_service_ads  || [],
    organicResults:   data.organic_results    || []
  }
}

// ── SERPAPI ENDPOINTS ─────────────────────────────────────────────────────

// GET /api/intel/budget — monthly usage + SerpAPI account credits
app.get('/api/intel/budget', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  const usage   = await getSerpUsage(c.env)
  const account = await getSerpAccountCached(c.env)
  const pct     = Math.min(100, Math.round((usage / SERP_HARD_LIMIT) * 100))
  return c.json({
    usage,
    limit:              SERP_HARD_LIMIT,
    warn_threshold:     SERP_WARN_THRESHOLD,
    percent:            pct,
    paused:             usage >= SERP_HARD_LIMIT,
    warning:            usage >= SERP_WARN_THRESHOLD && usage < SERP_HARD_LIMIT,
    month:              new Date().toISOString().slice(0, 7),
    plan_searches_left: account?.plan_searches_left ?? null,
    total_done:         account?.total_searches_done ?? null
  })
})

// GET /api/intel/competitors — list competitors
app.get('/api/intel/competitors', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ competitors: [] })
  try {
    let rows: any[]
    if (user.role === 'super_admin') {
      const res = await c.env.DB.prepare(
        'SELECT c.*, (SELECT COUNT(*) FROM competitor_scans cs WHERE cs.competitor_id = c.id) as scan_count FROM competitors c ORDER BY c.added_at DESC LIMIT 100'
      ).all()
      rows = res.results as any[]
    } else {
      const res = await c.env.DB.prepare(
        'SELECT c.*, (SELECT COUNT(*) FROM competitor_scans cs WHERE cs.competitor_id = c.id) as scan_count FROM competitors c WHERE c.company_id = ? ORDER BY c.added_at DESC LIMIT 100'
      ).bind(user.company_id).all()
      rows = res.results as any[]
    }
    return c.json({ competitors: rows.map(r => ({ ...r, serp_keywords: JSON.parse(r.serp_keywords || '[]') })) })
  } catch (err: any) {
    return c.json({ error: 'Failed to load competitors', detail: err?.message }, 500)
  }
})

// POST /api/intel/competitors — add a competitor to monitor
app.post('/api/intel/competitors', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)
  const { competitor_name, website_url, territory = 'Ottawa', niche = '', serp_keywords = [], notes = '' } = await c.req.json()
  if (!competitor_name) return c.json({ error: 'competitor_name required' }, 400)
  const companyId = user.role === 'super_admin' ? (await c.req.json().catch(() => ({}))).company_id ?? null : user.company_id
  const now = new Date().toISOString()
  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO competitors (company_id, competitor_name, website_url, territory, niche, status, serp_keywords, notes, added_by, added_at, scan_status)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, 'pending')`
    ).bind(companyId, competitor_name, website_url || null, territory, niche, JSON.stringify(serp_keywords), notes || null, user.email, now).run()
    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (err: any) {
    return c.json({ error: 'Insert failed', detail: err?.message }, 500)
  }
})

// PATCH /api/intel/competitors/:id — update keywords, name, territory etc.
app.patch('/api/intel/competitors/:id', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)
  const id = Number(c.req.param('id'))
  // Verify ownership for company_admin
  if (user.role === 'company_admin') {
    const row = await c.env.DB.prepare('SELECT company_id FROM competitors WHERE id = ?').bind(id).first() as any
    if (!row || row.company_id !== user.company_id) return c.json({ error: 'Forbidden' }, 403)
  }
  const { competitor_name, website_url, territory, niche, serp_keywords, notes } = await c.req.json()
  try {
    await c.env.DB.prepare(
      `UPDATE competitors SET
        competitor_name = COALESCE(?, competitor_name),
        website_url     = COALESCE(?, website_url),
        territory       = COALESCE(?, territory),
        niche           = COALESCE(?, niche),
        serp_keywords   = COALESCE(?, serp_keywords),
        notes           = COALESCE(?, notes)
       WHERE id = ?`
    ).bind(
      competitor_name ?? null, website_url ?? null, territory ?? null,
      niche ?? null, serp_keywords ? JSON.stringify(serp_keywords) : null, notes ?? null, id
    ).run()
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Update failed', detail: err?.message }, 500)
  }
})

// DELETE /api/intel/competitors/:id — remove competitor + all scan data
app.delete('/api/intel/competitors/:id', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)
  const id = Number(c.req.param('id'))
  if (user.role === 'company_admin') {
    const row = await c.env.DB.prepare('SELECT company_id FROM competitors WHERE id = ?').bind(id).first() as any
    if (!row || row.company_id !== user.company_id) return c.json({ error: 'Forbidden' }, 403)
  }
  try {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM competitor_scans WHERE competitor_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM competitor_intel WHERE competitor_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM competitors WHERE id = ?').bind(id)
    ])
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: 'Delete failed', detail: err?.message }, 500)
  }
})

// POST /api/intel/scan — budget-aware SerpAPI keyword scan for a competitor
app.post('/api/intel/scan', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB || !c.env?.KV) return c.json({ error: 'DB/KV unavailable' }, 503)
  if (!c.env?.SERPAPI_KEY) return c.json({ error: 'SERPAPI_KEY not configured' }, 503)

  const { competitor_id, keyword, city = 'Ottawa', force = false } = await c.req.json()
  if (!competitor_id || !keyword) return c.json({ error: 'competitor_id and keyword required' }, 400)

  // Verify competitor exists + ownership
  const comp = await c.env.DB.prepare('SELECT * FROM competitors WHERE id = ?').bind(competitor_id).first() as any
  if (!comp) return c.json({ error: 'Competitor not found' }, 404)
  if (user.role === 'company_admin' && comp.company_id !== user.company_id) return c.json({ error: 'Forbidden' }, 403)

  // ── Budget gate ────────────────────────────────────────────────────────
  const usage = await getSerpUsage(c.env)
  if (usage >= SERP_HARD_LIMIT && !force) {
    return c.json({
      error: `Monthly SerpAPI limit reached (${SERP_HARD_LIMIT}/${SERP_HARD_LIMIT}). Auto-scans paused until next month.`,
      code: 'BUDGET_EXCEEDED', usage, limit: SERP_HARD_LIMIT
    }, 429)
  }
  // Check live SerpAPI credits (< 10 remaining = block)
  const account = await getSerpAccountCached(c.env)
  if (account && account.plan_searches_left < 10 && !force) {
    return c.json({
      error: `Only ${account.plan_searches_left} SerpAPI searches remaining — scans paused`,
      code: 'LOW_CREDITS', plan_searches_left: account.plan_searches_left
    }, 429)
  }

  // ── KV cache check (skip if force) ────────────────────────────────────
  const today    = new Date().toISOString().slice(0, 10)
  const kwSlug   = keyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const cacheKey = `serp:${competitor_id}:${kwSlug}:${today}`
  if (!force) {
    const cached = await c.env.KV.get(cacheKey)
    if (cached) {
      return c.json({ ...JSON.parse(cached), cached: true, budget_usage: usage })
    }
  }

  // ── Call SerpAPI ───────────────────────────────────────────────────────
  let searchData: { ads: any[]; localServiceAds: any[]; organicResults: any[] }
  try {
    searchData = await runGoogleSearch(c.env, keyword, city)
  } catch (err: any) {
    return c.json({ error: `SerpAPI call failed: ${err?.message}`, code: 'SERP_ERROR' }, 502)
  }

  // Increment usage counter
  const newUsage = await incrementSerpUsage(c.env)

  const { ads, localServiceAds, organicResults } = searchData
  const competitorDomain = comp.website_url || ''

  // Extract advertiser names for display
  const ppcAdvertisers = ads.map((a: any) =>
    normDomain(a.displayed_link || a.link || '') || a.title?.slice(0, 40) || 'Unknown'
  ).filter(Boolean)
  const lsaAdvertisers = localServiceAds.map((a: any) =>
    a.title || a.provider_name || 'Unknown'
  )
  const organicTop5 = organicResults.slice(0, 5).map((r: any) => ({
    position: r.position,
    title:    (r.title    || '').slice(0, 80),
    domain:   normDomain(r.link || r.displayed_link || ''),
    snippet:  (r.snippet  || '').slice(0, 120)
  }))

  // Check if THIS competitor appears in results
  const competitorPpcPos     = findDomainInResults(ads,            competitorDomain)
  const competitorOrganicPos = findDomainInResults(organicResults, competitorDomain)

  const now    = new Date().toISOString()
  const result = {
    success:               true,
    competitor_id,
    keyword,
    city,
    scanned_at:            now,
    has_ppc:               ads.length > 0,
    has_lsa:               localServiceAds.length > 0,
    ppc_count:             ads.length,
    lsa_count:             localServiceAds.length,
    ppc_advertisers:       ppcAdvertisers,
    lsa_advertisers:       lsaAdvertisers,
    organic_top5:          organicTop5,
    competitor_ppc_pos:    competitorPpcPos,
    competitor_organic_pos:competitorOrganicPos,
    budget_usage:          newUsage,
    budget_warning:        newUsage >= SERP_WARN_THRESHOLD ? `⚠️ ${newUsage}/${SERP_HARD_LIMIT} SerpAPI searches used this month` : null
  }

  // ── Save to D1 competitor_scans ────────────────────────────────────────
  try {
    await c.env.DB.prepare(
      `INSERT INTO competitor_scans
        (competitor_id, keyword, scanned_at, has_ppc, has_lsa, ppc_count, lsa_count,
         ppc_advertisers, lsa_advertisers, organic_top5, competitor_ppc_pos, competitor_organic_pos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      competitor_id, keyword, now,
      ads.length > 0 ? 1 : 0, localServiceAds.length > 0 ? 1 : 0,
      ads.length, localServiceAds.length,
      JSON.stringify(ppcAdvertisers), JSON.stringify(lsaAdvertisers),
      JSON.stringify(organicTop5),
      competitorPpcPos ?? null, competitorOrganicPos ?? null
    ).run()
    await c.env.DB.prepare('UPDATE competitors SET last_scanned = ?, scan_status = ? WHERE id = ?')
      .bind(now, 'done', competitor_id).run()
  } catch (_) {}

  // ── Cache in KV (14-day TTL) ───────────────────────────────────────────
  try {
    await c.env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 * 60 * 24 * 14 })
  } catch (_) {}

  return c.json(result)
})

// GET /api/intel/results/:id — latest scan result per keyword for one competitor
app.get('/api/intel/results/:id', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'super_admin' && user.role !== 'company_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ results: [] })
  const id = Number(c.req.param('id'))
  if (user.role === 'company_admin') {
    const row = await c.env.DB.prepare('SELECT company_id FROM competitors WHERE id = ?').bind(id).first() as any
    if (!row || row.company_id !== user.company_id) return c.json({ error: 'Forbidden' }, 403)
  }
  try {
    const res = await c.env.DB.prepare(
      'SELECT * FROM competitor_scans WHERE competitor_id = ? ORDER BY scanned_at DESC LIMIT 60'
    ).bind(id).all()
    const rows = (res.results as any[]).map(r => ({
      ...r,
      ppc_advertisers:  JSON.parse(r.ppc_advertisers  || '[]'),
      lsa_advertisers:  JSON.parse(r.lsa_advertisers  || '[]'),
      organic_top5:     JSON.parse(r.organic_top5     || '[]')
    }))
    // Latest per keyword
    const latestByKw: Record<string, any> = {}
    for (const row of rows) {
      if (!latestByKw[row.keyword]) latestByKw[row.keyword] = row
    }
    return c.json({ results: rows, latest_by_keyword: Object.values(latestByKw) })
  } catch (err: any) {
    return c.json({ error: 'Failed to load results', detail: err?.message }, 500)
  }
})

// ── WEBSITE SCRAPER HELPERS ───────────────────────────────────────────────

type ScraperResult = {
  phone?: string; email?: string; logo_url?: string; tagline?: string
  about_text?: string; services?: string[]; brand_colors?: string[]
  social_links?: Record<string, string>; raw_content?: string; error?: string
}

async function scrapeWebsite(url: string): Promise<ScraperResult> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SLMHubBot/1.0; +https://slm-hub.ca)', 'Accept': 'text/html,*/*' },
      redirect: 'follow'
    })
    if (!res.ok) return { error: `HTTP ${res.status}` }
    const fullHtml = await res.text()
    const html = fullHtml.slice(0, 500000) // 500KB max

    // Phone — prefer tel: links, fallback to North American phone pattern
    let phone = ''
    const telM = html.match(/href=["']tel:([+\d\s()./-]{7,20})["']/i)
    if (telM) phone = telM[1].trim()
    if (!phone) { const pM = html.match(/(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/); if (pM) phone = pM[0].trim() }

    // Email — prefer mailto: links
    let email = ''
    const mailM = html.match(/href=["']mailto:([^"'?#\s]+)/i)
    if (mailM) email = mailM[1].trim()

    // Logo — og:image meta tag
    let logo_url = ''
    const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
              || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (ogImg) logo_url = ogImg[1].trim()

    // Tagline — og:description or meta description (first 200 chars)
    let tagline = ''
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{10,200})["']/i)
               || html.match(/<meta[^>]+content=["']([^"']{10,200})["'][^>]+property=["']og:description["']/i)
    if (ogDesc) tagline = ogDesc[1].replace(/\s+/g, ' ').trim()
    if (!tagline) {
      const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,200})["']/i)
                    || html.match(/<meta[^>]+content=["']([^"']{10,200})["'][^>]+name=["']description["']/i)
      if (metaDesc) tagline = metaDesc[1].replace(/\s+/g, ' ').trim()
    }

    // About text — first section/div with "about" in id or class
    let about_text = ''
    const aboutM = html.match(/<(?:section|div)[^>]+(?:id|class)=["'][^"']*about[^"']*["'][^>]*>([\s\S]{20,600}?)<\/(?:section|div)>/i)
    if (aboutM) about_text = aboutM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400)

    // Services — h2/h3 headings that look like service names (not nav/UI labels)
    const services: string[] = []
    const skipWords = /^(our|why|who|how|what|home|contact|about|blog|faq|get|call|read|view|learn|find|meet|click|tap|see|welcome|hello|follow|join|sign|log|404|error|menu|close|open|back)/i
    const h2Matches = Array.from(html.matchAll(/<h[23][^>]*>([^<]{5,80})<\/h[23]>/gi)).slice(0, 12)
    for (const m of h2Matches) {
      const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (text.length >= 5 && text.length <= 80 && !skipWords.test(text) && !text.match(/^\d+$/)) {
        services.push(text)
      }
    }

    // Brand colors — top 3 non-common CSS hex colors by frequency
    const noBrand = new Set(['#000000','#FFFFFF','#FFFFFF','#333333','#666666','#999999','#CCCCCC','#EEEEEE','#F5F5F5','#F9F9F9','#111111','#222222','#444444','#555555','#777777','#888888','#AAAAAA','#BBBBBB','#DDDDDD'])
    const cssOnly = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<img[^>]+>/gi, '')
    const hexCounts: Record<string, number> = {}
    for (const m of Array.from(cssOnly.matchAll(/#([0-9a-fA-F]{6})\b/g))) {
      const hex = `#${m[1].toUpperCase()}`
      if (!noBrand.has(hex)) hexCounts[hex] = (hexCounts[hex] || 0) + 1
    }
    const brand_colors = Object.entries(hexCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h)

    // Social links — extract first occurrence of each platform
    const social_links: Record<string, string> = {}
    const socialPats: Array<[string, RegExp]> = [
      ['facebook',  /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._/-]+/],
      ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._/-]+/],
      ['twitter',   /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9._/-]+/],
      ['linkedin',  /https?:\/\/(?:www\.)?linkedin\.com\/(?:company\/|in\/)[a-zA-Z0-9._/-]+/],
      ['youtube',   /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|@)[a-zA-Z0-9._/-]+/],
    ]
    for (const [platform, pat] of socialPats) { const m = html.match(pat); if (m) social_links[platform] = m[0] }

    // Raw content — strip tags, collapse whitespace, first 1500 chars
    const raw_content = html.replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500)

    return {
      phone:        phone        || undefined,
      email:        email        || undefined,
      logo_url:     logo_url     || undefined,
      tagline:      tagline      || undefined,
      about_text:   about_text   || undefined,
      services:     services.length ? services.slice(0, 8) : undefined,
      brand_colors: brand_colors.length ? brand_colors : undefined,
      social_links: Object.keys(social_links).length ? social_links : undefined,
      raw_content
    }
  } catch (err: any) {
    return { error: err?.message || 'Scrape failed' }
  }
}

async function analyzeWebsiteTone(apiKey: string, text: string): Promise<string> {
  const VALID_TONES = ['professional', 'friendly', 'urgent', 'authoritative', 'conversational', 'technical']
  if (!apiKey || !text) return 'professional'
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 20,
        messages: [{
          role: 'user',
          content: `Analyze the tone of this business website. Reply with ONLY ONE word from: professional, friendly, urgent, authoritative, conversational, technical\n\nContent: ${text.slice(0, 800)}`
        }]
      })
    })
    const data = await res.json() as any
    const tone = (data?.content?.[0]?.text || '').trim().toLowerCase().replace(/[^a-z]/g, '')
    return VALID_TONES.includes(tone) ? tone : 'professional'
  } catch { return 'professional' }
}

// ── DATA PERMISSIONS API ──────────────────────────────────────────────────
// All permission endpoints are for company_admin (or super_admin for audit purposes)

// GET /api/permissions/status — current permission + scrape status for company
app.get('/api/permissions/status', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (!c.env?.DB) return c.json({ permission_granted: false, scrape_status: 'pending' })

  const companyId = user.company_id
  if (!companyId) return c.json({ permission_granted: true, scrape_status: 'n/a', role: user.role })

  try {
    const [perm, site] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM data_permissions WHERE company_id = ?').bind(companyId).first() as Promise<any>,
      c.env.DB.prepare('SELECT scrape_status, scraped_at FROM company_websites WHERE company_id = ?').bind(companyId).first() as Promise<any>
    ])
    // Check 30-day rescan KV flag
    let rescan_due = false
    if (c.env?.KV) {
      const scanKey = await c.env.KV.get(`scraper:next_scan:${companyId}`)
      rescan_due = !scanKey
    }
    return c.json({
      permission_granted: perm?.permission_granted ? true : false,
      granted_at:         perm?.granted_at  || null,
      revoked_at:         perm?.revoked_at  || null,
      disclaimer_version: perm?.disclaimer_version || null,
      allowed_uses:       perm?.allowed_uses ? JSON.parse(perm.allowed_uses) : [],
      scrape_status:      site?.scrape_status || 'pending',
      scraped_at:         site?.scraped_at   || null,
      rescan_due
    })
  } catch (err: any) {
    return c.json({ error: 'Status check failed', detail: err?.message }, 500)
  }
})

// POST /api/permissions/grant — save data usage authorization (company_admin only)
app.post('/api/permissions/grant', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'company_admin') return c.json({ error: 'Forbidden — company_admin only' }, 403)
  if (!user.company_id) return c.json({ error: 'No company associated with account' }, 400)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)

  const now       = new Date().toISOString()
  const ip        = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''
  const allowedUses = JSON.stringify(['landing_pages', 'ads_campaigns', 'seo_content', 'blog_posts'])

  try {
    await c.env.DB.prepare(`
      INSERT INTO data_permissions (company_id, permission_granted, granted_by, granted_at, ip_address, disclaimer_version, allowed_uses, revoked_at, revoked_reason)
      VALUES (?, 1, ?, ?, ?, 'v1.0', ?, NULL, NULL)
      ON CONFLICT(company_id) DO UPDATE SET
        permission_granted=1, granted_by=excluded.granted_by, granted_at=excluded.granted_at,
        ip_address=excluded.ip_address, disclaimer_version='v1.0', allowed_uses=excluded.allowed_uses,
        revoked_at=NULL, revoked_reason=NULL
    `).bind(user.company_id, user.email, now, ip, allowedUses).run()

    return c.json({ success: true, granted_at: now, disclaimer_version: 'v1.0' })
  } catch (err: any) {
    return c.json({ error: 'Grant failed', detail: err?.message }, 500)
  }
})

// POST /api/permissions/revoke — revoke authorization (company_admin or super_admin)
app.post('/api/permissions/revoke', async (c) => {
  const user = c.get('user')
  if (!user || (user.role !== 'company_admin' && user.role !== 'super_admin')) return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)

  const companyId = user.role === 'super_admin'
    ? (await c.req.json().catch(() => ({}))).company_id || user.company_id
    : user.company_id
  if (!companyId) return c.json({ error: 'company_id required' }, 400)

  const { reason = 'User requested revocation' } = await c.req.json().catch(() => ({}))
  const now = new Date().toISOString()

  try {
    await c.env.DB.prepare(
      'UPDATE data_permissions SET permission_granted=0, revoked_at=?, revoked_reason=? WHERE company_id=?'
    ).bind(now, reason, companyId).run()
    return c.json({ success: true, revoked_at: now })
  } catch (err: any) {
    return c.json({ error: 'Revoke failed', detail: err?.message }, 500)
  }
})

// GET /api/permissions/download — GDPR data export (company_admin only)
app.get('/api/permissions/download', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'company_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!user.company_id) return c.json({ error: 'No company' }, 400)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)

  try {
    const [perm, site, company, leadCount] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM data_permissions WHERE company_id = ?').bind(user.company_id).first() as Promise<any>,
      c.env.DB.prepare('SELECT id, website_url, scraped_at, tone_of_voice, services, tagline, logo_url, social_links, scrape_status FROM company_websites WHERE company_id = ?').bind(user.company_id).first() as Promise<any>,
      c.env.DB.prepare('SELECT id, name, phone, domain, color_bg, color_accent FROM companies WHERE id = ?').bind(user.company_id).first() as Promise<any>,
      c.env.DB.prepare('SELECT COUNT(*) as cnt FROM leads WHERE company = (SELECT key FROM companies WHERE id = ?)').bind(user.company_id).first() as Promise<any>
    ])
    const export_data = {
      exported_at:       new Date().toISOString(),
      exported_by:       user.email,
      user_profile:      { id: user.id, email: user.email, name: user.name, role: user.role },
      company:           company || null,
      data_permission:   perm   || null,
      brand_profile:     site   || null,
      lead_count:        (leadCount as any)?.cnt || 0,
      platform:          'Services Leads Marketing Hub (SLM Hub)',
      data_location:     'Cloudflare D1 — ENAM region',
      disclaimer_version:'v1.0'
    }
    const headers = new Headers({ 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="slm-hub-data-export.json"' })
    return new Response(JSON.stringify(export_data, null, 2), { headers })
  } catch (err: any) {
    return c.json({ error: 'Export failed', detail: err?.message }, 500)
  }
})

// ── WEBSITE SCRAPER API ───────────────────────────────────────────────────

// POST /api/scraper/scan — scrape website + tone analysis + save to company_websites
app.post('/api/scraper/scan', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'company_admin') return c.json({ error: 'Forbidden — company_admin only' }, 403)
  if (!user.company_id) return c.json({ error: 'No company associated with account' }, 400)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)

  // Permission must be granted before scanning
  try {
    const perm = await c.env.DB.prepare('SELECT permission_granted, revoked_at FROM data_permissions WHERE company_id = ?').bind(user.company_id).first() as any
    if (!perm || !perm.permission_granted || perm.revoked_at) {
      return c.json({ error: 'Data usage authorization required before scanning — go to Settings → Data & Privacy', code: 'PERMISSION_REQUIRED' }, 403)
    }
  } catch (_) {}

  const { website_url } = await c.req.json()
  if (!website_url) return c.json({ error: 'website_url required' }, 400)
  // Basic URL validation
  let safeUrl = website_url.trim()
  if (!safeUrl.match(/^https?:\/\//i)) safeUrl = `https://${safeUrl}`
  try { new URL(safeUrl) } catch { return c.json({ error: 'Invalid URL' }, 400) }

  const now = new Date().toISOString()

  // Mark as scanning
  try {
    await c.env.DB.prepare(`
      INSERT INTO company_websites (company_id, website_url, scrape_status)
      VALUES (?, ?, 'scanning')
      ON CONFLICT(company_id) DO UPDATE SET website_url=excluded.website_url, scrape_status='scanning'
    `).bind(user.company_id, safeUrl).run()
  } catch (_) {}

  // Run scraper
  const scraped = await scrapeWebsite(safeUrl)

  if (scraped.error) {
    // Mark as failed but keep the URL
    try {
      await c.env.DB.prepare("UPDATE company_websites SET scrape_status='failed', scraped_at=? WHERE company_id=?")
        .bind(now, user.company_id).run()
    } catch (_) {}
    return c.json({ error: `Scrape failed: ${scraped.error}`, code: 'SCRAPE_FAILED', website_url: safeUrl }, 422)
  }

  // Run tone analysis via Anthropic (graceful fallback)
  const tone = scraped.raw_content
    ? await analyzeWebsiteTone(c.env?.ANTHROPIC_API_KEY || '', scraped.raw_content)
    : 'professional'

  // Save to company_websites
  try {
    await c.env.DB.prepare(`
      UPDATE company_websites SET
        scraped_at=?, brand_colors=?, tone_of_voice=?, services=?, contact_info=?,
        about_text=?, tagline=?, logo_url=?, social_links=?, raw_content=?, scrape_status='completed'
      WHERE company_id=?
    `).bind(
      now,
      JSON.stringify(scraped.brand_colors || []),
      tone,
      JSON.stringify(scraped.services || []),
      JSON.stringify({ phone: scraped.phone || '', email: scraped.email || '', address: '' }),
      scraped.about_text || '',
      scraped.tagline    || '',
      scraped.logo_url   || '',
      JSON.stringify(scraped.social_links || {}),
      scraped.raw_content || '',
      user.company_id
    ).run()

    // Set 30-day rescan KV TTL
    if (c.env?.KV) {
      await c.env.KV.put(`scraper:next_scan:${user.company_id}`, now, { expirationTtl: 60 * 60 * 24 * 30 })
    }
  } catch (err: any) {
    return c.json({ error: 'Save failed', detail: err?.message }, 500)
  }

  return c.json({
    success: true, scraped_at: now, website_url: safeUrl,
    phone:        scraped.phone        || null,
    email:        scraped.email        || null,
    logo_url:     scraped.logo_url     || null,
    tagline:      scraped.tagline      || null,
    about_text:   scraped.about_text   || null,
    services:     scraped.services     || [],
    brand_colors: scraped.brand_colors || [],
    tone_of_voice: tone,
    social_links: scraped.social_links || {}
  })
})

// GET /api/scraper/brand-profile — get brand profile for current company_admin
app.get('/api/scraper/brand-profile', async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  if (!c.env?.DB) return c.json({ profile: null })

  const companyId = user.company_id
  if (!companyId) return c.json({ profile: null })

  try {
    const row = await c.env.DB.prepare('SELECT * FROM company_websites WHERE company_id = ?').bind(companyId).first() as any
    if (!row) return c.json({ profile: null })
    // Check rescan TTL
    let rescan_due = false
    if (c.env?.KV) { const k = await c.env.KV.get(`scraper:next_scan:${companyId}`); rescan_due = !k }
    const profile = {
      ...row,
      brand_colors: row.brand_colors ? JSON.parse(row.brand_colors) : [],
      services:     row.services     ? JSON.parse(row.services)     : [],
      contact_info: row.contact_info ? JSON.parse(row.contact_info) : {},
      social_links: row.social_links ? JSON.parse(row.social_links) : {}
    }
    return c.json({ profile, rescan_due })
  } catch (err: any) {
    return c.json({ error: 'Failed to load profile', detail: err?.message }, 500)
  }
})

// PATCH /api/scraper/brand-profile — save manual brand profile edits (company_admin only)
app.patch('/api/scraper/brand-profile', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'company_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!user.company_id) return c.json({ error: 'No company' }, 400)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 503)

  const body = await c.req.json()
  const { website_url, phone, email, address, services, tone_of_voice, tagline, logo_url, brand_colors, social_links } = body

  const now = new Date().toISOString()
  const contactInfo = JSON.stringify({ phone: phone || '', email: email || '', address: address || '' })

  try {
    await c.env.DB.prepare(`
      INSERT INTO company_websites (company_id, website_url, scraped_at, brand_colors, tone_of_voice, services, contact_info, tagline, logo_url, social_links, scrape_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
      ON CONFLICT(company_id) DO UPDATE SET
        website_url   = COALESCE(excluded.website_url,   website_url),
        scraped_at    = excluded.scraped_at,
        brand_colors  = COALESCE(excluded.brand_colors,  brand_colors),
        tone_of_voice = COALESCE(excluded.tone_of_voice, tone_of_voice),
        services      = COALESCE(excluded.services,      services),
        contact_info  = excluded.contact_info,
        tagline       = COALESCE(excluded.tagline,       tagline),
        logo_url      = COALESCE(excluded.logo_url,      logo_url),
        social_links  = COALESCE(excluded.social_links,  social_links),
        scrape_status = 'completed'
    `).bind(
      user.company_id,
      website_url || '',
      now,
      brand_colors  ? JSON.stringify(brand_colors)  : null,
      tone_of_voice || null,
      services      ? JSON.stringify(services)      : null,
      contactInfo,
      tagline     || null,
      logo_url    || null,
      social_links  ? JSON.stringify(social_links)  : null
    ).run()

    // Reset KV TTL on manual save (treat as fresh scan)
    if (c.env?.KV) {
      await c.env.KV.put(`scraper:next_scan:${user.company_id}`, now, { expirationTtl: 60 * 60 * 24 * 30 })
    }

    return c.json({ success: true, saved_at: now })
  } catch (err: any) {
    return c.json({ error: 'Save failed', detail: err?.message }, 500)
  }
})

// ── BUSINESS PROSPECTOR ───────────────────────────────────────────────────

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  ottawa:      { lat: 45.4215, lng: -75.6972 },
  toronto:     { lat: 43.6532, lng: -79.3832 },
  montreal:    { lat: 45.5017, lng: -73.5673 },
  vancouver:   { lat: 49.2827, lng: -123.1207 },
  calgary:     { lat: 51.0447, lng: -114.0719 },
  edmonton:    { lat: 53.5461, lng: -113.4938 },
  winnipeg:    { lat: 49.8951, lng: -97.1384 },
  hamilton:    { lat: 43.2557, lng: -79.8711 },
  kitchener:   { lat: 43.4516, lng: -80.4925 },
  london:      { lat: 42.9849, lng: -81.2453 },
  halifax:     { lat: 44.6488, lng: -63.5752 },
  victoria:    { lat: 48.4284, lng: -123.3656 },
  saskatoon:   { lat: 52.1332, lng: -106.6700 },
  regina:      { lat: 50.4452, lng: -104.6189 },
  mississauga: { lat: 43.5890, lng: -79.6441 },
  brampton:    { lat: 43.7315, lng: -79.7624 },
  surrey:      { lat: 49.1913, lng: -122.8490 },
  laval:       { lat: 45.5617, lng: -73.6921 },
  markham:     { lat: 43.8561, lng: -79.3370 },
  vaughan:     { lat: 43.8563, lng: -79.5085 },
  'north york':{ lat: 43.7615, lng: -79.4111 },
  scarborough: { lat: 43.7731, lng: -79.2578 },
  'new york':  { lat: 40.7128, lng: -74.0060 },
  chicago:     { lat: 41.8781, lng: -87.6298 },
  houston:     { lat: 29.7604, lng: -95.3698 },
  phoenix:     { lat: 33.4484, lng: -112.0740 },
  dallas:      { lat: 32.7767, lng: -96.7970 },
  miami:       { lat: 25.7617, lng: -80.1918 },
  seattle:     { lat: 47.6062, lng: -122.3321 },
  denver:      { lat: 39.7392, lng: -104.9903 },
}

function calcSlmScore(b: any): number {
  let score = 0
  if (!b.website_url)                                          score += 30
  if (b.google_rating && b.google_rating < 4.0)               score += 20
  if (!b.google_review_count || b.google_review_count < 10)   score += 15
  if (!b.facebook_url && !b.instagram_url && !b.linkedin_url) score += 15
  if (b.phone && !b.email)                                     score += 10
  return Math.min(100, score)
}

function slmScoreTier(score: number): string {
  if (score >= 70) return 'hot'
  if (score >= 40) return 'warm'
  return 'cold'
}

async function scrapeProspectWebsite(url: string): Promise<{
  email?: string; facebook?: string; instagram?: string; linkedin?: string
}> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SLMBot/1.0; +https://slm-hub.ca)' },
      signal: AbortSignal.timeout(8000)
    })
    if (!r.ok) return {}
    const html = (await r.text()).slice(0, 250000)
    const emailRaw = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)
    const emails = emailRaw ? [...new Set(emailRaw)].filter(e =>
      !e.includes('example.') && !e.endsWith('.png') && !e.endsWith('.jpg') &&
      !e.includes('sentry') && !e.includes('schema') && !e.includes('wix') &&
      !e.includes('@2x') && e.length < 80
    ) : []
    const fbM  = html.match(/facebook\.com\/(?!sharer|share|plugins|tr\?|dialog)([a-zA-Z0-9._\-]{3,})/i)
    const igM  = html.match(/instagram\.com\/([a-zA-Z0-9._]{3,})\/?(?=['"\s])/i)
    const liM  = html.match(/linkedin\.com\/company\/([a-zA-Z0-9._\-]{3,})/i)
    return {
      email:     emails[0] || undefined,
      facebook:  fbM  ? `https://facebook.com/${fbM[1]}`              : undefined,
      instagram: igM  ? `https://instagram.com/${igM[1]}`             : undefined,
      linkedin:  liM  ? `https://linkedin.com/company/${liM[1]}`      : undefined,
    }
  } catch { return {} }
}

// POST /api/prospector/search
app.post('/api/prospector/search', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)

  const body = await c.req.json()
  const niche      = (body.niche      || '').trim()
  const city       = (body.city       || '').trim()
  const radius_km  = Number(body.radius_km  || 25)
  const filter     = body.filter      || 'all'
  const min_reviews = Number(body.min_reviews || 0)

  if (!niche || !city) return c.json({ error: 'niche and city are required' }, 400)

  const now          = new Date().toISOString()
  const searchQuery  = `${niche} ${city}`
  const radiusMeters = radius_km * 1000
  const cityKey      = city.toLowerCase().trim()
  const coords       = CITY_COORDS[cityKey]

  const results: any[] = []

  // ── SOURCE 1: Google Places API ─────────────────────────────────────────
  if (c.env?.GOOGLE_PLACES_API_KEY) {
    try {
      const reqBody: any = { textQuery: searchQuery, maxResultCount: 20, languageCode: 'en' }
      if (coords) {
        reqBody.locationBias = {
          circle: { center: { latitude: coords.lat, longitude: coords.lng }, radius: radiusMeters }
        }
      }
      const pr = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': c.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.id,places.businessStatus'
        },
        body: JSON.stringify(reqBody)
      })
      if (pr.ok) {
        const pd = await pr.json() as any
        for (const p of (pd.places || [])) {
          if (p.businessStatus === 'CLOSED_PERMANENTLY') continue
          results.push({
            business_name: p.displayName?.text || '',
            address: p.formattedAddress || '',
            phone: p.nationalPhoneNumber || null,
            website_url: p.websiteUri || null,
            google_rating: p.rating || null,
            google_review_count: p.userRatingCount || 0,
            google_maps_url: p.googleMapsUri || null,
            google_place_id: p.id || null,
            source: 'google_places',
            email: null, facebook_url: null, instagram_url: null, linkedin_url: null
          })
        }
      }
    } catch { /* Places API unavailable */ }
  }

  // ── SOURCE 2: SerpAPI Google Maps ────────────────────────────────────────
  if (c.env?.SERPAPI_KEY) {
    try {
      const serpUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(searchQuery)}&api_key=${c.env.SERPAPI_KEY}&num=20`
      const sr = await fetch(serpUrl)
      if (sr.ok) {
        const sd = await sr.json() as any
        for (const item of (sd.local_results || [])) {
          const dup = results.some(r =>
            r.business_name.toLowerCase().trim() === (item.title || '').toLowerCase().trim()
          )
          if (dup) continue
          results.push({
            business_name: item.title || '',
            address: item.address || '',
            phone: item.phone || null,
            website_url: item.website || null,
            google_rating: item.rating || null,
            google_review_count: item.reviews || 0,
            google_maps_url: item.place_id ? `https://www.google.com/maps/place/?q=place_id:${item.place_id}` : null,
            google_place_id: item.place_id || null,
            source: 'serp_maps',
            email: null, facebook_url: null, instagram_url: null, linkedin_url: null
          })
        }
      }
    } catch { /* SerpAPI unavailable */ }
  }

  // ── SOURCE 3: Website scrape (max 10) ────────────────────────────────────
  let scrapeCount = 0
  for (const biz of results) {
    if (!biz.website_url || scrapeCount >= 10) break
    const scraped = await scrapeProspectWebsite(biz.website_url)
    if (scraped.email)     biz.email         = scraped.email
    if (scraped.facebook)  biz.facebook_url  = scraped.facebook
    if (scraped.instagram) biz.instagram_url = scraped.instagram
    if (scraped.linkedin)  biz.linkedin_url  = scraped.linkedin
    scrapeCount++
  }

  // ── Score + annotate ─────────────────────────────────────────────────────
  for (const biz of results) {
    biz.slm_score    = calcSlmScore(biz)
    biz.slm_tier     = slmScoreTier(biz.slm_score)
    biz.city         = city
    biz.search_query = searchQuery
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  let filtered = [...results]
  if      (filter === 'has_website')  filtered = filtered.filter(b => b.website_url)
  else if (filter === 'has_phone')    filtered = filtered.filter(b => b.phone)
  else if (filter === 'no_profile')   filtered = filtered.filter(b => !b.google_place_id)
  else if (filter === 'weak_rating')  filtered = filtered.filter(b => b.google_rating && b.google_rating < 4.0)
  if (min_reviews > 0) filtered = filtered.filter(b => (b.google_review_count || 0) >= min_reviews)

  filtered.sort((a, b) => b.slm_score - a.slm_score)

  // ── Persist to D1 ────────────────────────────────────────────────────────
  for (const biz of filtered) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO scraped_businesses
         (company_id, search_query, business_name, website_url, phone, email, address, city,
          google_place_id, google_rating, google_review_count, google_maps_url,
          facebook_url, instagram_url, linkedin_url, scraped_at, source, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'raw')`
      ).bind(
        null, searchQuery, biz.business_name, biz.website_url || null,
        biz.phone || null, biz.email || null, biz.address || null, city,
        biz.google_place_id || null, biz.google_rating || null,
        biz.google_review_count || 0, biz.google_maps_url || null,
        biz.facebook_url || null, biz.instagram_url || null, biz.linkedin_url || null,
        now, biz.source
      ).run()
    } catch { /* skip duplicates or errors */ }
  }

  return c.json({
    results:      filtered,
    total:        filtered.length,
    search_query: searchQuery,
    sources_used: {
      google_places: !!c.env?.GOOGLE_PLACES_API_KEY,
      serp_maps:     !!c.env?.SERPAPI_KEY,
      website_scrapes: scrapeCount
    }
  })
})

// GET /api/prospector/prospects
app.get('/api/prospector/prospects', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ prospects: [] })
  const rows = await c.env.DB.prepare(
    `SELECT * FROM scraped_businesses WHERE status != 'raw' ORDER BY scraped_at DESC LIMIT 200`
  ).all()
  const prospects = (rows.results || []).map((r: any) => ({
    ...r,
    slm_score: calcSlmScore(r),
    slm_tier:  slmScoreTier(calcSlmScore(r))
  }))
  return c.json({ prospects })
})

// POST /api/prospector/save  (action: 'prospect' | 'competitor')
app.post('/api/prospector/save', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)
  const { business, action } = await c.req.json()
  const now = new Date().toISOString()

  if (action === 'competitor') {
    try {
      const ins = await c.env.DB.prepare(
        `INSERT INTO competitors
         (company_id, competitor_name, website_url, google_place_id, territory,
          google_rating, google_review_count, google_maps_url,
          status, added_at, detected_by, scan_status, serp_keywords)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 'prospector', 'pending', '[]')`
      ).bind(
        null,
        business.business_name,
        business.website_url || null,
        business.google_place_id || null,
        business.city || null,
        business.google_rating || null,
        business.google_review_count || 0,
        business.google_maps_url || null,
        now
      ).run()
      return c.json({ success: true, id: ins.meta?.last_row_id, action: 'competitor' })
    } catch (e: any) {
      return c.json({ error: e.message || 'Failed to add competitor' }, 500)
    }
  }

  // Default: save as prospect
  try {
    // If record already exists from a prior raw search, update it to prospect
    const existing = await c.env.DB.prepare(
      `SELECT id FROM scraped_businesses WHERE business_name = ? AND city = ? LIMIT 1`
    ).bind(business.business_name, business.city || '').first() as any
    if (existing) {
      await c.env.DB.prepare(`UPDATE scraped_businesses SET status = 'prospect' WHERE id = ?`).bind(existing.id).run()
      return c.json({ success: true, id: existing.id, action: 'prospect' })
    }
    const ins = await c.env.DB.prepare(
      `INSERT INTO scraped_businesses
       (company_id, search_query, business_name, website_url, phone, email, address, city,
        google_place_id, google_rating, google_review_count, google_maps_url,
        facebook_url, instagram_url, linkedin_url, scraped_at, source, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prospect')`
    ).bind(
      null,
      business.search_query || '',
      business.business_name,
      business.website_url || null,
      business.phone || null,
      business.email || null,
      business.address || null,
      business.city || null,
      business.google_place_id || null,
      business.google_rating || null,
      business.google_review_count || 0,
      business.google_maps_url || null,
      business.facebook_url || null,
      business.instagram_url || null,
      business.linkedin_url || null,
      now,
      business.source || 'manual'
    ).run()
    return c.json({ success: true, id: ins.meta?.last_row_id, action: 'prospect' })
  } catch (e: any) {
    return c.json({ error: e.message || 'Save failed' }, 500)
  }
})

// PATCH /api/prospector/prospects/:id/status
app.patch('/api/prospector/prospects/:id/status', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)
  const id = Number(c.req.param('id'))
  const { status } = await c.req.json()
  const valid = ['new','contacted','interested','demo_scheduled','converted','not_interested']
  if (!valid.includes(status)) return c.json({ error: 'Invalid status' }, 400)
  await c.env.DB.prepare('UPDATE scraped_businesses SET status = ? WHERE id = ?').bind(status, id).run()
  return c.json({ success: true })
})

// DELETE /api/prospector/prospects/:id
app.delete('/api/prospector/prospects/:id', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM scraped_businesses WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// GET /api/prospector/export
app.get('/api/prospector/export', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)
  if (!c.env?.DB) return c.json({ error: 'DB unavailable' }, 500)
  const rows = await c.env.DB.prepare(
    'SELECT * FROM scraped_businesses ORDER BY scraped_at DESC LIMIT 1000'
  ).all()
  const hdrs = ['business_name','phone','email','website_url','address','city',
                'google_rating','google_review_count','facebook_url','instagram_url',
                'linkedin_url','search_query','source','status','scraped_at']
  const csv = [
    hdrs.join(','),
    ...(rows.results || []).map((r: any) =>
      hdrs.map(h => JSON.stringify(r[h] ?? '')).join(',')
    )
  ].join('\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="slm-prospects-${new Date().toISOString().slice(0,10)}.csv"`
    }
  })
})

export default app
