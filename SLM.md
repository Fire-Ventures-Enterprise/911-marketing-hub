# SLM — Services Leads Marketing Hub

## PROJECT
**Name:** Services Leads Marketing Hub
**Owner:** Fire Ventures Enterprise — Nasser Oweis (Super Admin / God Mode)
**Primary URL:** https://slm-hub.ca
**Redirect:** https://slm-hub.com → https://slm-hub.ca (301 permanent)
**Fallback URL:** https://services-leads-marketing-hub.pages.dev
**Version:** 2.0.0

---

## STACK
| Layer | Technology |
|-------|-----------|
| Backend | Hono v4 + TypeScript |
| Runtime | Cloudflare Workers/Pages |
| Database | D1 (SQLite) — `911-marketing-hub-production` |
| Cache/State | Cloudflare KV |
| Build | Vite + `@hono/vite-build` |
| Pre-build | `build-inline.js` (inlines HTML into `src/pages.ts`) |
| Dev Process | PM2 |

---

## INFRASTRUCTURE

### D1 Database
- **Name:** `911-marketing-hub-production`
- **ID:** `04f5ae3a-2273-49e5-8927-e7dcfa0afac1`
- **Binding:** `DB`
- **Tables:** `leads`, `companies`, `domains`, `users`, `sessions`, `keywords`, `domain_registrations`, `lp_templates`, `domain_images`, `google_reviews`, `google_business_profiles`, `tenants`, `tenant_invitations`, `subscription_plans`, `company_websites`, `data_permissions`, `competitors`, `competitor_intel`, `competitor_scans`, `scraped_businesses`

### R2 Bucket
- **Name:** `slm-hub-images`
- **Binding:** `IMAGES`
- **Location:** ENAM (East North America)
- **Image path pattern:** `templates/{NN}-{slug}/hero-{niche}.jpg`
- **Domain images:** `domains/{domain.tld}/{type}-{timestamp}.jpg`
- **Served via:** `GET /api/images/{r2_key}` Worker proxy (private bucket, no public URL)

### KV Namespace
- **Name:** `Services-Leads-Marketing-Hub-KV`
- **ID:** `40cccfe0b3734c3a8c16300e3300e6aa`
- **Binding:** `KV`

### Cloudflare Pages
- **Project name:** `services-leads-marketing-hub` (must be lowercase — Cloudflare requirement)
- **Output dir:** `dist` (`pages_build_output_dir` in `wrangler.jsonc`)
- **Primary domain:** `slm-hub.ca` (CF domain ID: `c4a0e717-0e71-4e10-a455-35b382fc000b`) — status: active
- **Redirect domain:** `slm-hub.com` (CF domain ID: `75bc66d5-f60a-4054-8a98-47af83c33467`) → 301 to `slm-hub.ca` — status: active
- **Fallback:** `services-leads-marketing-hub.pages.dev` (always active)

---

## BUILD PROCESS

**Always run `node build-inline.js` before `npm run build`.**
Never skip this step — it reads `public/static/app.html` and
`public/static/serviceleads.html` and inlines them into `src/pages.ts`.
Skipping it causes empty UI at `/app` and `/serviceleads`.

```bash
# Full deploy (handles everything in order)
npm run deploy
# Which runs: node build-inline.js && vite build && wrangler pages deploy

# Migrations (run before deploy when schema changes)
npx wrangler d1 execute 911-marketing-hub-production --file=migrations/<file>.sql --remote
```

### Migration files
| File | Description |
|------|-------------|
| `migrations/0001_initial.sql` | Creates `leads` table + indexes |
| `migrations/0002_seed.sql` | Creates `companies` + `domains` tables, seeds all 3 companies and 33 domains |
| `migrations/0003_auth.sql` | Creates `users` + `sessions` tables; seeds super admin Nasser Oweis |
| `migrations/0004_domain_auth.sql` | Adds `authorized`, `authorized_by`, `authorized_at`, `owned_by_tenant` to `domains`; pre-authorizes all 33 existing domains |
| `migrations/0005_domain_auth_correction.sql` | Corrects 0004: resets Building and Parked domains to `authorized = 0`; only Active domains remain authorized |
| `migrations/0006_territory_niche.sql` | Documents `territory` and `niche_angle` columns (added directly to D1 before migration file existed); adds `idx_domains_territory` and `idx_domains_niche_angle` indexes |
| `migrations/0007_keywords.sql` | Creates `keywords` table + 6 indexes; stores keyword research results linked to domains and companies |
| `migrations/0008_domain_registrations.sql` | Adds Porkbun sync columns (whois_privacy, security_lock, labels, domain_id, imported_at, updated_at) + 5 indexes to pre-existing `domain_registrations` table |
| `migrations/0009_template_column.sql` | Adds `template INTEGER DEFAULT NULL` to `domains` table + `idx_domains_template` index — already applied to production on 2026-03-28 |
| `migrations/0010_tenant_system.sql` | Documents `tenants`, `tenant_invitations`, `subscription_plans` tables — already applied directly on production (2026-03-29); safe to run on fresh DB with CREATE TABLE IF NOT EXISTS |
| `migrations/0011_scraper_permission.sql` | Documents `company_websites`, `data_permissions` tables + 4 indexes — already applied directly on production (2026-03-29); safe to run on fresh DB |
| `migrations/0012_competitor_intel.sql` | ALTER TABLE competitors ADD COLUMN (serp_keywords, scan_status, notes); CREATE TABLE competitor_scans; 5 indexes — applied on production (2026-03-29) |

---

## ARCHITECTURE — WHITE LABEL MULTI-TENANT

**Companies are NOT hardcoded anywhere in the codebase.**

All company data — name, phone, brand colours, domains, budgets, sitelinks, callouts — lives exclusively in the `companies` and `domains` tables in D1. The platform supports unlimited companies. Company names, details, and settings are managed through the UI by admins and must always be read from the database. Never assume, hardcode, or embed company names or details in source code.

Any reference to a specific company name, phone number, colour, or domain in application code (outside of seed/migration files) is a bug.

---

## USER ROLES

| Role | Access |
|------|--------|
| `super_admin` | God Mode — full access to all companies, all data, all settings. Sees everything across all tenants. Only one exists. Nasser Oweis. |
| `company_admin` | Full access to their own company only |
| `manager` | Leads, campaigns, and reporting for their company |
| `staff` | Read-only leads and basic reporting |

---

## LESSONS LEARNED

