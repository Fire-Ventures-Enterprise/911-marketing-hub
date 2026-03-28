-- 911 Marketing Hub — Seed Data
-- Run: wrangler d1 execute 911-marketing-hub-production --file=migrations/0002_seed.sql --remote

-- ── Schema: companies ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  key          TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  domain       TEXT NOT NULL,
  budget       INTEGER NOT NULL,
  target_cpa   INTEGER NOT NULL,
  color_bg     TEXT NOT NULL,
  color_accent TEXT NOT NULL,
  callouts     TEXT NOT NULL,  -- JSON array
  sitelinks    TEXT NOT NULL   -- JSON array
);

-- ── Schema: domains ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domains (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  domain   TEXT NOT NULL UNIQUE,
  keyword  TEXT NOT NULL,
  service  TEXT NOT NULL,
  budget   INTEGER NOT NULL,
  status   TEXT NOT NULL DEFAULT 'Active',
  priority INTEGER NOT NULL DEFAULT 3,
  notes    TEXT NOT NULL DEFAULT '',
  company  TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domains_company  ON domains(company);
CREATE INDEX IF NOT EXISTS idx_domains_status   ON domains(status);
CREATE INDEX IF NOT EXISTS idx_domains_category ON domains(category);

-- ── Seed: companies (3) ────────────────────────────────────────────────────
INSERT OR IGNORE INTO companies (key, name, phone, domain, budget, target_cpa, color_bg, color_accent, callouts, sitelinks) VALUES
(
  'Restoration',
  '911 Restoration Ottawa',
  '(613) 909-9911',
  '911restorationottawa.ca',
  35, 65,
  '#1A1A2E', '#CC0000',
  '["IICRC Certified","45-Min Response","24/7 Emergency","Insurance Direct Billing","Free Inspection"]',
  '[{"text":"Free Inspection","url":"/free-inspection"},{"text":"Water Damage","url":"/water-damage"},{"text":"Mold Removal","url":"/mold-removal"},{"text":"Fire Damage","url":"/fire-damage"}]'
),
(
  'Renovation',
  '911 Renovation',
  '(613) 909-9911',
  '911renovation.ca',
  25, 120,
  '#0A1628', '#F59E0B',
  '["Licensed & Insured","Free Estimates","Ottawa Local","10-Year Warranty","Senior Discounts"]',
  '[{"text":"Free Estimate","url":"/free-estimate"},{"text":"Basement Reno","url":"/basement-renovation"},{"text":"Kitchen Reno","url":"/kitchen-renovation"},{"text":"Bathroom Reno","url":"/bathroom-renovation"}]'
),
(
  'Kitchen',
  'Ottawa Kitchen Cabinetry',
  '(613) 800-5555',
  'ottawakitchencabinetry.ca',
  25, 95,
  '#1C1408', '#D97706',
  '["Custom Cabinets","Free Design Consult","Solid Wood","15-Year Warranty","Ottawa Factory Direct"]',
  '[{"text":"Free Design Consult","url":"/free-design"},{"text":"Kitchen Cabinets","url":"/kitchen-cabinets"},{"text":"Cabinet Refacing","url":"/cabinet-refacing"},{"text":"Gallery","url":"/gallery"}]'
);

-- ── Seed: domains (33) ─────────────────────────────────────────────────────
-- Emergency / Restoration (16)
INSERT OR IGNORE INTO domains (domain, keyword, service, budget, status, priority, notes, company, category) VALUES
('basementfloodedottawa.com',  'basement flooded ottawa',    'Emergency Basement Flood Extraction',  35, 'Active',   1, 'Top converter', 'Restoration', 'emergency'),
('waterdamageottawa.ca',       'water damage ottawa',        'Water Damage Restoration',             35, 'Active',   1, 'High volume',   'Restoration', 'emergency'),
('ottawawaterdamage.com',      'ottawa water damage',        'Water Damage Cleanup Ottawa',          35, 'Active',   1, '',              'Restoration', 'emergency'),
('moldinspectionottawa.ca',    'mold inspection ottawa',     'Professional Mold Inspection',         30, 'Active',   2, '',              'Restoration', 'emergency'),
('moldremovalottawa.ca',       'mold removal ottawa',        'Mold Removal & Remediation',           30, 'Active',   2, '',              'Restoration', 'emergency'),
('ottawamoldremoval.com',      'ottawa mold removal',        'Ottawa Mold Remediation',              30, 'Active',   2, '',              'Restoration', 'emergency'),
('firerestorationottawa.ca',   'fire restoration ottawa',    'Fire Damage Restoration',              35, 'Active',   1, '',              'Restoration', 'emergency'),
('sewagebackupottawa.com',     'sewage backup ottawa',       'Emergency Sewage Backup Cleanup',      35, 'Building', 2, '',              'Restoration', 'emergency'),
('emergencyplumberottawa.ca',  'emergency plumber ottawa',   'Emergency Water Extraction',           35, 'Building', 2, '',              'Restoration', 'emergency'),
('floodcleanupottawa.ca',      'flood cleanup ottawa',       'Flood Cleanup & Restoration',          35, 'Active',   2, '',              'Restoration', 'emergency'),
('basementleakottawa.com',     'basement leak ottawa',       'Basement Leak Detection & Repair',     30, 'Building', 3, '',              'Restoration', 'emergency'),
('wetbasementottawa.ca',       'wet basement ottawa',        'Wet Basement Waterproofing',           30, 'Building', 3, '',              'Restoration', 'emergency'),
('roofleakottawa.com',         'roof leak ottawa',           'Emergency Roof Leak Repair',           30, 'Building', 3, '',              'Restoration', 'emergency'),
('biohazardcleanupottawa.ca',  'biohazard cleanup ottawa',   'Biohazard & Crime Scene Cleanup',      35, 'Parked',   4, '',              'Restoration', 'emergency'),
('asbestosremovalottawa.ca',   'asbestos removal ottawa',    'Asbestos Testing & Removal',           30, 'Parked',   4, '',              'Restoration', 'emergency'),
('smokedamageottawa.com',      'smoke damage ottawa',        'Smoke Damage Restoration',             30, 'Building', 3, '',              'Restoration', 'emergency');

-- Renovation (4)
INSERT OR IGNORE INTO domains (domain, keyword, service, budget, status, priority, notes, company, category) VALUES
('basementrenovationottawa.ca',  'basement renovation ottawa',  'Basement Renovation & Finishing',   25, 'Active',   1, '', 'Renovation', 'renovation'),
('homeadditionsottawa.ca',       'home additions ottawa',       'Home Additions & Extensions',        25, 'Active',   2, '', 'Renovation', 'renovation'),
('bathroomrenovationottawa.ca',  'bathroom renovation ottawa',  'Bathroom Renovation Services',       25, 'Building', 2, '', 'Renovation', 'renovation'),
('kitchenrenovationottawa.ca',   'kitchen renovation ottawa',   'Kitchen Renovation & Remodeling',    25, 'Building', 2, '', 'Renovation', 'renovation');

-- Kitchen / Cabinetry (13)
INSERT OR IGNORE INTO domains (domain, keyword, service, budget, status, priority, notes, company, category) VALUES
('kitchencabinetsottawa.ca',         'kitchen cabinets ottawa',         'Custom Kitchen Cabinets Ottawa',      25, 'Active',   1, '', 'Kitchen', 'kitchen'),
('ottawakitchencabinets.com',        'ottawa kitchen cabinets',         'Ottawa Kitchen Cabinet Design',       25, 'Active',   1, '', 'Kitchen', 'kitchen'),
('customkitchensottawa.ca',          'custom kitchens ottawa',          'Custom Kitchen Design & Install',     25, 'Active',   1, '', 'Kitchen', 'kitchen'),
('kitchenremodelingottawa.ca',       'kitchen remodeling ottawa',       'Kitchen Remodeling Services',         25, 'Active',   2, '', 'Kitchen', 'kitchen'),
('cabinetrefacingottawa.com',        'cabinet refacing ottawa',         'Cabinet Refacing & Resurfacing',      20, 'Active',   2, '', 'Kitchen', 'kitchen'),
('ottawacabinetmakers.com',          'ottawa cabinet makers',           'Custom Cabinet Makers Ottawa',        20, 'Building', 2, '', 'Kitchen', 'kitchen'),
('kitchendesignottawa.ca',           'kitchen design ottawa',           'Kitchen Design Consultation',         20, 'Building', 3, '', 'Kitchen', 'kitchen'),
('shaker-cabinets-ottawa.com',       'shaker cabinets ottawa',          'Shaker Style Kitchen Cabinets',       20, 'Building', 3, '', 'Kitchen', 'kitchen'),
('rta-cabinets-ottawa.ca',           'rta cabinets ottawa',             'RTA Kitchen Cabinets Ottawa',         20, 'Parked',   4, '', 'Kitchen', 'kitchen'),
('paintedkitchencabinets-ottawa.com','painted kitchen cabinets ottawa', 'Painted Kitchen Cabinets',            20, 'Parked',   4, '', 'Kitchen', 'kitchen'),
('kitchencountertopsottawa.ca',      'kitchen countertops ottawa',      'Kitchen Countertops & Surfaces',      20, 'Building', 3, '', 'Kitchen', 'kitchen'),
('ottawakitchenrenovations.com',     'ottawa kitchen renovations',      'Ottawa Kitchen Renovations',          25, 'Active',   2, '', 'Kitchen', 'kitchen'),
('affordablekitchensottawa.ca',      'affordable kitchens ottawa',      'Affordable Kitchen Solutions Ottawa', 20, 'Parked',   4, '', 'Kitchen', 'kitchen');
