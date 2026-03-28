-- 911 Marketing Hub — Domain Authorization Correction
-- Run: wrangler d1 execute 911-marketing-hub-production --file=migrations/0005_domain_auth_correction.sql --remote
--
-- 0004 pre-authorized ALL 33 domains.
-- Correct logic: only Active domains are pre-authorized.
-- Building and Parked domains stay at authorized = 0 until tenant approves.

UPDATE domains
SET    authorized    = 0,
       authorized_by = NULL,
       authorized_at = NULL
WHERE  status IN ('Building', 'Parked');

-- Result: Active=16 authorized=1, Building=12 authorized=0, Parked=5 authorized=0