- `app.html` and `serviceleads.html` must exist in `public/static/` before building, or `pages.ts` generates empty placeholders and the UI is blank
- Cloudflare requires lowercase worker/pages project names — `Services-Leads-Marketing-Hub` is invalid; use `services-leads-marketing-hub`
- Always add `pages_build_output_dir` to `wrangler.jsonc` for Pages deployments
- Run migrations before deploying when schema changes
- Use `INSERT OR IGNORE` in seed files so they are safe to re-run
- Companies and domains are **never** hardcoded — always read from D1
- Any reference to specific company names in code is a bug
- `npm install` must be run before first deploy in a fresh clone — dependencies are not committed
- `wrangler pages project create <name>` must be run once before first `wrangler pages deploy` if the project doesn't exist on Cloudflare
- Always set `compatibility_date` in `wrangler.jsonc` — without it, Cloudflare uses an ancient Workers runtime. Hono v4 calls `Headers.prototype.getSetCookie()` internally when any `Set-Cookie` header is staged; that method does not exist in old runtimes and causes a 500. Fix: `"compatibility_date": "2024-01-01"`
- When setting `Set-Cookie` response headers in Hono, use a raw `new Response()` with the header inline instead of `c.header('Set-Cookie', ...) + c.json()` — this bypasses Hono's internal header-staging path that calls `getSetCookie` and works on any runtime version
- Always wrap login/auth route handlers in `try/catch` and return JSON errors — without it, any uncaught exception causes Hono to return `text/plain: "Internal Server Error"`, which causes `r.json()` in the browser to throw, showing a misleading "Network error" instead of the real error
- Add `app.onError((err, c) => c.json({error: ...}, 500))` to ensure all unhandled Worker errors return JSON, never plain text
- `GET /api/domains` was reading from a hardcoded in-memory object, not D1 — this is a bug; always read domain data from D1 so authorization and other DB-backed fields are returned correctly
- D1 `domains` table uses `company` as the column name; the frontend uses `d.co` — alias with `company AS co` in SQL to avoid rewriting all frontend references
- Domain authorization: `authorized`, `authorized_by`, `authorized_at`, `owned_by_tenant` columns added via `ALTER TABLE` in migration `0004_domain_auth.sql`; pre-authorize all existing rows with `UPDATE domains SET authorized = 1 ...` in the same migration
- Pre-authorization logic: only `Active` domains should be authorized on migration; `Building` and `Parked` domains stay at `authorized = 0` until the tenant explicitly approves — `0004` mistakenly authorized all 33, corrected by `0005_domain_auth_correction.sql` which resets `WHERE status IN ('Building', 'Parked')`
- D1 authorization state after 0005: Active=16 authorized=1, Building=12 authorized=0, Parked=5 authorized=0 (total 33 domains)
- If a column is added directly to D1 (outside a migration file), always create the migration file anyway and note "already applied on production" — skipping the migration file creates a gap that breaks fresh-DB setups
- `territory` and `niche_angle` columns were added directly to D1 before 0006 was written; 0006 documents them and adds the indexes only (safe to run on any state)
- Domain auth UI role matrix: `super_admin` → Authorize/Revoke on every domain; `company_admin` → Request Auth button on unauthorized domains only; `manager`/`staff` → read-only (no action buttons); auth badge shows ISO date when authorized
- `POST /api/domains/:id/request-auth` logs request to KV (key: `auth_request:{domain_id}:{user_id}`, TTL 30 days) — super admin reviews and uses `/authorize` to approve
- `.qf-request` button style added (blue, matches company_admin role color) for Request Auth button
- LP Generator domain field is a custom grouped dropdown (not a plain `<input>`) — use `id="lp-domain"` hidden input for the value, `setDomainDDDisplay('lp', domain)` to sync the visible label from external callers (fillLP, fillFromDomain); never read from a plain text input on the LP pane
- `buildDomainDD(prefix)` must be called after both `allDomains` and `allCompanies` are loaded — call it from both `loadDomains()` and `loadCompanies()` so group headers show full company names
- `_ddOutsideRegistered` flag prevents duplicate `document.click` listeners across multiple `buildDomainDD` calls
- Dropdown groups domains by `d.co` (company key); company display name and icon come from `allCompanies` with a key-based fallback — never hardcoded
- `filterDomainDD` searches across domain, keyword, service, and co fields; the group header shows "N of M" when filtered below total
- Unauthorized domains render as `.dd-disabled` rows (Pending Auth badge, `cursor:not-allowed`, 40% opacity) — not clickable, not selectable
- Keyword research generator pulls from three sources in priority order: (1) Google Keyword Planner via `KeywordPlanIdeaService.generateKeywordIdeas` (requires `GOOGLE_ADS_DEVELOPER_TOKEN` + `GOOGLE_ADS_CUSTOMER_ID` env vars + OAuth tokens in KV), (2) Google Trends unofficial API (free, no key, server-side fetch strips `)]}'\n` XSSI prefix), (3) Search Console placeholder (wired, not yet active)
- If Google Ads credentials are missing, the endpoint returns `connect_message` and the UI shows a Connect Google Ads banner — never fakes or mocks data
- Keyword scoring (1–100): volume (0–40) + competition inverted (0–25) + intent (0–20: emergency=20, commercial=15, local=10, info=5) + geo-relevance (0–10) + EMD bonus (0–5)
- Google Trends data: trend_values (12-month array) used to draw inline SVG sparklines; recent vs. older 3-point comparison adds up to +3 score boost for rising trends
- KV cache key format: `kw:{company_key}:{territory-slug}:{niche-slug}` with 7-day TTL — avoids repeat API calls for same inputs
- `keywords` table added to D1 (migration 0007): id, domain_id, company_id, keyword, volume, cpc, competition, intent_type, match_type, score, territory, source, created_at
- `GEO_TARGETS` maps city name slugs to Google Ads geo target constant IDs; defaults to Canada (2124) if city not found
- `refreshGoogleToken()` checks token age against `expires_in`, auto-refreshes using `refresh_token` stored in KV, writes updated token back — keeps sessions alive without user re-auth
- Keyword research seeds from D1 domain keywords (authorized domains for selected company) + niche+territory combos — never hardcoded seeds
- Export to CSV: all keyword fields included, filename formatted as `keywords-{territory}-{timestamp}.csv`
- `sendKwToAds()` and `sendKwToLP()` wire keywords directly to existing generators — keyword research feeds the full pipeline
- LP Generator PPC vs SEO mode selector: `<select id="lp-mode">` in LP pane; `generateLP()` reads it and passes `mode` in POST body; toast confirms mode: "Generated [SEO] for …"
- `POST /api/generate/landing-page` fetches company data from D1 (`SELECT … FROM companies WHERE key = ?`), parses JSON `callouts` and `sitelinks` columns, builds `CompanyData` object; falls back to in-memory `COMPANIES` only when DB unavailable (dev/demo); `COMPANIES[detected].name` hardcoded reference replaced — brand name now always comes from D1
- LP generator `generateLandingPage` signature: `(keyword, service, domain, co, company: CompanyData, mode: 'ppc'|'seo')` — CompanyData carries name, phone, mainDomain, color_bg, color_accent, callouts[], sitelinks[]
- PPC mode produces `noindex,nofollow` meta + no external links; SEO mode produces `index,follow` + 2 authority outbound links per SEO Linking Doctrine
- `safeJ()` helper escapes `</script>` in JSON-LD schema strings to prevent premature tag close in generated HTML
- CSS custom properties in generated LP: `:root { --bg: ${bg}; --ac: ${accent}; }` — single substitution drives all colors throughout the page
- D1 `companies` table `callouts` and `sitelinks` columns store JSON arrays — always parse with `JSON.parse(row.callouts || '[]')` to avoid runtime errors on null/empty values
- In-memory COMPANIES fallback: use `(c2 as any).colors?.bg` — TypeScript type may not include `colors` sub-object; cast to `any` to avoid compile errors in fallback path
- **Registrar: Porkbun API v3 exclusively** — no Namecheap, no other registrar; all domains owned by Fire Ventures Enterprise
- Porkbun base URL: `https://api.porkbun.com/api/json/v3`
- Porkbun auth: `apikey` + `secretapikey` sent in every request body (not headers)
- Porkbun secrets stored as Cloudflare encrypted secrets: `PORKBUN_API_KEY`, `PORKBUN_SECRET_KEY` — set via `wrangler secret put`; empty placeholder strings in `wrangler.jsonc` `vars` block for local dev awareness only
- Porkbun ping endpoint: `POST /api/json/v3/ping` — returns `{ status: "SUCCESS", yourIp: "..." }` on valid credentials
- Porkbun domain availability: `POST /api/json/v3/domain/checkDomain/{domain}` — returns availability status and pricing
- Porkbun domain registration: `POST /api/json/v3/domain/create/{domain}` — body requires `cost` (in pennies) and `agreeToTerms: "yes"`
- WHOIS privacy on Porkbun is automatic and free — no extra flag needed
- Worker routes: `GET /api/porkbun/ping` (super_admin only), `POST /api/porkbun/check` body `{ domains: [...] }` (super_admin only)
- `porkbunPost(env, path, extra)` helper centralises auth injection — never spread api keys inline across routes
- `Bindings` type must include `PORKBUN_API_KEY: string` and `PORKBUN_SECRET_KEY: string` for TypeScript to compile Worker routes that read those env vars
- **Critical: Pages secrets ≠ Workers secrets** — `wrangler secret put` sets a secret for a *Worker*; for a Pages project you must use `wrangler pages secret put <KEY> --project-name <project>` — without this the secret is invisible to the Pages Function and `env.PORKBUN_API_KEY` is `undefined`
- Pages secrets must be set separately for production and preview environments if needed
- `wrangler pages secret list --project-name <project>` confirms what is actually visible to the Pages Function; check this first when a secret appears missing
- Never put real API keys in `wrangler.jsonc` vars — Cloudflare rejects it if a secret with the same name already exists (binding name collision); use comments in wrangler.jsonc to document that secrets exist, not vars
- Porkbun `checkDomain` rate limit: **1 call per 10 seconds** — always check domains sequentially with 11s delay; parallel checks cause all but the first to return `status: "ERROR"` with rate limit message
- Porkbun `checkDomain` response fields: `response.avail` ("yes"/"no"), `response.price` (promo reg price), `response.regularPrice`, `response.additional.renewal.price`, `response.additional.transfer.price`
- Porkbun Pages secrets confirmed working after redeploy — secrets only take effect on next Pages deployment, not immediately after `wrangler pages secret put`
- **Domain availability results (2026-03-28):** `basementfloodedottawa.ca` → AVAILABLE $8.88/yr | `waterdamageottawa.ca` → AVAILABLE $8.88/yr | `kitchencabinetsottawa.ca` → TAKEN (unavailable)
- **Platform brand domains:** `slm-hub.ca` (primary) + `slm-hub.com` (301 redirect) — purchased on Porkbun, both already active as CF Pages custom domains
- **COMMON MISTAKE: domains are `slm-hub.ca` / `slm-hub.com` (hyphenated) — never write `slmhub` without the hyphen**
- Cloudflare Pages has no `wrangler.jsonc` field for custom domains — they must be added via CF API or Dashboard; document domain IDs in `wrangler.jsonc` comments
- Custom domain activation requires DNS at Porkbun: `CNAME @ → services-leads-marketing-hub.pages.dev` for each domain; Cloudflare validates via HTTP challenge once DNS propagates
- slm-hub.com → slm-hub.ca redirect is handled by Hono middleware (host header check, 301) so it works regardless of DNS/CF routing
- Google OAuth redirect URI updated to `slm-hub.ca` in `serviceleads.html` — update the authorized URI in Google Cloud Console to match
- `domain_registrations` table existed before 0008 with a base schema (created in a prior session) — 0008 adds columns via ALTER TABLE, not DROP/CREATE; always check `sqlite_master` before applying migrations to avoid "no such column" errors from duplicate CREATE TABLE IF NOT EXISTS followed by CREATE INDEX
- `domain_registrations` existing columns: id (INTEGER AUTOINCREMENT), company_id, domain, tld, registrar, registrar_order_id, status, registered_at, expires_at, auto_renew, purchase_price, renewal_price, dns_configured, landing_page_created, lead_form_active, created_at — added by 0008: whois_privacy, security_lock, labels, domain_id, imported_at, updated_at
- Porkbun `listAll` response: `domain.expireDate` is "YYYY-MM-DD HH:MM:SS" — split on space and take [0] before storing in D1 for SQLite date() compatibility
- Import-all uses D1 `.batch()` in groups of 50 to avoid per-domain N+1 queries; pre-loads domains + companies maps in 3 queries total
- Browser-side domain search handles 11s rate-limit delays (countdown timer per domain) — server only checks 1 domain per request; no Worker timeout risk
- `_normSlug()` normalises keyword/city inputs to lowercase alphanumeric for domain pattern generation
- Domain search generates 3 patterns × selected extensions: `{kw}{city}`, `{city}{kw}`, `{kw}in{city}`
- Registration flow steps: register → save_d1 → dns_cname → generate_lp (pending/manual) → activate_leads (pending/manual) → cf_custom_domain (pending/manual)
- Porkbun register endpoint uses both `agreement: "yes"` AND `agreeToTerms: "yes"` to handle API field name ambiguity
- `GET /api/porkbun/sync-status`, `POST /api/porkbun/import-all`, `POST /api/porkbun/register`, `GET /api/porkbun/expiry-alerts` — all super_admin only
- Migration table updated to include 0008 — SLM.md tables list: leads, companies, domains, users, sessions, keywords, domain_registrations
- **15 LP templates** seeded in `lp_templates` D1 table — each has `template_number`, `primary_color`, `accent_color`, `layout`, `style`, `best_for`, `usage_count`, `last_used`, `active`
- **Template rotation**: `POST /api/generate/landing-page` checks `domains.template` in D1 — if NULL, selects least-used active template (`ORDER BY usage_count ASC, last_used ASC LIMIT 1`), locks it to the domain, increments `usage_count`, stamps `last_used`
- **Template layouts** (7 variants): `hero-left` (T01, T07, T10), `centered-bold` (T02, T09, T15), `split-screen` (T03, T08, T11), `magazine` (T04, T12), `image-hero` (T05, T14), `magazine-editorial` (T06), `minimal-urgency` (T13)
- `generateLandingPage` updated signature: `(keyword, service, domain, co, company: CompanyData, mode: 'ppc'|'seo', tpl: TemplateConfig)` — `TemplateConfig` carries number, name, bg, accent, layout, heroImageUrl
- `DEFAULT_TEMPLATE` constant: T01 Bold Emergency — used as fallback when DB is unavailable
- Template CSS is layered: `baseCSS` (shared components) + `layoutCSS[layout]` (structural) + `tplOverrides[number]` (visual decorators per template)
- **R2 bucket `slm-hub-images`** is private (no public URL) — images served via `GET /api/images/{r2_key}` Worker proxy with `Cache-Control: public, max-age=86400`
- R2 binding in `wrangler.jsonc`: `[[r2_buckets]]` with `binding = "IMAGES"` and `bucket_name = "slm-hub-images"` — also added `IMAGES: R2Bucket` to `Bindings` type in `index.tsx`
- R2 hero image path: `templates/{NN}-{slug}/hero-{niche}.jpg` — `NN` is zero-padded template number, `slug` is template name lowercased with spaces → hyphens, `niche` is `restoration|renovation|kitchen`
- If R2 image does not exist for a template: CSS gradient fallback using template colors — no broken images
- `domain_images` D1 table records all uploaded images: `r2_key`, `image_type`, `niche`, `template_id`, `domain_id`, `alt_text`, `approved`, `source`, `created_at` — `approved = 0` until super admin approves
- Admin image upload: `POST /api/images/upload` (super_admin only) — accepts multipart form with `file`, `template_id` OR `domain_id`, `image_type`, `niche`, `alt_text`; validates type (JPEG/PNG/WebP) and size (max 5MB); stores in R2 + records in `domain_images`
- `GET /api/images/list` returns all uploaded images with their proxied `/api/images/` URL — filterable by `?domain_id=` or `?template_id=`
- `PATCH /api/images/:id/approve` sets `approved = 1` on a `domain_images` row
- `GET /api/lp-templates` exposes full template list to admin dashboard (super_admin only)
- `PATCH /api/lp-templates/:num/reset` resets `usage_count = 0, last_used = NULL` for a template
- Admin sidebar now has "Images" pane with: template hero upload (by template + niche), domain image upload (by domain + type), template browser with color swatches + usage counts, image library with approval workflow
- `domains.template` column added (0009): `INTEGER DEFAULT NULL` — NULL means rotation will assign next template; set by endpoint after first generation; admin can override by setting directly in D1
- **Template locking**: once a domain gets a template assigned, it always serves that template for consistency — prevents jarring changes for repeat visitors
- **Google Ads API credentials (all 6 confirmed in CF Pages secrets, 2026-03-28):** `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `PORKBUN_API_KEY`, `PORKBUN_SECRET_KEY`
- **`wrangler pages secret put` non-interactive pitfall**: running the command without piping a value in CI/non-TTY environments stores an empty string silently — always use `echo "VALUE" | npx wrangler pages secret put KEY --project-name PROJECT` to guarantee a non-empty value is stored
- **`POST /api/google-ads/push` is now real (Google Ads API v18)**: demo guard removed; when `devToken` + `customerId` are present and OAuth token exists in KV, creates a full campaign (budget → campaign PAUSED → ad group → keywords → RSA → callout extension) via 5 sequential REST calls; returns `status: 'live'` with `campaignResource` + `adGroupResource` resource names on success
- **Campaign created as PAUSED**: all Google Ads campaigns pushed from the hub are created in `PAUSED` status — user must manually enable in Google Ads console to start spending; prevents accidental budget burn
- **`customerId` strip hyphens**: Google Ads REST API requires customer ID without dashes (e.g., `1234567890` not `123-456-7890`) — always `.replace(/-/g, '')` before use in API URLs
- **Push endpoint error handling**: Google Ads API errors are JSON bodies; always do `JSON.stringify(data?.error || data)` in the `throw` to capture the full error structure, not just `data.message`
- **Keyword `matchType` mapping**: `generateAdsCampaign` output uses display strings (`Exact`, `Phrase`, `Broad`); Google Ads API v18 requires uppercase enum strings (`EXACT`, `PHRASE`, `BROAD`) — map before sending
- **RSA headline truncation**: Google Ads API rejects headlines > 30 chars and descriptions > 90 chars — always `.slice(0, 30)` / `.slice(0, 90)` before sending; max 15 headlines, 4 descriptions per RSA
- **Push history in KV**: every push (live, demo, error) is recorded to KV with key `push:{timestamp}` and 30-day TTL — `GET /api/google-ads/history` returns last 20 entries
- **Google OAuth flow uses dynamic origin**: `new URL(c.req.url).origin + '/api/auth/google/callback'` — no hardcoded URL anywhere in backend; automatically resolves to `slm-hub.ca` when accessed via that domain; no update needed when domain changes
- **`serviceleads.html` OAuth docs**: already shows `https://slm-hub.ca/api/auth/google/callback` as the correct callback URI to register in Google Cloud Console — no changes needed to frontend docs
- **`invalid_client` root cause**: Google Ads secrets were added to CF Pages AFTER the last deployment — secrets only take effect on next deploy; the live Worker had `undefined` for `GOOGLE_ADS_CLIENT_ID`, sending `client_id=undefined` to Google which returns `Error 401: invalid_client`
- **Always redeploy after adding/updating CF Pages secrets** — `wrangler pages secret put` alone is not enough; a `npm run deploy` must follow or the Worker continues running with the old (missing) values
- **Add all env secrets to `Bindings` type** — accessing secrets via `(c.env as any)?.KEY` compiles fine but masks missing-secret bugs at TypeScript level; always add secrets to `Bindings` so `c.env.KEY` is typed and IDE-checked; removed all `as any` casts for Google Ads keys
- **`refreshGoogleToken` signature updated** to accept `Bindings` directly (was `Bindings & Record<string, any>`) — `GOOGLE_ADS_CLIENT_ID` and `GOOGLE_ADS_CLIENT_SECRET` are now proper typed fields
- **OAuth callback now shows Google error detail** — if token exchange fails, page renders `tokens.error` + `tokens.error_description` for debugging; also shows missing-credentials error before even calling Google token endpoint
- **`encodeURIComponent(clientId)` added to OAuth redirect URL** — `client_id` is already URI-safe but encoding it is defensive best practice; redirect_uri and scope were already encoded
- **CRITICAL: Never use `new URL(c.req.url).origin` for OAuth redirect_uri** — Cloudflare Pages internal routing can resolve `c.req.url` to a deployment subdomain (e.g. `46eea2eb.services-leads-marketing-hub.pages.dev`) instead of the custom domain `slm-hub.ca`; the redirect_uri in the token exchange would then mismatch what Google received in the auth request → `invalid_grant`
- **OAuth redirect_uri is hardcoded** to `https://slm-hub.ca/api/auth/google/callback` via `GOOGLE_OAUTH_REDIRECT_URI` constant — must be identical in both `GET /api/auth/google` (auth request) and `GET /api/auth/google/callback` (token exchange); character-for-character match required by Google
- **On OAuth success redirect to `/app?oauth=success`** — not a static HTML page; cleaner UX and allows the app to show a success toast
- **OAuth callback error pages now show Google's exact error** — `tokens.error` + `tokens.error_description` + HTTP status + which redirect_uri was used; helpful for diagnosing future `invalid_grant` or `invalid_client` errors
- **Token storage format on success**: `{ access_token, refresh_token, expires_in, token_type, scope, stored_at }` — explicit field list prevents accidentally storing Google debug fields; KV key `google_oauth_tokens`, 30-day TTL
- **Google OAuth flow confirmed working end to end (2026-03-29)** — auth request → Google consent screen → callback → token exchange → tokens stored in KV → redirect to `/app?oauth=success`
- **Google Cloud Console: Testing status requires adding test users** — while the OAuth app status is "Testing" (not yet published), only explicitly added test users can complete the OAuth flow; add the Google account email at Google Cloud Console → OAuth consent screen → Audience → Test users; without this, Google returns `access_denied`
- **"Google hasn't verified this app" warning is normal in Testing mode** — users see this interstitial; click "Continue" (or "Advanced" → "Go to [app name]") to proceed; this goes away once the app is published
- **All 6 Cloudflare Pages secrets confirmed live**: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `PORKBUN_API_KEY`, `PORKBUN_SECRET_KEY`
- **Google Ads Basic Access application submitted (2026-03-29)** — awaiting approval, estimated 3 business days; once approved, `KeywordPlanIdeaService` (keyword planner) and `POST /api/google-ads/push` (campaign creation) activate automatically — no code changes needed, credentials are already wired
- **Google Reviews Integration built (2026-03-29)**: `google_reviews` and `google_business_profiles` tables confirmed in D1; `GOOGLE_PLACES_API_KEY` added to `Bindings`; full sync/connect/featured-toggle API built
- **Google Places API (New) reviews response structure**: `reviews[].authorAttribution.displayName`, `.photoUri`; `reviews[].text.text`; `reviews[].rating`; `reviews[].relativePublishTimeDescription`; `reviews[].publishTime` — different field names from Places API (Legacy)
- **Places API review limitation**: Google Places API (New) returns max 5 most-recent reviews per place, not sorted by rating; workaround: sort by rating DESC after fetch, filter rating ≥ 4 + text ≥ 50 chars, store top 10 qualifying, auto-feature top 5
- **Review sync flow**: `POST /api/reviews/sync/{company_id}` → fetch place details → filter qualifying reviews → DELETE + re-INSERT in D1 → auto-feature top 5 → update profile stats → delete KV cache key `reviews:{company_id}`
- **Review KV cache**: `reviews:{company_id}` key, 24-hour TTL; LP generation checks KV first, falls back to D1; sync invalidates cache immediately
- **`generateLandingPage` real reviews param**: new 8th parameter `realReviews: ReviewRow[] | null` — when provided and non-empty, renders real reviews with star count + "✓ Google" badge; when null shows admin placeholder with orange border; fake `getLPReviews()` function still exists for non-LP uses but is never called from LP generation
- **AggregateRating schema updated**: when real reviews are passed, schema uses computed `avgRating` + actual `reviewCount`; when no reviews, defaults to `4.9 / 127` (keeps schema valid without real data)
- **`validateLP` function**: checks 16 conditions across Technical SEO, Schema, Conversion, Links, Reviews; returns `{ passed[], warnings[] }`; LP endpoint returns `checklist` in response JSON; admin UI shows green/yellow checklist below LP output; warnings are advisory — LP always generated regardless
- **LP checklist review check**: passes if no `rv-placeholder` class in HTML (real reviews loaded); warns if placeholder shown (no profile connected)
- **GOOGLE REVIEWS DOCTRINE — smart business name search (updated 2026-03-29)**:
  - Admin types business name (e.g. "911 Restoration Ottawa") — no manual URL paste ever
  - `POST /api/reviews/search-place` calls Google Places API (New) `places:searchText` with optional `locationBias` `{ circle: { center: {lat,lng}, radius: 50000 } }` passed from frontend
  - Returns up to 5 results: place_id, name, address, rating, total_reviews, maps_url
  - Each result shows "This is my business" button (not a whole-card onclick)
  - Admin clicks "This is my business" → `POST /api/reviews/connect/:company_id` saves to `google_business_profiles`
  - Immediately auto-triggers `POST /api/reviews/sync/:company_id` → fetches + stores reviews
  - Minimum 4 stars, 50 char text; top 5 auto-featured; 24-hr KV cache
  - Review cards show: stars + Featured badge + review text + reviewer name + relative time + "✓ Verified Google Review" + "View on Google Maps" link
  - `_rvProfileUrl` stored in frontend state after `rvLoadProfile()` — used in review card render without re-fetching
  - `rvShowSearch()` allows "Change" after profile connected without D1 disconnect
  - `POST /api/reviews/search-business` kept for backwards compat (inline GBP in Companies pane); new pane uses `search-place`
