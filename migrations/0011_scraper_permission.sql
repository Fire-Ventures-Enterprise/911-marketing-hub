-- migrations/0011_scraper_permission.sql
-- Company Website Scraper + Data Permission tables
-- ALREADY APPLIED DIRECTLY ON PRODUCTION (2026-03-29)
-- Safe to run on fresh DB with CREATE TABLE IF NOT EXISTS
-- DO NOT run on production — tables already exist

CREATE TABLE IF NOT EXISTS company_websites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL UNIQUE,
  website_url TEXT NOT NULL,
  scraped_at TEXT,
  brand_colors TEXT,       -- JSON array of hex strings e.g. ["#CC0000","#1A1A2E"]
  tone_of_voice TEXT,      -- one of: professional, friendly, urgent, authoritative, conversational, technical
  services TEXT,           -- JSON array of service name strings
  contact_info TEXT,       -- JSON object { phone, email, address }
  about_text TEXT,
  tagline TEXT,
  logo_url TEXT,
  social_links TEXT,       -- JSON object { facebook, instagram, twitter, linkedin, youtube }
  raw_content TEXT,        -- first 1500 chars of body text for tone analysis reference
  scrape_status TEXT DEFAULT 'pending'  -- pending | scanning | completed | failed
);

CREATE TABLE IF NOT EXISTS data_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL UNIQUE,
  permission_granted INTEGER DEFAULT 0,  -- 1 = granted, 0 = not granted
  granted_by TEXT,                       -- user email who granted
  granted_at TEXT,                       -- ISO timestamp
  ip_address TEXT,
  disclaimer_version TEXT DEFAULT 'v1.0',
  allowed_uses TEXT,                     -- JSON array of allowed use types
  revoked_at TEXT,                       -- NULL = not revoked
  revoked_reason TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_websites_company_id ON company_websites(company_id);
CREATE INDEX IF NOT EXISTS idx_company_websites_status ON company_websites(scrape_status);
CREATE INDEX IF NOT EXISTS idx_data_permissions_company_id ON data_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_data_permissions_granted ON data_permissions(permission_granted);
