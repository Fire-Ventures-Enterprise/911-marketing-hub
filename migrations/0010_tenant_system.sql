-- Migration 0010: Tenant system tables
-- Status: ALREADY APPLIED DIRECTLY ON PRODUCTION (2026-03-29)
-- These tables were created directly in D1 before this migration file was written.
-- Do NOT run this file on production — it will fail with "table already exists".
-- This file documents the schema for fresh-DB setups and version control.

-- White-label multi-tenant SaaS infrastructure.
-- Role hierarchy: super_admin → company_admin (tenant) → staff

CREATE TABLE IF NOT EXISTS tenants (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT    NOT NULL,
  company_key  TEXT    UNIQUE NOT NULL,
  plan         TEXT    DEFAULT 'starter',
  status       TEXT    DEFAULT 'pending',   -- pending | active | suspended | cancelled
  invited_by   INTEGER,
  invited_at   TEXT,
  activated_at TEXT,
  billing_email TEXT,
  monthly_fee  REAL    DEFAULT 0,
  max_domains  INTEGER DEFAULT 10,
  max_users    INTEGER DEFAULT 5,
  notes        TEXT,
  created_at   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_invitations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   INTEGER,
  email       TEXT    NOT NULL,
  role        TEXT    DEFAULT 'company_admin',
  token       TEXT    UNIQUE NOT NULL,
  status      TEXT    DEFAULT 'pending',   -- pending | accepted | expired
  invited_by  INTEGER NOT NULL,
  invited_at  TEXT    NOT NULL,
  accepted_at TEXT,
  expires_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  price_monthly REAL    NOT NULL,
  max_domains   INTEGER NOT NULL,
  max_users     INTEGER NOT NULL,
  features      TEXT,
  active        INTEGER DEFAULT 1
);

-- Seeded plans (already in production)
-- INSERT OR IGNORE INTO subscription_plans (name, price_monthly, max_domains, max_users, features) VALUES
--   ('Starter', 297,  5,   3,  '["5 EMDs","Landing Page Generator","Lead Capture","Basic Analytics"]'),
--   ('Growth',  597,  15,  8,  '["15 EMDs","All Generators","Google Ads Integration","Review Sync","Priority Support"]'),
--   ('Pro',     997,  33,  15, '["33 EMDs","All Features","Multi-Platform Ads","White Label Reports","Dedicated Support"]'),
--   ('Agency',  1997, 100, 50, '["Unlimited EMDs","Full Platform Access","API Access","Custom Branding","SLA Support"]');

CREATE INDEX IF NOT EXISTS idx_tenants_status     ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan        ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_invitations_token   ON tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email   ON tenant_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant  ON tenant_invitations(tenant_id);
