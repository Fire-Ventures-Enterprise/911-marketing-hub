-- 911 Marketing Hub D1 Schema
-- Run: wrangler d1 execute 911-marketing-hub-production --file=migrations/0001_initial.sql

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  message TEXT DEFAULT '',
  source TEXT DEFAULT 'direct',
  keyword TEXT DEFAULT '',
  company TEXT DEFAULT 'Restoration',
  ip TEXT DEFAULT '',
  country TEXT DEFAULT '',
  referer TEXT DEFAULT '',
  timestamp TEXT NOT NULL,
  contacted INTEGER DEFAULT 0,
  converted INTEGER DEFAULT 0,
  notes TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_company ON leads(company);
CREATE INDEX IF NOT EXISTS idx_ts ON leads(timestamp);
