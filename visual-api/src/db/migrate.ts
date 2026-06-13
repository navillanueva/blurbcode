// Schema migration runner. Reads the canonical SQL in drizzle/0000_init.sql and
// applies it statement-by-statement so it works on any driver (Postgres + PGlite)
// without depending on a driver-specific migrator. The DDL is idempotent
// (CREATE ... IF NOT EXISTS), so applying it repeatedly is safe.

import { sql } from "drizzle-orm"
import type { Database } from "./index"

/** Split a multi-statement SQL file into individual statements (no internal ';'). */
export function splitStatements(sqlText: string): string[] {
  return sqlText
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/--.*$/gm, "").trim())
    .filter((s) => s.length > 0)
}

/** Apply the initial schema to a database. Idempotent. */
export async function applySchema(db: Database): Promise<void> {
  const url = new URL("../../drizzle/0000_init.sql", import.meta.url)
  const text = await Bun.file(url).text()
  for (const stmt of splitStatements(text)) {
    await db.execute(sql.raw(stmt))
  }
}
