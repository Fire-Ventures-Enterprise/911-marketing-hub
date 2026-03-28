-- 911 Marketing Hub — Keywords Table
-- Run: wrangler d1 execute 911-marketing-hub-production --file=migrations/0007_keywords.sql --remote

CREATE TABLE IF NOT EXISTS keywords (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id    INTEGER          REFERENCES domains(id) ON DELETE SET NULL,
  company_id   INTEGER          REFERENCES companies(id) ON DELETE SET NULL,
  keyword      TEXT    NOT NULL,
  volume       INTEGER          DEFAULT 0,
  cpc          REAL             DEFAULT 0.0,
  competition  REAL             DEFAULT 0.0,
  intent_type  TEXT    NOT NULL DEFAULT 'informational',
  match_type   TEXT    NOT NULL DEFAULT 'Phrase',
  score        INTEGER NOT NULL DEFAULT 0,
  territory    TEXT             DEFAULT NULL,
  source       TEXT             DEFAULT 'manual',
  created_at   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_keywords_domain_id  ON keywords(domain_id);
CREATE INDEX IF NOT EXISTS idx_keywords_company_id ON keywords(company_id);
CREATE INDEX IF NOT EXISTS idx_keywords_territory  ON keywords(territory);
CREATE INDEX IF NOT EXISTS idx_keywords_intent     ON keywords(intent_type);
CREATE INDEX IF NOT EXISTS idx_keywords_score      ON keywords(score DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_created_at ON keywords(created_at DESC);
