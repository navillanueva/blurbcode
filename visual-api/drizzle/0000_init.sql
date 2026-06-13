-- Visual Code backend schema (plans/CONTRACT.md "Postgres schema").
-- Source of truth for migrations. Applied by src/db/migrate.ts (statement-split
-- on ';') against both Postgres (prod, bun-sql) and PGlite (tests). Idempotent.
--
-- Additive note: `campaigns.budget_base_units` (original funded budget) is added
-- beyond the CONTRACT's minimal column list so `GET /api/campaigns` can report
-- spend = budget_base_units - budget_remaining_base_units. API shapes unchanged.

CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  address text NOT NULL UNIQUE,
  enc_private_key text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_tokens (
  token text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS campaigns (
  id text PRIMARY KEY,
  advertiser_account_id text NOT NULL REFERENCES accounts(id),
  advertiser text NOT NULL,
  text text NOT NULL,
  url text NOT NULL,
  bid_base_units numeric NOT NULL,
  budget_base_units numeric NOT NULL DEFAULT '0',
  budget_remaining_base_units numeric NOT NULL DEFAULT '0',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS impressions (
  id text PRIMARY KEY,
  dev_account_id text NOT NULL REFERENCES accounts(id),
  campaign_id text NOT NULL REFERENCES campaigns(id),
  count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS earnings (
  account_id text PRIMARY KEY REFERENCES accounts(id),
  balance_base_units numeric NOT NULL DEFAULT '0',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settlements (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id),
  amount_base_units numeric NOT NULL,
  tx_ref text,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS impressions_dev_created_idx ON impressions (dev_account_id, created_at);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status)
