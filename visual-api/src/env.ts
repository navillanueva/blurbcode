// Server configuration loaded from the environment. Only the prod entrypoint
// (src/index.ts) and the migrate CLI use this; tests construct deps directly.

export interface ServerConfig {
  port: number
  databaseUrl: string
  tokenSigningSecret: string
  /** Allowed browser origins for CORS; null = reflect the request origin (dev). */
  corsOrigins: string[] | null
  secureCookies: boolean
  settlementMode: "mock" | "real"
  dynamic: { environmentId?: string; serverApiKey?: string }
}

function required(env: Record<string, string | undefined>, key: string): string {
  const v = env[key]?.trim()
  if (!v) throw new Error(`${key} is required`)
  return v
}

export function loadServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const corsRaw = (env.CORS_ORIGIN ?? "").trim()
  const corsOrigins = corsRaw
    ? corsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null
  const apiUrl = env.VISUALCODE_API_URL ?? ""
  return {
    port: Number(env.PORT ?? "8787") || 8787,
    databaseUrl: required(env, "DATABASE_URL"),
    tokenSigningSecret: required(env, "TOKEN_SIGNING_SECRET"),
    corsOrigins,
    secureCookies: env.NODE_ENV === "production" || /^https:/i.test(apiUrl),
    settlementMode: env.SETTLEMENT_MODE === "real" ? "real" : "mock",
    dynamic: {
      environmentId: env.DYNAMIC_ENVIRONMENT_ID?.trim() || undefined,
      serverApiKey: env.DYNAMIC_SERVER_API_KEY?.trim() || undefined,
    },
  }
}
