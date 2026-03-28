-- 911 Marketing Hub — Auth Schema
-- Run: wrangler d1 execute 911-marketing-hub-production --file=migrations/0003_auth.sql --remote

-- ── users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT    PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'staff',
  company_id    INTEGER          REFERENCES companies(id),
  name          TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL,
  last_login    TEXT             DEFAULT NULL,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role       ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- ── sessions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token      ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ── Seed: Super Admin ──────────────────────────────────────────────────────
-- Nasser Oweis — company_id NULL means God Mode (all tenants)
-- Initial password: Admin@SLM2024!  (change on first login)
-- Hash: PBKDF2-SHA256, 100k iterations, fixed seed salt
INSERT OR IGNORE INTO users (id, email, password_hash, role, company_id, name, created_at, active)
VALUES (
  'usr_superadmin_001',
  'noweis2020@gmail.com',
  'pbkdf2:b3c7a1f92e4d08561a2b3c4d5e6f7a8b:0e1da1a4dd506be5c4b05ed5a397a95fa89dfdbc10e8a72c6ee8565fcc3bc656',
  'super_admin',
  NULL,
  'Nasser Oweis',
  '2024-01-01T00:00:00.000Z',
  1
);
