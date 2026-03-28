-- 911 Marketing Hub — Territory & Niche Angle Schema
-- Run: wrangler d1 execute 911-marketing-hub-production --file=migrations/0006_territory_niche.sql --remote
--
-- NOTE: territory and niche_angle were added directly to D1 before this migration was written.
-- This file is the canonical documentation of those columns.
-- Running ALTER TABLE here will fail if columns already exist — that is expected on production.
-- Use this file for fresh database setups only.
--
-- IF re-running on a fresh DB (no prior direct column additions):
-- ALTER TABLE domains ADD COLUMN territory    TEXT DEFAULT NULL;
-- ALTER TABLE domains ADD COLUMN niche_angle  TEXT DEFAULT NULL;
--
-- To safely apply on any state (including production where columns already exist):
-- The columns are already present. No action required on production.

-- Index for fast territory conflict detection
CREATE INDEX IF NOT EXISTS idx_domains_territory ON domains(territory);
CREATE INDEX IF NOT EXISTS idx_domains_niche_angle ON domains(niche_angle);
