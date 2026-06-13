// Production entrypoint. Loads config, connects Postgres (Bun native), applies
// the (idempotent) schema, builds the settlement service + Dynamic verifier, and
// serves the Hono app with Bun.serve (via the default export).

import { createApp } from "./app"
import { createDynamicVerifier } from "./auth/dynamic"
import { createDatabase } from "./db/index"
import { applySchema } from "./db/migrate"
import { loadServerConfig } from "./env"
import { createSettlementService } from "./settlement/factory"

const config = loadServerConfig()
const db = createDatabase(config.databaseUrl)
await applySchema(db)

const settlement = await createSettlementService({ mode: config.settlementMode })
const dynamicVerifier = createDynamicVerifier({
  environmentId: config.dynamic.environmentId,
  serverApiKey: config.dynamic.serverApiKey,
})

const app = createApp({
  db,
  settlement,
  dynamicVerifier,
  tokenSigningSecret: config.tokenSigningSecret,
  secureCookies: config.secureCookies,
  corsOrigins: config.corsOrigins,
})

console.log(`visual-api listening on :${config.port} (settlement=${settlement.mode})`)
for (const note of settlement.notes) console.log(`  • ${note}`)

export default { port: config.port, fetch: app.fetch }
