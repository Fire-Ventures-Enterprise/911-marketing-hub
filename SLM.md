# SLM — Services Leads Marketing Hub

## PROJECT
**Name:** Services Leads Marketing Hub
**Owner:** Fire Ventures Enterprise — Nasser Oweis (Super Admin / God Mode)
**Live URL:** https://services-leads-marketing-hub.pages.dev
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
- **Tables:** `leads`, `companies`, `domains`

### KV Namespace
- **Name:** `Services-Leads-Marketing-Hub-KV`
- **ID:** `40cccfe0b3734c3a8c16300e3300e6aa`
- **Binding:** `KV`

### Cloudflare Pages
- **Project name:** `services-leads-marketing-hub` (must be lowercase — Cloudflare requirement)
- **Output dir:** `dist` (`pages_build_output_dir` in `wrangler.jsonc`)

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
