// Database handle. Production uses Bun's native Postgres (`drizzle-orm/bun-sql`)
// against DATABASE_URL. Tests use PGlite (`drizzle-orm/pglite`) for a
// deterministic in-process Postgres and cast it to `Database` — both drivers
// share one drizzle query-builder API, so repositories are written once.

import { drizzle } from "drizzle-orm/bun-sql"

/** Create the production database handle from a Postgres connection string. */
export function createDatabase(connectionString: string) {
  return drizzle(connectionString)
}

/** The drizzle handle repositories operate on (the Bun-SQL concrete type). */
export type Database = ReturnType<typeof createDatabase>
