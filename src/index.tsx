import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { APP_HTML, SERVICE_LEADS_HTML, LOGIN_HTML } from './pages'

type Bindings = {
  KV: KVNamespace
  DB: D1Database
  PORKBUN_API_KEY: string
  PORKBUN_SECRET_KEY: string
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
  company: CompanyData, mode: 'ppc' | 'seo' = 'seo'
): string {
  const year   = new Date().getFullYear()
  const phone  = company.phone || ''
  const pd     = phone.replace(/[^0-9]/g, '')
  const bg     = company.color_bg || '#1A1A2E'
  const accent = company.color_accent || '#CC0000'
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
  const reviews  = getLPReviews(niche)
  const extLinks = mode === 'seo' ? getLPExtLinks(niche) : []

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
    aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '127', bestRating: '5' }
  })
  const faqSch = safeJ({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
  })

  // ── HTML sections ────────────────────────────────────────────────────────

  const badgesHtml = calls.map(c => `<div class="badge"><span class="bchk">✓</span>${c}</div>`).join('')
  const featHtml   = features.map(f => `<div class="fc"><div class="fi">${f.icon}</div><h3>${f.title}</h3><p>${f.desc}</p></div>`).join('')
  const rvHtml     = reviews.map(r => `<div class="rv"><div class="rstars">⭐⭐⭐⭐⭐</div><blockquote>"${r.text}"</blockquote><cite>— ${r.name}, ${r.area}</cite></div>`).join('')
  const faqHtml    = faqs.map(f => `<details class="fq"><summary>${f.q}<span class="fq-icon">+</span></summary><p>${f.a}</p></details>`).join('')
  const slHtml     = links.map(s => `<a href="https://${company.mainDomain}${s.url}">${s.text}</a>`).join('')
  const galleryHtml = (niche === 'kitchen' || niche === 'renovation') ? `
<section class="sec sec-alt">
  <div class="si">
    <h2 class="st">${niche === 'kitchen' ? 'Our Kitchen Transformations' : 'Recent Projects in Ottawa'}</h2>
    <p class="ss">Before &amp; after results from ${city} homeowners</p>
    <div class="gal-grid">${[1,2,3,4,5,6].map(i => `<div class="gal-item" loading="lazy">📷<span>${service} — Project ${i}</span></div>`).join('')}</div>
    <p class="gal-note">📌 Replace placeholders with real project photos in the admin dashboard.</p>
  </div>
</section>` : ''

  const css = `*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;line-height:1.65}
img{max-width:100%;height:auto;display:block}a{text-decoration:none;color:inherit}
:root{--bg:${bg};--ac:${accent};--bg2:${bg}dd}
/* NAV */
.nav{position:sticky;top:0;z-index:100;background:var(--bg);padding:0 5%;height:68px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 12px rgba(0,0,0,0.2)}
.nav-brand{color:#fff;font-size:17px;font-weight:800;letter-spacing:-.01em}
.nav-cta{background:var(--ac);color:#fff;padding:10px 22px;border-radius:6px;font-weight:800;font-size:14px;white-space:nowrap;transition:filter .15s}.nav-cta:hover{filter:brightness(1.1)}
/* HERO */
.hero{background:linear-gradient(135deg,var(--bg) 0%,var(--bg) 55%,var(--ac) 100%);color:#fff;padding:64px 5%}
.hero-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 420px;gap:52px;align-items:center}
.hero h1{font-size:36px;font-weight:900;line-height:1.15;margin-bottom:14px}
.hero-sub{font-size:16px;opacity:.88;margin-bottom:24px;line-height:1.6}
.hero-ctas{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.btn-call{background:#fff;color:var(--bg);padding:14px 26px;border-radius:8px;font-weight:800;font-size:16px;display:inline-flex;align-items:center;gap:8px;transition:filter .15s}.btn-call:hover{filter:brightness(.95)}
.btn-quote{background:transparent;color:#fff;border:2px solid rgba(255,255,255,.55);padding:13px 22px;border-radius:8px;font-weight:700;font-size:14px;transition:border-color .15s}.btn-quote:hover{border-color:#fff}
.trust-strip{display:flex;flex-wrap:wrap;gap:16px;font-size:12px;opacity:.78}
.trust-strip span::before{content:'✓ ';font-weight:700}
/* LEAD FORM */
.form-wrap{background:#fff;border-radius:14px;padding:28px;color:#1a1a1a;box-shadow:0 12px 40px rgba(0,0,0,.25)}
.form-wrap h3{font-size:17px;font-weight:800;margin-bottom:16px;color:var(--bg)}
.ff{margin-bottom:11px}
.ff input,.ff textarea{width:100%;padding:11px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:inherit;transition:border-color .15s}.ff input:focus,.ff textarea:focus{outline:none;border-color:var(--ac)}
.ff textarea{resize:vertical;min-height:70px}
.fsub{width:100%;padding:14px;background:var(--ac);color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;transition:filter .15s}.fsub:hover{filter:brightness(1.08)}
.fthanks{display:none;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:18px;text-align:center;color:#166534;font-weight:700;font-size:15px;line-height:1.6}
/* BADGES */
.badges{background:#f1f5f9;padding:20px 5%}
.badges-inner{max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.badge{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:8px 18px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}
.bchk{color:var(--ac);font-weight:900;font-size:15px}
/* SECTIONS */
.sec{padding:72px 5%}.sec-alt{background:#f8fafc}
.si{max-width:1100px;margin:0 auto}
.st{font-size:30px;font-weight:800;text-align:center;margin-bottom:10px}
.ss{text-align:center;color:#64748b;margin-bottom:44px;font-size:17px}
/* FEATURES */
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.fc{border:1px solid #e2e8f0;border-left:4px solid var(--ac);border-radius:8px;padding:24px}
.fi{font-size:28px;margin-bottom:12px}
.fc h3{font-size:16px;font-weight:700;margin-bottom:8px}
.fc p{font-size:14px;color:#475569;line-height:1.65}
/* SERVICE DESC */
.prose p{font-size:16px;line-height:1.85;color:#374151;margin-bottom:16px}
/* REVIEWS */
.rv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:40px}
.rv{border:1px solid #e2e8f0;border-top:4px solid var(--ac);border-radius:8px;padding:24px}
.rstars{font-size:18px;margin-bottom:12px}
.rv blockquote{font-size:15px;line-height:1.75;color:#374151;margin-bottom:14px;font-style:italic}
.rv cite{font-size:13px;font-weight:700;color:#64748b;font-style:normal}
/* GALLERY */
.gal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.gal-item{aspect-ratio:4/3;background:#e2e8f0;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;color:#94a3b8;font-weight:600;gap:6px}
.gal-note{text-align:center;margin-top:16px;font-size:12px;color:#94a3b8}
/* FAQ */
.fq{border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;overflow:hidden}
.fq summary{padding:16px 20px;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:15px}
.fq summary::-webkit-details-marker{display:none}
.fq-icon{color:var(--ac);font-size:20px;font-weight:700;flex-shrink:0;transition:transform .2s}
.fq[open] .fq-icon{transform:rotate(45deg)}
.fq p{padding:0 20px 16px;font-size:15px;line-height:1.75;color:#475569}
/* CTA SECTION */
.cta-sec{background:linear-gradient(135deg,var(--bg) 0%,var(--ac) 100%);color:#fff;padding:84px 5%;text-align:center}
.cta-sec h2{font-size:34px;font-weight:900;margin-bottom:12px}
.cta-sec p{font-size:17px;opacity:.9;margin-bottom:32px;max-width:580px;margin-left:auto;margin-right:auto}
.btn-call-lg{display:inline-flex;align-items:center;gap:10px;background:#fff;color:var(--bg);padding:18px 36px;border-radius:10px;font-weight:800;font-size:20px;margin-bottom:16px;transition:filter .15s}.btn-call-lg:hover{filter:brightness(.97)}
.cta-sub{display:block;color:rgba(255,255,255,.75);font-size:14px;text-decoration:underline;margin-top:4px}
/* FOOTER */
.footer{background:var(--bg);color:rgba(255,255,255,.8);padding:48px 5%}
.footer-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:36px}
.fbrand{font-size:19px;font-weight:800;color:#fff;margin-bottom:10px}
.fcontact{font-size:14px;line-height:1.9}
.fcontact a{color:var(--ac);font-weight:600}
.flinks h4,.fareas h4{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.55;margin-bottom:12px}
.flinks a{display:block;font-size:14px;padding:3px 0;color:rgba(255,255,255,.65);transition:color .15s}.flinks a:hover{color:#fff}
.fbottom{border-top:1px solid rgba(255,255,255,.1);padding-top:16px;margin-top:28px;max-width:1100px;margin-left:auto;margin-right:auto;font-size:12px;color:rgba(255,255,255,.35);display:flex;gap:20px;flex-wrap:wrap}
/* MOBILE STICKY */
.sticky-bar{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--ac);z-index:200;box-shadow:0 -2px 8px rgba(0,0,0,.2)}
.sticky-bar a{display:flex;align-items:center;justify-content:center;gap:10px;color:#fff;font-weight:800;font-size:17px;padding:16px;letter-spacing:-.01em}
/* RESPONSIVE */
@media(max-width:900px){
  .hero-inner{grid-template-columns:1fr}
  .hero h1{font-size:28px}
  .feat-grid{grid-template-columns:repeat(2,1fr)}
  .rv-grid{grid-template-columns:1fr}
  .footer-inner{grid-template-columns:1fr;gap:24px}
  .gal-grid{grid-template-columns:repeat(2,1fr)}
  .sticky-bar{display:block}
  body{padding-bottom:58px}
}
@media(max-width:540px){
  .hero h1{font-size:24px}
  .feat-grid{grid-template-columns:1fr}
  .gal-grid{grid-template-columns:1fr}
  .st{font-size:24px}
  .btn-call,.btn-quote{width:100%;justify-content:center}
}`

  const formHtml = `<div class="form-wrap" id="lead-form">
  <h3>📋 ${ctaLabel}</h3>
  <form id="lp-form">
    <input type="hidden" name="source" value="landing-page">
    <input type="hidden" name="page" value="${domain}">
    <input type="hidden" name="company" value="${co}">
    <input type="hidden" name="keyword" value="${keyword}">
    <div class="ff"><input type="text" name="name" placeholder="Your Full Name" required></div>
    <div class="ff"><input type="tel" name="phone" placeholder="Phone Number" required></div>
    <div class="ff"><input type="email" name="email" placeholder="Email Address"></div>
    <div class="ff"><textarea name="message" rows="3" placeholder="${niche === 'restoration' ? 'Describe the damage or situation...' : niche === 'kitchen' ? 'Tell us about your kitchen project...' : 'Describe your renovation project...'}"></textarea></div>
    <button type="submit" class="fsub">📞 ${ctaLabel}</button>
  </form>
  <div class="fthanks" id="form-thanks">✅ We received your request! Expect a call within ${niche === 'restoration' ? '45 minutes' : '24 hours'}.</div>
</div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${capWords(service)} ${city} | ${company.name} — ${year}</title>
<meta name="description" content="Professional ${service.toLowerCase()} in ${city}, ON. ${company.name} — ${calls.slice(0, 2).join(', ') || 'Licensed & Insured'}. Call ${phone} for a free ${niche === 'restoration' ? 'assessment' : 'consultation'}.">
<meta name="robots" content="${mode === 'ppc' ? 'noindex,nofollow' : 'index,follow'}">
<link rel="canonical" href="https://${domain}/">
<script type="application/ld+json">${lbSch}<\/script>
<script type="application/ld+json">${faqSch}<\/script>
<style>${css}</style>
</head>
<body>

<!-- 1. NAV -->
<nav class="nav">
  <div class="nav-brand">${company.name}</div>
  <a href="tel:${pd}" class="nav-cta">📞 ${phone}</a>
</nav>

<!-- 2+3. HERO + LEAD FORM -->
<section class="hero">
  <div class="hero-inner">
    <div class="hero-text">
      <h1>${h1}</h1>
      <p class="hero-sub">${heroSub}</p>
      <div class="hero-ctas">
        <a href="tel:${pd}" class="btn-call">📞 Call ${phone}</a>
        <a href="#lead-form" class="btn-quote">Get Free Quote ↓</a>
      </div>
      <div class="trust-strip">
        <span>Google Rated 4.9</span>
        <span>Licensed &amp; Insured</span>
        <span>Serving ${city} Since 2005</span>
        ${niche === 'restoration' ? '<span>IICRC Certified</span>' : ''}
      </div>
    </div>
    ${formHtml}
  </div>
</section>

<!-- 4. TRUST BADGES -->
<div class="badges"><div class="badges-inner">${badgesHtml}</div></div>

<!-- 5. FEATURES GRID -->
<section class="sec">
  <div class="si">
    <h2 class="st">Why ${city} Trusts ${company.name}</h2>
    <p class="ss">${calls[0] || `Professional ${service} built on results, not promises`}</p>
    <div class="feat-grid">${featHtml}</div>
  </div>
</section>

<!-- 6. SERVICE DESCRIPTION -->
<section class="sec sec-alt">
  <div class="si">
    <h2 class="st">${capWords(service)} in ${city}</h2>
    <div class="prose">
      <p>${p1}</p>
      <p>${p2}</p>
      <p>${p3}</p>
      ${extHtml}
    </div>
  </div>
</section>

<!-- 7. REVIEWS -->
<section class="sec">
  <div class="si">
    <h2 class="st">What ${city} Homeowners Say</h2>
    <p class="ss">Real results from real customers — add your own reviews in the admin dashboard</p>
    <div class="rv-grid">${rvHtml}</div>
  </div>
</section>

<!-- 8. GALLERY (kitchen + renovation only) -->
${galleryHtml}

<!-- 9. FAQ -->
<section class="sec sec-alt">
  <div class="si">
    <h2 class="st">Frequently Asked Questions</h2>
    <p class="ss">Everything you need to know about ${service.toLowerCase()} in ${city}</p>
    <div style="max-width:760px;margin:0 auto">${faqHtml}</div>
  </div>
</section>

<!-- 10. URGENCY CTA -->
<section class="cta-sec">
  <h2>Ready to Get Started?</h2>
  <p>${urgency}</p>
  <a href="tel:${pd}" class="btn-call-lg">📞 Call ${phone} Now</a>
  <a href="#lead-form" class="cta-sub">Or fill out our form — we respond fast</a>
</section>

<!-- 11. FOOTER -->
<footer class="footer">
  <div class="footer-inner">
    <div>
      <div class="fbrand">${company.name}</div>
      <div class="fcontact">
        <a href="tel:${pd}">${phone}</a><br>
        <a href="https://${company.mainDomain}" target="_blank" rel="noopener">${company.mainDomain}</a><br>
        Serving: ${nbhd}
      </div>
    </div>
    <div class="flinks">
      <h4>Services</h4>
      ${slHtml || `<a href="https://${company.mainDomain}">${service}</a>`}
    </div>
    <div class="fareas">
      <h4>Areas Served</h4>
      <div style="font-size:13px;line-height:2;color:rgba(255,255,255,.6)">Ottawa · Kanata · Barrhaven<br>Orleans · Nepean · Gloucester</div>
    </div>
  </div>
  <div class="fbottom">
    <span>&copy; ${year} ${company.name}. All rights reserved.</span>
    <span>Licensed &amp; Insured in Ontario</span>
    <span>${mode === 'ppc' ? 'Paid Search Landing Page' : `<a href="https://${company.mainDomain}" style="color:rgba(255,255,255,.5)">${company.mainDomain}</a>`}</span>
  </div>
</footer>

<!-- MOBILE STICKY CTA -->
<div class="sticky-bar">
  <a href="tel:${pd}">📞 Call Now — ${phone}</a>
</div>

<script>
document.getElementById('lp-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = this.querySelector('.fsub');
  btn.textContent = 'Sending...';
  btn.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(this));
    await fetch('/api/leads', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    this.style.display = 'none';
    document.getElementById('form-thanks').style.display = 'block';
  } catch {
    btn.textContent = 'Error — please call us directly';
    btn.disabled = false;
  }
});
document.querySelectorAll('.fq').forEach(function(d) {
  d.addEventListener('toggle', function() {
    var icon = this.querySelector('.fq-icon');
    if (icon) icon.textContent = this.open ? '−' : '+';
  });
});
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
  'GET /api/auth/google', 'GET /api/auth/google/callback', 'GET /api/auth/google/status'
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

async function refreshGoogleToken(env: Bindings & Record<string, any>): Promise<string | null> {
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
    const devToken    = (c.env as any)?.GOOGLE_ADS_DEVELOPER_TOKEN
    const customerId  = (c.env as any)?.GOOGLE_ADS_CUSTOMER_ID
    const accessToken = c.env?.KV ? await refreshGoogleToken(c.env as any) : null

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
  const { keyword, service, domain, company: co, mode = 'seo' } = await c.req.json()
  if (!keyword || !service || !domain) return c.json({ error: 'keyword, service, domain required' }, 400)
  const detected = detectCompany(domain, keyword, co)

  // Fetch company data from D1 — white-label, never hardcoded
  let companyData: CompanyData | null = null
  if (c.env?.DB) {
    try {
      const row = await c.env.DB.prepare(
        'SELECT name, phone, domain AS mainDomain, color_bg, color_accent, callouts, sitelinks FROM companies WHERE key = ?'
      ).bind(detected).first() as any
      if (row) {
        companyData = {
          name: row.name,
          phone: row.phone,
          mainDomain: row.mainDomain,
          color_bg: row.color_bg || '#1A1A2E',
          color_accent: row.color_accent || '#CC0000',
          callouts: JSON.parse(row.callouts || '[]'),
          sitelinks: JSON.parse(row.sitelinks || '[]')
        }
      }
    } catch (_) { /* fall through to in-memory */ }
  }

  // In-memory fallback (dev / demo — DB unavailable)
  if (!companyData) {
    const c2 = COMPANIES[detected]
    companyData = {
      name: c2.name,
      phone: c2.phone,
      mainDomain: c2.domain,
      color_bg: (c2 as any).colors?.bg || '#1A1A2E',
      color_accent: (c2 as any).colors?.accent || '#CC0000',
      callouts: c2.callouts || [],
      sitelinks: c2.sitelinks || []
    }
  }

  const html = generateLandingPage(keyword, service, domain, detected, companyData, mode as 'ppc' | 'seo')
  return c.json({ html, company: detected, brand: companyData.name, domain })
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

export default app
