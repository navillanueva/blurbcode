-- Plan 4 (v0.4) — advertiser on-chain payment hash on campaigns.
-- The fund route binds the verified advertiser→treasury payment tx to the campaign;
-- the unique partial index prevents the same payment from funding two campaigns.
-- Idempotent (matches 0000_init.sql style); applied by src/db/migrate.ts on start.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS payment_tx_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS campaigns_payment_tx_hash_uniq
  ON campaigns (payment_tx_hash) WHERE payment_tx_hash IS NOT NULL
