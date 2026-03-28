# 🚨 Services Leads Marketing Hub
## Ottawa EMD Army Command Center — v2.0.0

Internal marketing automation platform for 3 Ottawa-based companies:
| Brand | Type | Phone | Domain |
|-------|------|-------|--------|
| 🚨 911 Restoration Ottawa | Emergency water/mold/fire restoration | (613) 909-9911 | 911restorationottawa.ca |
| 🔨 911 Renovation | Home & commercial renovation | (613) 909-9911 | 911renovation.ca |
| 🍳 Ottawa Kitchen Cabinetry | Custom kitchen design & cabinetry | (613) 800-5555 | ottawakitchencabinetry.ca |

## 🌐 Live Sandbox
```
https://3000-imjgdr8hcxnvy483vlw04-6532622b.e2b.dev/
https://3000-imjgdr8hcxnvy483vlw04-6532622b.e2b.dev/app
https://3000-imjgdr8hcxnvy483vlw04-6532622b.e2b.dev/serviceleads
```

## 📊 Domain Army
- **16** Emergency/Restoration domains
- **4** Renovation domains
- **13** Kitchen/Cabinetry domains
- **33 Total** | 17 Active | 11 Building | 5 Parked

## 🛠️ Tech Stack
- **Backend:** Hono v4 + TypeScript
- **Runtime:** Cloudflare Workers/Pages
- **Build:** Vite + @hono/vite-build
- **Dev Process:** PM2
- **Storage:** Cloudflare KV + D1

## 📁 Project Structure
```
911-marketing-hub/
├── src/
│   ├── index.tsx          ← Hono backend: all routes, generators, company data
│   ├── pages.ts           ← Auto-generated: inlined HTML (run build-inline.js)
│   └── renderer.tsx       ← JSX renderer
├── public/
│   └── static/
│       ├── app.html       ← 7-tab Marketing Hub UI
│       ├── app.js         ← Frontend JavaScript
│       └── serviceleads.html ← Google API application page
├── build-inline.js        ← Inlines HTML into pages.ts pre-build
├── ecosystem.config.cjs   ← PM2 process manager config
├── wrangler.jsonc         ← Cloudflare Workers/Pages config
├── vite.config.ts         ← Vite build config
├── tsconfig.json
└── package.json
```

## 🚀 Quick Start
```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
node build-inline.js && npm run build

# Deploy to Cloudflare Pages
npm run deploy

# Run with PM2
pm2 start ecosystem.config.cjs
```

## 🔌 API Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/status | Health check + feature flags |
| GET | /api/domains | All 33 EMD domains with metadata |
| POST | /api/generate/landing-page | Generate LP HTML for domain |
| POST | /api/generate/ads-campaign | Generate Google Ads campaign JSON |
| POST | /api/generate/seo-content | Generate full SEO package |
| GET | /api/auth/google | Start Google OAuth 2.0 flow |
| GET | /api/auth/google/callback | OAuth callback handler |
| POST | /api/google-ads/push | Push campaign to Google Ads API v18 |
| GET | /api/google-ads/history | Push history from KV |
| POST | /api/deploy/landing-page | Deploy landing page to Cloudflare Pages |
| POST | /api/leads | Capture inbound lead |
| GET | /api/leads | List leads (requires auth) |

## 🔐 Environment Variables
```env
# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_CUSTOMER_ID=

# Cloudflare
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=

# Telegram Notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Meta Ads
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=
```

## 🗄️ Cloudflare Bindings Required
Add to wrangler.jsonc after creating:
```bash
# Create KV namespace
wrangler kv:namespace create KV

# Create D1 database
wrangler d1 create 911-marketing-hub-production
```

## 📋 Company Config
| Company Key | Brand | Phone | Target CPA | Colors |
|-------------|-------|-------|-----------|--------|
| `Restoration` | 911 Restoration Ottawa | (613) 909-9911 | $65 | #1A1A2E / #CC0000 |
| `Renovation` | 911 Renovation | (613) 909-9911 | $120 | #0A1628 / #F59E0B |
| `Kitchen` | Ottawa Kitchen Cabinetry | (613) 800-5555 | $95 | #1C1408 / #D97706 |

## 🎯 Priority Roadmap
| Priority | Feature | Status |
|----------|---------|--------|
| 🔴 P1 | Real Google Ads API v18 push | Needs credentials |
| 🔴 P2 | Domain deployment to Cloudflare Pages | Needs CF API token |
| 🟡 P3 | Telegram lead notifications | Needs bot token |
| 🟡 P4 | Meta Ads push | Needs Meta access token |
| 🟢 P5 | Performance dashboard with real metrics | After P1 |

## 🔧 Database Schema (D1)
```sql
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  email TEXT,
  message TEXT,
  source TEXT,
  keyword TEXT,
  company TEXT,
  ip TEXT,
  timestamp TEXT
);
```

---
**Built by Fire Ventures Enterprise | Ottawa, Canada**
