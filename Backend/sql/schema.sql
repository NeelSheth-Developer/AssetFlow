-- AssetFlow — Authentication & RBAC schema (spec §3)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Remove tables left over from the initial scaffold (different shape / not in spec).
DROP TABLE IF EXISTS email_otps;
DROP TABLE IF EXISTS images;

-- If a legacy `users` table (no password_hash column) exists, replace it and its dependents.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'users' AND column_name = 'password_hash') THEN
    DROP TABLE IF EXISTS refresh_tokens CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN','ASSET_MANAGER','DEPT_HEAD','EMPLOYEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ACTIVE','INACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT UNIQUE NOT NULL,
  head_id    UUID,
  parent_id  UUID REFERENCES departments(id),
  status     TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          user_role   NOT NULL DEFAULT 'EMPLOYEE',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  status        user_status NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE departments
    ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_id)
    REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed   BOOLEAN NOT NULL DEFAULT FALSE,
  attempts   INT     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  replaced_by UUID REFERENCES refresh_tokens(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Org-setup picklist for Screen 3/4 (custom fields per category, e.g. warranty period).
CREATE TABLE IF NOT EXISTS categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  custom_fields JSONB NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_otp_user       ON password_reset_otps(user_id, consumed);
CREATE INDEX IF NOT EXISTS idx_rt_hash        ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_rt_user_active ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
