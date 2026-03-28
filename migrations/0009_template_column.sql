-- 0009_template_column.sql
-- Adds template column to domains table for LP template rotation.
-- NOTE: ALTER TABLE already applied directly to production D1 on 2026-03-28.
-- This file documents it and must be run on any fresh DB restore.
-- Run: npx wrangler d1 execute 911-marketing-hub-production --file=migrations/0009_template_column.sql --remote

ALTER TABLE domains ADD COLUMN template INTEGER DEFAULT NULL;

-- Index for finding unset templates (NULL = not yet assigned via rotation)
CREATE INDEX IF NOT EXISTS idx_domains_template ON domains(template);