- **Reviews pane**: sidebar nav item "⭐ Reviews"; step-based UI: Step 1=company selector, Step 2=search input, Step 3=results; connected state shows green `.rv-connected-box`; list card shows after connection; all-companies overview table (super_admin only uses `.tbl-wrap` classes)
- **`rvInit()` populates company selector** from `allCompanies`; `rvLoadProfile()` checks if profile exists, shows search section if not; `rvSync()` calls `POST /api/reviews/sync/{company_id}`
- **`getStoredToken()` helper** reads `slm_token` from cookie for API calls within reviews JS — avoids duplicating auth logic
- **Reviews endpoint auth**: `POST /api/reviews/search-place`, `POST /api/reviews/search-business`, `POST /api/reviews/connect/:id`, `POST /api/reviews/sync/:id` require `super_admin` or `company_admin`; company_admin scoped to their own company_id; `GET /api/reviews/:company_id` requires any authenticated user
- **`getLPReviews` fake review function kept** — still in codebase as fallback reference but never called from LP endpoint; remove in a future cleanup session
- **`rvInit()` race condition**: `allCompanies` initialises as `[]` (empty array), which is truthy; guard `if (!allCompanies)` never fires; when Reviews tab is clicked before `loadCompanies()` resolves, the dropdown renders with zero options; fix: `if (!allCompanies.length) await loadCompanies()` at the top of `rvInit()`
- **Role-based company selector in Reviews**: `company_admin` should see their own company pre-selected and the dropdown disabled; `super_admin`/`manager` see the full dropdown; always handle both cases in `rvInit()`; hide the all-companies overview card for `company_admin`
- **CSS variable discipline**: all inline styles in JS must use `var(--tx)`, `var(--tx2)`, `var(--tx3)`, `var(--accent)` — never `var(--txt1)`, `var(--txt2)`, `var(--txt3)`, or `var(--ac)`; these wrong names produce invisible/unstyled elements in dark mode
- **Company Management tab**: `🏢 Companies` sidebar nav item is `super_admin`-only — hidden with `style="display:none"` on element, revealed after `checkAuth()` resolves when `currentUser.role === 'super_admin'`; use class `co-mgmt-nav` on both the `<div class="sb-group">` and the `<button>` so both show/hide together
- **`POST /api/companies` + `PATCH /api/companies/:id`**: both require `super_admin`; validate `key` with regex `/^[a-z0-9-]+$/`; handle UNIQUE constraint violation → 409 with friendly message; `callouts` and `sitelinks` are JSON-stringified before storage, never raw arrays
- **`loadCompanyMgmt()`**: fetches `GET /api/reviews` to get GBP status for each company, populates `_coMgmtProfiles` map keyed by `company_id`; renders company table with inline GBP status badge; calls `loadCompanies()` if `allCompanies` is empty (same race fix as `rvInit`)
- **Inline GBP connect in edit form**: reuses same `POST /api/reviews/search-business` + `POST /api/reviews/connect/:id` endpoints as Reviews pane — no new API needed; tracks selected company via `_coInlineGbpCompanyId`; hides the section entirely in Add-Company form (no ID yet)
- **`saveCompany()` refreshes global companies**: after create/update calls `await loadCompanies()` then `loadCompanyMgmt()` — keeps `allCompanies` in sync so LP generator dropdown, domain grouping, and Reviews selector are immediately up to date
- **Color pickers sync both ways**: `<input type="color">` and `<input type="text">` are kept in sync via `oninput` cross-assignment — color picker updates text field and vice versa; both send the hex value to the API
- **Tenant system built (2026-03-29)**: `tenants`, `tenant_invitations`, `subscription_plans` tables confirmed in D1; full invite/accept/impersonate API built; `/invite/:token` public page served via Hono route + `INVITE_HTML` export
- **`build-inline.js` must include all new HTML pages** — when adding a new page (`invite.html`), add to `build-inline.js` AND export from `pages.ts` AND import in `index.tsx`; failing any of the three causes either a build error or blank page
- **`INVITE_HTML` added to `pages.ts`**: `build-inline.js` was updated to inline `public/static/invite.html`; exported as `INVITE_HTML`; imported in `index.tsx`; served at `GET /invite/:token`
- **Public tenant invitation routes skip auth**: `GET /api/invite/:token` and `POST /api/invite/:token/accept` skip auth middleware via prefix check `path.startsWith('/api/invite/')` in the auth middleware; `GET /api/subscription-plans` added to `SKIP_AUTH` set
- **`hashPassword` function**: uses PBKDF2 (same algorithm as `verifyPassword`) — format `pbkdf2:{saltHex}:{hashHex}`; generates 16-byte random salt via `crypto.getRandomValues`; 100,000 iterations SHA-256
- **Impersonation flow**: super_admin hits `POST /api/tenants/:id/impersonate` → creates a 1-hour session token for the target company_admin → stores original super_admin token in KV (`impersonate_origin:{newToken}`, TTL 1h) → new session cookie set → frontend stores `slm_impersonating` in sessionStorage → page reload → banner shown → exit hits `POST /api/auth/exit-impersonate` → swaps cookie back to original token → clears KV + sessionStorage
- **`sendInviteEmail` uses MailChannels** (`https://api.mailchannels.net/tx/v1/send`) — no API key needed on Cloudflare Pages Workers; falls back gracefully if it fails (returns `email_sent: false` + `invite_url` in response so admin can share manually)
- **Tenant isolation enforcement**: `POST /api/generate/landing-page`, `POST /api/generate/ads-campaign`, `POST /api/generate/seo-content` now check that the domain's `company_id` matches `user.company_id` when role is `company_admin`; `GET /api/domains`, `GET /api/companies`, `GET /api/leads`, `GET /api/reviews` already had isolation in place
- **Role-based nav**: `_applyRoleNav(role)` called after auth — `super_admin` shows all nav including Tenants+Companies; `staff` hides generator items (domains/landing/ads/seo/keywords/publish/images/reviews); sidebar footer text reflects role
- **Super Admin badge color = gold** (`#F59E0B`); company_admin = blue (`#60a5fa`); staff = grey (`#94a3b8`) — role colors defined in `ROLE_COLORS` in app.js
- **User limit enforcement**: `POST /api/team/invite` checks `tenants.max_users` against active user count for the company; returns 403 with upgrade prompt if at limit; limit is read from D1 `tenants` table — never hardcoded
- **Subscription plans from D1**: `GET /api/subscription-plans` serves 4 plans from D1 — never hardcode plan names or prices; plan limits (max_domains, max_users, features) always read from `subscription_plans` table
- **Tenant invitation token**: 32-byte hex string (64 chars) via `generateToken(32)`; single-use (status `pending` → `accepted`); expires in 7 days; checked in both validate and accept endpoints
- **Data Permission Gate built (2026-03-29)**: `data_permissions` + `company_websites` tables confirmed in D1; full permission grant/revoke/download API built; `#permission-gate` full-screen overlay shown on first login for company_admin; `#perm-banner` amber banner shown when "Review Later" selected; both stored in sessionStorage `slm_perm_review_later`
- **Data permission check in generators**: `POST /api/generate/landing-page`, `POST /api/generate/ads-campaign`, `POST /api/generate/seo-content` all check `data_permissions.permission_granted=1 AND revoked_at IS NULL` + `company_websites.scrape_status='completed'` for company_admin users; super_admin bypasses all checks
- **Website scraper uses `fetch()` not Browser Rendering API**: `POST /api/scraper/scan` uses plain `fetch(url)` to get HTML then regex-parses phone, email, logo (og:image), tagline (og:description), services (h2/h3 headings), brand colors (CSS hex frequency), social links; works for static/SSR sites; JS-heavy SPAs return limited data
- **Tone analysis via Anthropic Claude**: `analyzeWebsiteTone(apiKey, text)` calls `claude-3-5-haiku-20241022` with max_tokens=20; returns one of 6 tone values; requires `ANTHROPIC_API_KEY` CF Pages secret; gracefully falls back to `'professional'` if key absent or API fails
- **`ANTHROPIC_API_KEY` added to Bindings type**: set via `echo "KEY" | npx wrangler pages secret put ANTHROPIC_API_KEY --project-name services-leads-marketing-hub` then redeploy
- **Scraper data enriches LP generation**: after fetching company data from D1, `POST /api/generate/landing-page` also reads `company_websites` row; overrides company phone if empty, overrides template colors with brand colors if available; invisible HTML comment `<!-- SLM-AUDIT: generated=... company_id=... scrape_status=... -->` appended before `</html>`
- **30-day rescan TTL via KV**: each successful scrape sets KV key `scraper:next_scan:{company_id}` with 30-day TTL; `GET /api/permissions/status` and `GET /api/scraper/brand-profile` return `rescan_due: true` when key is absent (expired); UI shows rescan recommendation
- **Brand profile pane**: `pane-brand-profile` accessible via Brand Profile nav item (`.co-admin-nav`, hidden for super_admin/staff); has scraper card + editable brand card with colors (color picker swatches), contact info, services (tags with Enter-to-add), voice/tone dropdown, tagline, logo preview, social profiles
- **`co-admin-nav` CSS class**: nav items with this class shown only for `company_admin` role — handled in `_applyRoleNav()`; used for Brand Profile nav item
- **Permission management in Settings**: Data & Privacy card in `pane-settings` (hidden for non-company_admin); shows permission status, revoke button, re-authorize link, GDPR download; `loadDataPrivacy()` called when Settings tab is opened
- **GDPR data export**: `GET /api/permissions/download` returns JSON with user profile, company info, data_permissions record, brand profile, lead count; downloaded as `slm-hub-data-export.json` via blob URL trick
- **`scrape_status = 'completed'` on manual save**: `PATCH /api/scraper/brand-profile` sets `scrape_status='completed'` — satisfies generation check even without auto-scan; manual entry is the fallback path for sites that don't scrape well
- **SerpAPI competitor intelligence built (2026-03-29)**: `SERPAPI_KEY` CF Pages secret set; `competitors`, `competitor_intel` tables were pre-existing; `competitor_scans` table + new columns (`serp_keywords`, `scan_status`, `notes`) added via migration 0012
- **SerpAPI existing table schema mismatch**: `competitors` table had `competitor_name` (not `name`), `website_url` (not `domain`), `territory` (not `city`), `status` (not `scan_status`), `added_at` (not `created_at`) — always query `sqlite_master` before writing queries against pre-existing tables; never assume column names
- **Migration 0012 first attempt failed**: CREATE TABLE IF NOT EXISTS on existing `competitors` skipped table creation but then `CREATE INDEX ON competitors(scan_status)` failed because the column didn't exist yet — fix: use ALTER TABLE to add missing columns first, then create indexes
- **SerpAPI budget management**: `SERP_WARN_THRESHOLD=200`, `SERP_HARD_LIMIT=250`; scan endpoint returns 429 with `code:'BUDGET_EXCEEDED'` at 250+; returns 429 with `code:'LOW_CREDITS'` when `plan_searches_left < 10`; `force:true` in request body bypasses both checks for admin override
- **SerpAPI KV cache**: key `serp:{competitor_id}:{keyword_slug}:{YYYY-MM-DD}`, TTL 14 days (1,209,600 seconds); monthly usage counter in `serp-usage:{YYYY-MM}`; account credit cache in `serp-account-cache` (1-hour TTL); cache is ALWAYS checked before calling SerpAPI — never double-bill
- **SerpAPI endpoints used**: `https://serpapi.com/search.json?engine=google` for PPC/LSA detection; `https://serpapi.com/account.json` for credit check (cached 1h); `engine=google_maps` available for competitor verification
- **`normDomain()` helper**: strips protocol, `www.`, and path from URL for domain matching in SerpAPI results
- **`findDomainInResults()` helper**: checks if competitor domain appears in SerpAPI ads or organic results; returns 1-based position or null
- **Intel pane**: `pane-intel` with budget meter, Add Competitor form, competitor list (with Scan + Results buttons), Scan Results panel; `'intel'` added to `generatorSections` so staff can't see it; `SECTION_LABELS` entry added; `_esc()` HTML escape helper added for safe rendering of competitor names/domains
- **`GET /api/tenants` SQL bug**: `domains` table has NO `company_id` column — using `d.company_id = t.id` in the tenant stats subquery causes `SQLITE_ERROR: no such column` and crashes the entire Tenants page; fix: use `d.company = t.company_key` instead (domains use text key, not integer FK)
- **Auth query extended for tenant users**: original `LEFT JOIN companies co ON u.company_id = co.id` returns null `company_key` for new tenant users (whose `company_id` points to `tenants.id`, not `companies.id`); fix: add `LEFT JOIN tenants tn ON (u.company_id = tn.id AND co.id IS NULL)` with `COALESCE(co.key, tn.company_key)` — the `AND co.id IS NULL` guard prevents ID collision between `companies` and `tenants` tables
- **`GET /api/domains` null company_key guard**: when a non-super_admin user has `company_key = null` (new tenant with no company entry), return `{ total: 0, domains: [] }` instead of falling through to the unfiltered super_admin query which would expose all 33 domains
- **`showInviteModal()` async bug**: modal was shown AFTER `await fetch('/api/subscription-plans')` — if the fetch is slow or fails, the modal never appears; fix: show modal FIRST (synchronously), then load plans async with try/catch in the background
- **Domain filter tabs — category tabs hidden for company_admin**: Restoration/Renovation/Kitchen filter tabs have `class="super-nav"` and `style="display:none"` — `_applyRoleNav` shows them only for super_admin; company_admin sees only All/Active/Building/Parked/Pending tabs
- **Porkbun Registry Sync bar hidden for company_admin**: `#porkbun-sync-bar` now has `class="super-nav"` — hidden by `_applyRoleNav` for all non-super_admin roles
- **`loadCompanies()` explicit auth header**: added `Authorization: Bearer ${getStoredToken()}` to the fetch — more reliable than relying solely on cookie in all timing scenarios; prevents empty Reviews dropdown due to silent 401 failures
- **`rvInit()` company_id comparison fix**: `allCompanies.find(c => c.id === currentUser.company_id)` can fail due to type mismatch (DB returns integer, JS might have string); fix: use `String(c.id) === String(currentUser.company_id)` for safe comparison; also rebuilds dropdown every time Reviews tab opens (not only when empty)
- **Business Prospector built (2026-03-29)**: 3-source search (Google Places API `searchText`, SerpAPI `engine=google_maps`, website scraper); SLM Opportunity Score calculated at runtime (not stored in DB column); results persisted to `scraped_businesses` table; prospect pipeline in `scraped_businesses` with status workflow; CSV export via `GET /api/prospector/export`
- **`scraped_businesses` has no UNIQUE constraint**: each search run inserts fresh records; duplicate check in `POST /api/prospector/save` uses `business_name + city` match to avoid double-saving; do NOT add `ON CONFLICT DO NOTHING` without adding a UNIQUE index first
- **SLM Opportunity Score not stored in DB**: `slm_score` is calculated at runtime in `calcSlmScore()` using stored fields (`website_url`, `google_rating`, `google_review_count`, `facebook_url`, `instagram_url`, `linkedin_url`, `phone`, `email`); score must be recalculated whenever any of those fields change; never cache the score permanently
- **`CITY_COORDS` lookup table**: 28 major Canadian + US cities mapped to lat/lng for Google Places API location bias; if city not in table, Places API still works but without coordinate bias
- **Website scraping for prospector**: plain `fetch()` + regex with 8s timeout and 250KB HTML limit (same pattern as brand profile scraper); extracts email, Facebook, Instagram, LinkedIn; works for static/SSR sites; JS-heavy SPAs return limited data
- **Prospector is super_admin only**: `🔭 Prospector` nav item has `class="super-nav"` and `style="display:none"` — `_applyRoleNav` shows it only for super_admin; all 6 backend endpoints require `super_admin` role
- **`openOnboardModal(idx)`**: navigates to Tenants tab, opens invite modal, pre-fills name + email + notes from prospector result; relies on `showInviteModal()` being globally available

