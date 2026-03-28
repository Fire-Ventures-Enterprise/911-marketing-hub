-- 911 Marketing Hub — Domain Authorization Schema
-- Run: wrangler d1 execute 911-marketing-hub-production --file=migrations/0004_domain_auth.sql --remote

-- Add authorization columns to existing domains table
ALTER TABLE domains ADD COLUMN authorized       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE domains ADD COLUMN authorized_by    TEXT             DEFAULT NULL;
ALTER TABLE domains ADD COLUMN authorized_at    TEXT             DEFAULT NULL;
ALTER TABLE domains ADD COLUMN owned_by_tenant  INTEGER NOT NULL DEFAULT 0;

-- All 33 existing domains are already live — pre-authorize them all
-- authorized_by = super admin user id
UPDATE domains
SET    authorized    = 1,
       authorized_by = 'usr_superadmin_001',
       authorized_at = '2024-01-01T00:00:00.000Z';

-- Index for fast authorization queries
CREATE INDEX IF NOT EXISTS idx_domains_authorized ON domains(authorized);
