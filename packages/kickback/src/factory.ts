// Provider factory — picks REAL or MOCK for each provider from env, and records
// every fallback visibly (golden rule: never fake a working integration; fall
// back to the mock and surface why). `live.*` flags + `notes` make the degraded
// state observable to the caller (TUI / smoke script) instead of silently mocked.

import { readKickbackEnv } from "./config"
import type { KickbackConfig } from "./config"
import {
  createMockPrivacyProvider,
  createMockSettlementProvider,
  createMockWalletProvider,
} from "./mock"
import {
  RealPrivacyProvider,
  RealSettlementProvider,
  RealWalletProvider,
  unlinkAccountFromMnemonic,
} from "./real"
import type { PrivacyProvider } from "./privacy"
import type { SettlementProvider } from "./settlement"
import type { WalletProvider } from "./wallet"

export interface ProviderSet {
  wallet: WalletProvider
  privacy: PrivacyProvider
  settlement: SettlementProvider
}

export interface ProvidersResult {
  providers: ProviderSet
  /** Whether each provider is the real (vendor-SDK-backed) impl. */
  live: { wallet: boolean; privacy: boolean; settlement: boolean }
  /** Human-readable reason for every mock fallback (empty when all live). */
  notes: string[]
}

type Env = Record<string, string | undefined>

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Build the three providers from environment. Missing/unreachable config never
 * throws — it degrades to the matching mock and pushes a note. Genuinely
 * malformed REAL config (e.g. a bad mnemonic) surfaces as a note too, so the
 * caller can tell "intentionally mocked" from "tried real and failed".
 */
export function createProviders(env: Env = process.env): ProvidersResult {
  const cfg: KickbackConfig = readKickbackEnv(env)
  const notes: string[] = []

  // ── Wallet ───────────────────────────────────────────────────────────────
  let wallet: WalletProvider
  let liveWallet = false
  if (cfg.payer) {
    wallet = new RealWalletProvider({
      // Canonical userId is the Dynamic JWT `sub`; until browser sign-in lands we
      // fall back to the payer address as a stable identifier.
      userId: cfg.dynamic.userId ?? cfg.payer.address,
      address: cfg.payer.address,
    })
    liveWallet = true
    if (!cfg.dynamic.userId) {
      notes.push("wallet: no DYNAMIC_USER_ID; using payer address as userId until Dynamic sign-in lands")
    }
  } else {
    wallet = createMockWalletProvider()
    notes.push("wallet: no valid PAYER_ADDRESS/PAYER_PRIVATE_KEY; using mock wallet")
  }

  // ── Settlement (Circle Gateway x402) ───────────────────────────────────────
  let settlement: SettlementProvider
  let liveSettlement = false
  if (cfg.payer && cfg.arc) {
    try {
      settlement = new RealSettlementProvider({
        privateKey: cfg.payer.privateKey,
        rpcUrl: cfg.arc.rpcUrl,
      })
      liveSettlement = true
    } catch (e) {
      settlement = createMockSettlementProvider()
      notes.push(`settlement: real Gateway client failed to init (${errMessage(e)}); using mock`)
    }
  } else {
    settlement = createMockSettlementProvider()
    notes.push("settlement: missing PAYER_* or ARC_* config; using mock settlement")
  }

  // ── Privacy (Unlink) ───────────────────────────────────────────────────────
  let privacy: PrivacyProvider
  let livePrivacy = false
  if (!cfg.unlink.mnemonic) {
    privacy = createMockPrivacyProvider()
    notes.push(
      "privacy: no UNLINK_MNEMONIC (the private account is derived from the deferred browser wallet); using mock privacy",
    )
  } else if (!cfg.arc) {
    privacy = createMockPrivacyProvider()
    notes.push("privacy: missing ARC_USDC_ADDRESS; using mock privacy")
  } else if (!cfg.unlink.engineUrl) {
    // "arc-testnet" is not a built-in env on canary .552, and we have no verified
    // Arc Engine URL — constructing real here would throw. Stay honest, mock it.
    privacy = createMockPrivacyProvider()
    notes.push(
      `privacy: UNLINK_ENVIRONMENT="${cfg.unlink.environment}" not built into the SDK and no UNLINK_ENGINE_URL set; using mock privacy`,
    )
  } else {
    try {
      privacy = new RealPrivacyProvider({
        engineUrl: cfg.unlink.engineUrl,
        environment: cfg.unlink.environment,
        account: unlinkAccountFromMnemonic(cfg.unlink.mnemonic),
        token: cfg.arc.usdc,
      })
      livePrivacy = true
    } catch (e) {
      privacy = createMockPrivacyProvider()
      notes.push(`privacy: real Unlink client failed to init (${errMessage(e)}); using mock`)
    }
  }

  return {
    providers: { wallet, privacy, settlement },
    live: { wallet: liveWallet, privacy: livePrivacy, settlement: liveSettlement },
    notes,
  }
}