---

## TENANT SYSTEM DOCTRINE

SLM Hub is a white-label multi-tenant SaaS platform. Three-tier role hierarchy:

1. **`super_admin` (Nasser)** — God mode, sees all tenants, all data, all companies. No `company_id`. Bypasses all tenant isolation filters. Can impersonate any tenant for support.
2. **`company_admin`** — Tenant, pays monthly subscription. Sees only their own company data (`WHERE company_id = user.company_id`). Can invite staff. Manages their own domains and campaigns.
3. **`staff`** — Tenant employee. Read-only access to leads and reporting. Cannot manage domains, campaigns, or invite users. Same `company_id` as their admin.

**Tenant onboarding flow:**
1. super_admin invites → `POST /api/tenants/invite` → tenant record created (status: `pending`) → 7-day token stored in `tenant_invitations` → email sent via MailChannels
2. Tenant opens `https://slm-hub.ca/invite/{token}` → frontend validates token at `GET /api/invite/{token}` → signup form shown
3. Tenant submits name + password → `POST /api/invite/{token}/accept` → user created + tenant activated + session cookie set → redirect to `/app`
4. company_admin can invite staff via Settings tab → `POST /api/team/invite` → same accept flow with `role=staff`

**Tenant isolation rule:** ALL data queries must be scoped by `company_id` for non-super_admin users. Every route that reads companies, domains, leads, reviews, or campaigns must apply the filter. super_admin sees everything without filters.

