// drizzle-kit config — lets `bunx drizzle-kit generate` diff future schema
// changes against src/db/schema.ts. The committed drizzle/0000_init.sql is the
// source of truth applied at runtime by src/db/migrate.ts.
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/visualcode" },
})
