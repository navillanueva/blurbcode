-- Server-observed ad clicks. A row is written only when the browser actually hits
-- GET /api/click/:campaignId (the redirect endpoint), so the count is server-attested
-- rather than client-reported like impressions. MEASUREMENT-ONLY — accounting credits
-- impressions, not clicks. Idempotent (matches the 0001/0002 style); applied by
-- src/db/migrate.ts on start.

CREATE TABLE IF NOT EXISTS clicks (
  id text PRIMARY KEY,
  dev_account_id text NOT NULL REFERENCES accounts(id),
  campaign_id text NOT NULL REFERENCES campaigns(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clicks_dev_created_idx ON clicks (dev_account_id, created_at)