**Plan limits:** Never hardcode. Read `max_domains` and `max_users` from `tenants` table. Read plan features from `subscription_plans` table.

**Invitation tokens:** 32-byte hex (64 chars), single-use, 7-day expiry. Invalidated on acceptance.

---

## SERPAPI BUDGET DOCTRINE

SerpAPI free plan: **250 searches/month**. Every search costs 1 credit. This budget must be protected at all times.

**Hard limit:** 250 searches/month tracked in KV (`serp-usage:{YYYY-MM}`). When usage ≥ 250, all scan requests return `429 BUDGET_EXCEEDED` unless `force: true` is passed.

**Warning threshold:** At 200 searches, every scan response includes `budget_warning` string and the UI budget bar turns amber.

**Low credits check:** Before each scan, `GET /api/intel/budget` checks live SerpAPI account credits (cached 1h in KV). If `plan_searches_left < 10`, returns `429 LOW_CREDITS`.

**Admin override:** `{ force: true }` in POST body bypasses both the monthly cap and the low-credits block. Only use for critical one-off scans.

**Cache before call:** KV cache key `serp:{competitor_id}:{keyword_slug}:{YYYY-MM-DD}` with 14-day TTL. If a cached result exists for today, it is returned immediately — no SerpAPI call, no credit spent. `force: true` bypasses cache as well.

