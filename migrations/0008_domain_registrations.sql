-- 0008_domain_registrations.sql
-- domain_registrations table already existed with a base schema.
-- This migration adds Porkbun sync columns and indexes.
-- Run: npx wrangler d1 execute 911-marketing-hub-production --file=migrations/0008_domain_registrations.sql --remote
--
-- Existing columns (DO NOT re-add):
--   id, company_id, domain, tld, registrar, registrar_order_id, status,
--   registered_at, expires_at, auto_renew, purchase_price, renewal_price,
--   dns_configured, landing_page_created, lead_form_active, created_at

ALTER TABLE domain_registrations ADD COLUMN whois_privacy INTEGER NOT NULL DEFAULT 1;
ALTER TABLE domain_registrations ADD COLUMN security_lock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE domain_registrations ADD COLUMN labels        TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE domain_registrations ADD COLUMN domain_id     INTEGER REFERENCES domains(id);
ALTER TABLE domain_registrations ADD COLUMN imported_at   TEXT;
ALTER TABLE domain_registrations ADD COLUMN updated_at    TEXT;

-- Back-fill timestamps on existing rows
UPDATE domain_registrations SET imported_at = created_at, updated_at = created_at WHERE imported_at IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_domreg_domain     ON domain_registrations(domain);
CREATE INDEX IF NOT EXISTS idx_domreg_status     ON domain_registrations(status);
CREATE INDEX IF NOT EXISTS idx_domreg_expires_at ON domain_registrations(expires_at);
CREATE INDEX IF NOT EXISTS idx_domreg_company_id ON domain_registrations(company_id);
CREATE INDEX IF NOT EXISTS idx_domreg_domain_id  ON domain_registrations(domain_id);
