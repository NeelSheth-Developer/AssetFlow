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

-- ============================================================
-- Module tables (Screens 2–10)
-- ============================================================

ALTER TABLE users      ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT;

-- Locations cascade: building → floor → room (Screen 4 step 2)
CREATE TABLE IF NOT EXISTS locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building   TEXT NOT NULL,
  city       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS floors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  name     TEXT NOT NULL
);

-- Core asset table (Screen 4)
-- status: AVAILABLE | ALLOCATED | UNDER_MAINTENANCE | RETIRED | DISPOSED | LOST
CREATE TABLE IF NOT EXISTS assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag           TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  serial_no     TEXT,
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'AVAILABLE',
  condition     TEXT NOT NULL DEFAULT 'GOOD',
  location      TEXT,
  room_id       UUID REFERENCES rooms(id) ON DELETE SET NULL,
  is_bookable   BOOLEAN NOT NULL DEFAULT FALSE,
  purchase_date DATE,
  purchase_cost NUMERIC,
  custom_values JSONB NOT NULL DEFAULT '{}',
  retirement    JSONB,
  disposal      JSONB,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  filename    TEXT,
  mime        TEXT,
  bytes       INTEGER,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allocations (Screen 5). status: PENDING | ACTIVE | RETURN_REQUESTED | RETURNED | REJECTED
CREATE TABLE IF NOT EXISTS allocations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id             UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  holder_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  allocated_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  purpose              TEXT,
  status               TEXT NOT NULL DEFAULT 'ACTIVE',
  expected_return_date DATE,
  allocated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  return_requested_at  TIMESTAMPTZ,
  condition_on_return  TEXT,
  return_notes         TEXT,
  returned_at          TIMESTAMPTZ,
  approved_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transfers (Screen 5). status: REQUESTED | APPROVED | REJECTED
CREATE TABLE IF NOT EXISTS transfer_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  from_user       UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'REQUESTED',
  decided_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  decision_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ
);

-- Bookings (Screen 6). status: CONFIRMED | CANCELLED (Upcoming/Ongoing/Completed derived from time)
CREATE TABLE IF NOT EXISTS booking_series (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  frequency   TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  booked_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_id   UUID REFERENCES booking_series(id) ON DELETE SET NULL,
  start_ts    TIMESTAMPTZ NOT NULL,
  end_ts      TIMESTAMPTZ NOT NULL,
  purpose     TEXT,
  attendees   JSONB NOT NULL DEFAULT '[]',
  status      TEXT NOT NULL DEFAULT 'CONFIRMED',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Maintenance (Screen 7).
-- status: PENDING | APPROVED | REJECTED | TECHNICIAN_ASSIGNED | IN_PROGRESS | RESOLVED | ESCALATED
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  raised_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  issue            TEXT NOT NULL,
  issue_type       TEXT,
  priority         TEXT NOT NULL DEFAULT 'MEDIUM',
  status           TEXT NOT NULL DEFAULT 'PENDING',
  technician_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  technician_name  TEXT,
  started_at       TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  resolution_notes TEXT,
  cost             NUMERIC,
  rejected_reason  TEXT,
  escalated        JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit (Screen 8). cycle status: ACTIVE | CLOSED · item verification: PENDING | VERIFIED | DISCREPANCY | MISSING
CREATE TABLE IF NOT EXISTS audit_cycles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'ALL',
  start_date DATE,
  end_date   DATE,
  status     TEXT NOT NULL DEFAULT 'ACTIVE',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_cycle_departments (
  cycle_id      UUID NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (cycle_id, department_id)
);

CREATE TABLE IF NOT EXISTS audit_cycle_auditors (
  cycle_id UUID NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (cycle_id, user_id)
);

CREATE TABLE IF NOT EXISTS audit_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id          UUID NOT NULL REFERENCES audit_cycles(id) ON DELETE CASCADE,
  asset_id          UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  expected_location TEXT,
  verification      TEXT NOT NULL DEFAULT 'PENDING',
  notes             TEXT,
  photo_url         TEXT,
  verified_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at       TIMESTAMPTZ,
  UNIQUE (cycle_id, asset_id)
);

-- Notifications & activity (Screen 10)
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT,
  entity_type TEXT,
  entity_id   UUID,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prefs      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  description TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_status      ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category    ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_department  ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_alloc_asset        ON allocations(asset_id, status);
CREATE INDEX IF NOT EXISTS idx_alloc_holder       ON allocations(holder_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_status   ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_bookings_resource  ON bookings(resource_id, start_ts);
CREATE INDEX IF NOT EXISTS idx_bookings_user      ON bookings(booked_by, start_ts);
CREATE INDEX IF NOT EXISTS idx_maint_status       ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maint_asset        ON maintenance_requests(asset_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_cycle  ON audit_items(cycle_id, verification);
CREATE INDEX IF NOT EXISTS idx_notif_user         ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created   ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_actor     ON activity_logs(actor_id, created_at DESC);
