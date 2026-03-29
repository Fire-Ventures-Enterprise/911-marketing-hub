-- migrations/0012_competitor_intel.sql
-- SerpAPI competitor intelligence — adds columns to existing tables, creates competitor_scans
--
-- Existing tables (already on production, DO NOT recreate):
--   competitors     — competitor profiles
--   competitor_intel — raw intel rows (individual ad/organic hits)
--
-- Existing competitors columns:
--   id, company_id, competitor_name, website_url, google_place_id, territory, niche,
--   status, added_at, last_scanned, place_id, lat, lng, geo_radius_km, detected_by,
--   google_rating, google_review_count, google_maps_url
--
-- Run on production:
--   npx wrangler d1 execute 911-marketing-hub-production --file=migrations/0012_competitor_intel.sql --remote

-- Add SerpAPI keyword monitoring columns to competitors
ALTER TABLE competitors ADD COLUMN serp_keywords TEXT NOT NULL DEFAULT '[]';
ALTER TABLE competitors ADD COLUMN scan_status   TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE competitors ADD COLUMN notes         TEXT;

-- Aggregate scan results per competitor × keyword (one row per scan run)
CREATE TABLE IF NOT EXISTS competitor_scans (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  competitor_id          INTEGER NOT NULL,
  keyword                TEXT    NOT NULL,
  scanned_at             TEXT    NOT NULL,
  has_ppc                INTEGER NOT NULL DEFAULT 0,   -- any PPC ads active for this keyword
  has_lsa                INTEGER NOT NULL DEFAULT 0,   -- any LSA ads active
  ppc_count              INTEGER NOT NULL DEFAULT 0,
  lsa_count              INTEGER NOT NULL DEFAULT 0,
  ppc_advertisers        TEXT    NOT NULL DEFAULT '[]', -- JSON array of advertiser names/domains
  lsa_advertisers        TEXT    NOT NULL DEFAULT '[]', -- JSON array
  organic_top5           TEXT    NOT NULL DEFAULT '[]', -- JSON [{position,title,domain,snippet}]
  competitor_ppc_pos     INTEGER,                       -- NULL if competitor not bidding
  competitor_organic_pos INTEGER                        -- NULL if not in organic top 10
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_competitors_scan_status ON competitors(scan_status);
CREATE INDEX IF NOT EXISTS idx_competitor_scans_cid    ON competitor_scans(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_scans_kw     ON competitor_scans(competitor_id, keyword);
CREATE INDEX IF NOT EXISTS idx_competitor_scans_time   ON competitor_scans(scanned_at);
CREATE INDEX IF NOT EXISTS idx_competitor_intel_cid    ON competitor_intel(competitor_id);
