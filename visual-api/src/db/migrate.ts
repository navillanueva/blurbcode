// Schema migration runner. Applies every drizzle/*.sql file in lexical order
// (0000_init, 0001_…, …), statement-by-statement, so it works on any driver
// (Postgres + PGlite) without a driver-specific migrator. All DDL is idempotent
// (CREATE/ALTER ... IF NOT EXISTS), so applying it repeatedly — and re-running
// already-applied files — is safe.

import { readdir } from "node:fs/promises"
import { sql } from "drizzle-orm"
import type { Database } from "./index"

/** Split a multi-statement SQL file into individual statements (no internal ';'). */
export function splitStatements(sqlText: string): string[] {
  return sqlText
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/--.*$/gm, "").trim())
    .filter((s) => s.length > 0)
}

/** Apply all schema migrations (drizzle/*.sql) in order. Idempotent. */
export async function applySchema(db: Database): Promise<void> {
  const dir = new URL("../../drizzle/", import.meta.url)
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()
  for (const file of files) {
    const text = await Bun.file(new URL(file, dir)).text()
    for (const stmt of splitStatements(text)) {
      await db.execute(sql.raw(stmt))
    }
  }
}
