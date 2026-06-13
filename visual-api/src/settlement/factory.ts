// Picks the settlement implementation. Default = mock (no vendor SDKs, no chain).
// The real path is loaded via a *dynamic* import with a non-literal specifier so
// that (a) mock runs never load @unlink-xyz/sdk / @circle-fin/x402-batching, and
// (b) the Unlink-dependent module stays out of the default typecheck graph — the
// Unlink SDK is not on the public npm registry, so it can't be installed in every
// environment. Real mode fails visibly if the module/SDKs are unavailable.

import { createMockSettlementService } from "./mock"
import type { SettlementService } from "./service"

export interface CreateSettlementOptions {
  mode: "mock" | "real"
  env?: Record<string, string | undefined>
}

interface RealModule {
  createRealSettlementService(env: Record<string, string | undefined>): Promise<SettlementService>
}

export async function createSettlementService(opts: CreateSettlementOptions): Promise<SettlementService> {
  if (opts.mode !== "real") return createMockSettlementService()
  const spec = "./real"
  try {
    const mod = (await import(spec)) as RealModule
    return await mod.createRealSettlementService(opts.env ?? process.env)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    throw new Error(
      `SETTLEMENT_MODE=real but the real settlement module could not be loaded ` +
        `(likely @unlink-xyz/sdk is not installed — it is not on the public npm registry): ${message}`,
    )
  }
}
