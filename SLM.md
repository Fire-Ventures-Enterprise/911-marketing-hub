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
- **Tables:** `leads`, `companies`, `domains`, `users`, `sessions`, `keywords`, `domain_registrations`, `lp_templates`, `domain_images`

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
