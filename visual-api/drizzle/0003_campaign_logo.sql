-- Ad logos (v0.6) — advertisers can attach a logo image to their blurb, and the
-- seed partner ads (Dynamic / Arc / Unlink) ship with one. Nullable: existing and
-- text-only campaigns keep working unchanged. Idempotent (matches 0002 style);
-- applied by src/db/migrate.ts on start.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS logo_url text