**Scan cadence:** Scan every 14 days per competitor, not 7. Do not add cron jobs that scan all competitors automatically — this eats the budget. All scans are manual (user-initiated) unless explicitly scheduled by the super_admin.

**SERPAPI_KEY secret:** Set via `echo "KEY" | npx wrangler pages secret put SERPAPI_KEY --project-name services-leads-marketing-hub` — then redeploy. Key type: `SERPAPI_KEY: string` in `Bindings`.

---

## BUSINESS PROSPECTOR DOCTRINE

The Business Prospector (`🔭 Prospector`) is a super_admin-only lead generation tool that searches for businesses with weak digital presence and scores them by opportunity.

**SLM Opportunity Score (0–100):**
| Signal | Points |
|--------|--------|
| No website | +30 |
| Google rating < 4.0 | +20 |
| Google reviews < 10 | +15 |
| No social media (no FB + no IG + no LinkedIn) | +15 |
| Has phone but no email | +10 |

**Tiers:**
- 🔥 **Hot** (70–100): Weak digital presence, high opportunity — prioritise these
- ♨️ **Warm** (40–69): Some gaps, worth contacting
- 🧊 **Cold** (0–39): Already well-marketed — low priority

**Score is calculated at runtime** from stored fields. It is not a DB column.

**3-source search order:**
1. Google Places API (`searchText`) — primary source, location-biased
2. SerpAPI (`engine=google_maps`) — enrichment for businesses Places missed
3. Website scraper (`fetch()` + regex) — runs on up to 10 results to extract email/social; respects 8s timeout + 250KB HTML cap

