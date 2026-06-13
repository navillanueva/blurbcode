// `bun run migrate` — apply the schema to the configured DATABASE_URL. Safe to
// run repeatedly (idempotent DDL). Used in local dev and as a Railway deploy step.

import { createDatabase } from "./index"
import { applySchema } from "./migrate"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is required to run migrations")
  process.exit(1)
}

const db = createDatabase(url)
await applySchema(db)
console.log("✓ schema applied to", url.replace(/:\/\/[^@]*@/, "://***@"))
process.exit(0)
