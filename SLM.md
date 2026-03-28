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