**Prospect Pipeline workflow:**
`new` → `contacted` → `qualified` → `converted` (or `lost`)

**One-click actions from search results:**
- **Save as Prospect**: stores to `scraped_businesses`, shows in Pipeline
- **Add as Competitor**: stores to `competitors` table with SerpAPI scan pending
- **Onboard Client**: navigates to Tenants tab, opens invite modal pre-filled with business name + email + notes

**Data rules:**
- Never display invented contact info — only show what was found via API or scrape
- CSV export includes all prospect fields for outreach use
- Searching does not require GDPR consent — only sending outreach emails does

---

## DATA PERMISSION DOCTRINE

All content generation for tenant (company_admin) accounts requires two pre-conditions:

1. **Permission granted** — `data_permissions.permission_granted = 1` AND `revoked_at IS NULL`. The company_admin must explicitly accept the Data Usage Authorization disclaimer (v1.0). This is a legal/compliance requirement, not optional.

2. **Brand profile complete** — `company_websites.scrape_status = 'completed'`. The company's website must have been scanned (auto or manual entry) so generators have real brand data to work with.

**Super admin bypasses both checks.** All other roles are checked at every generate endpoint.

**Authorization flow:**
1. company_admin first login → `#permission-gate` full-screen overlay shown
2. "I Authorize" → `POST /api/permissions/grant` → saves IP, timestamp, disclaimer version → gate dismissed → redirect to Brand Profile
3. "Review Later" → amber `#perm-banner` shown → sessionStorage `slm_perm_review_later` set → generation blocked
4. After granting: scan website via `POST /api/scraper/scan` or manual entry via `PATCH /api/scraper/brand-profile` → `scrape_status = 'completed'` → generation unlocked

**Revocation:**
- Settings → Data & Privacy → Revoke Authorization → `POST /api/permissions/revoke` → `revoked_at` set → generation immediately disabled
- Re-authorize via Settings → Data & Privacy → "Re-authorize Now" → shows `#permission-gate` again

**Scraper data use in generation:**
- `brand_colors` → overrides LP template colors
- `contact_info.phone` → fills company phone if empty in companies table
- `scrape_status` logged in HTML audit comment: `<!-- SLM-AUDIT: generated=ISO company_id=N scrape_status=completed permission=v1.0 -->`

**No invented data:** Claude prompts in all generators must include company data pulled exclusively from `company_websites` and `companies` D1 tables. Never invent services, phone numbers, colors, or testimonials.

**GDPR export:** `GET /api/permissions/download` returns all personal data as JSON. Available in Settings → Data & Privacy.

---

## GOOGLE REVIEWS DOCTRINE

All reviews displayed on landing pages must be pulled from Google Business Profile via Google Places API (New). Zero fake reviews are permitted under any circumstance.

- **Source**: Google Places API (New) — `GET https://places.googleapis.com/v1/places/{placeId}` with `X-Goog-FieldMask: reviews`
- **Minimum rating for display**: 4 stars — reviews below 4 stars are never stored or shown
- **Minimum text length**: 50 characters — empty and one-word reviews are discarded
- **Featured reviews**: top 5 by rating DESC then date DESC — auto-assigned on sync; admin can manually override via featured toggle
- **Cache**: D1 is the source of truth; KV caches featured reviews per company with 24-hour TTL; sync invalidates cache
- **No real reviews**: show admin placeholder `rv-placeholder` — never show fake names, never fabricate content
- **LP checklist**: every LP generation runs `validateLP()` — warns if no real reviews connected
- **API key required**: `GOOGLE_PLACES_API_KEY` secret in CF Pages — set via `echo "KEY" | npx wrangler pages secret put GOOGLE_PLACES_API_KEY --project-name services-leads-marketing-hub` then redeploy

---

## CONVERSION DOCTRINE

Every output this platform generates — landing pages, blog posts, SEO content, ad copy, email sequences — exists for one purpose: conversion. A conversion is a phone call, form submission, click, or booked appointment. Never generate content that does not have a clear conversion path. Every landing page has one goal. Every blog post ends with a CTA. Every ad headline earns its character. SEO is not vanity traffic — it is organic lead generation. Quality Score, click-through rate, and conversion rate are the only metrics that matter. If a piece of content does not move someone closer to converting, it does not belong in this platform.

---

## SEO LINKING DOCTRINE

Every piece of content generated must follow this linking structure:

### Internal Links
- Minimum 2 internal links per blog post pointing to service or landing pages — never just to other blog posts
- Every landing page links back to the main company domain
- Anchor text must match target keywords — never use "click here" or "read more"
- Build topical clusters — service pages, location pages, and blog posts interlinked as one authoritative hub

### External Links
- Minimum 2 authoritative outbound links per content piece
- Link to industry authorities relevant to the niche:
  - **Restoration:** IICRC.org, EPA.gov, insurance carriers
  - **Renovation:** building codes, permit offices, NARI
  - **Kitchen:** NKBA, manufacturer specs, material standards
- All external links open in a new tab (`target="_blank"`)
- Never link to competitors under any circumstance
- External links signal research, trust, and authority to Google
- Pages with zero outbound links look untrustworthy to search engines

---

## SLM.md MAINTENANCE RULE

SLM.md is a living document. It must be updated every single session without exception. After every build, fix, or feature added, Claude Code must:

1. Add any new lessons learned to the LESSONS LEARNED section
2. Update any changed infrastructure details (URLs, IDs, bindings)
3. Add any new architectural decisions made during the session
4. Add any bugs found and how they were fixed
5. Commit the updated SLM.md with every push — never push code without also pushing an updated SLM.md

If SLM.md is not updated, the next session starts blind. An outdated SLM.md is a failed session regardless of what code was written. Treat SLM.md like a captain's log — every session gets an entry, every decision gets recorded.

---

## DOMAIN OWNERSHIP DOCTRINE (Model A — Locked)

All domains registered and deployed through this platform are owned by Fire Ventures Enterprise. This is non-negotiable and applies to every client onboarded regardless of company size.

### Ownership Rules
- Fire Ventures Enterprise registers all domains
- Clients are granted a usage license as part of their monthly platform subscription
- If a client cancels or is removed, all domains remain the property of Fire Ventures Enterprise
- Domains are platform infrastructure assets — not client assets
- Contracts must explicitly state: domains are licensed, not sold
- Client may purchase a domain outright at Fire Ventures Enterprise discretion for a separate negotiated fee

### Territory Protection
- No two clients can hold the same territory + keyword combination
- Territory is defined by city, region, or postal code zone
- When a new domain is added, the platform checks for territory conflicts automatically
- Conflicting territories are flagged and blocked until resolved
- Super admin resolves all territory conflicts
- Available angles for same-city clients:
  1. Geographic segmentation (different zones/suburbs)
  2. Niche segmentation (luxury vs budget vs specialty)
  3. Service segmentation (different service lines)

### Geographic Segmentation Rule
Multiple clients in the same niche must be separated by:
- Distinct geographic territory (city, suburb, postal zone)
- OR distinct niche angle (luxury, budget, specialty)
- OR distinct service line (different services, not competing)

Never run two clients bidding on identical keyword + location. This protects all clients and maintains platform integrity.

### Database Requirements
The `domains` table must include `territory` and `niche_angle` fields so conflicts can be detected automatically.
