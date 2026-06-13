// Real settlement service — wires the migrated Circle Gateway (x402) + Unlink
// (privacy) providers into the SettlementService the routes use. The backend
// holds settlement authority server-side (a payer EOA for Gateway; a mnemonic-
// derived private Unlink account), per visual-code-mvp-architecture.md.
//
// EXCLUDED FROM THE DEFAULT TYPECHECK (imports real-unlink → @unlink-xyz/sdk,
// which is not installable from the public registry here). Loaded only via the
// factory's dynamic import when SETTLEMENT_MODE=real. Config never throws on
// missing pieces — it degrades to "unavailable" and records a note, mirroring the
// kickback factory's golden rule (surface fallbacks, never fake a live call).

import { readKickbackEnv } from "@kickback/config"
import { fromBaseUnits } from "@kickback/money"
import type { SettlementService } from "./service"
import { RealGatewaySettlement } from "./real-gateway"
import { RealUnlinkPrivacy, unlinkAccountFromMnemonic } from "./real-unlink"

export async function createRealSettlementService(env: Record<string, string | undefined>): Promise<SettlementService> {
  const cfg = readKickbackEnv(env)
  const notes: string[] = []

  let gateway: RealGatewaySettlement | undefined
  if (cfg.payer && cfg.arc) {
    gateway = new RealGatewaySettlement({ privateKey: cfg.payer.privateKey, rpcUrl: cfg.arc.rpcUrl })
  } else {
    notes.push("settlement: missing PAYER_*/ARC_* — Circle Gateway unavailable (no x402 payout)")
  }

  let privacy: RealUnlinkPrivacy | undefined
  if (cfg.unlink.mnemonic && cfg.unlink.engineUrl && cfg.arc) {
    privacy = new RealUnlinkPrivacy({
      engineUrl: cfg.unlink.engineUrl,
      environment: cfg.unlink.environment,
      account: unlinkAccountFromMnemonic(cfg.unlink.mnemonic),
      token: cfg.arc.usdc,
    })
    await privacy.ensureRegistered()
  } else {
    notes.push("privacy: missing UNLINK_MNEMONIC/UNLINK_ENGINE_URL/ARC_* — Unlink unavailable (payouts not private)")
  }

  const usdc = cfg.arc?.usdc

  return {
    mode: "real",
    live: { wallet: !!cfg.payer, privacy: !!privacy, settlement: !!gateway },
    notes,

    async fundCampaign({ campaignId, amountBaseUnits }) {
      // Advertiser budget is escrowed privately. In the full Dynamic flow the
      // deposit is signed client-side; here the backend's private Unlink account
      // holds the budget (server-side settlement authority).
      if (privacy && amountBaseUnits > 0n) {
        await privacy.requestFaucet() // fund the private account on testnet
      }
      return { txRef: `unlink-fund:${campaignId}` }
    },

    async withdrawEarnings({ accountId, amountBaseUnits, recipientEvmAddress }) {
      // Pay the developer privately out to their wallet address. Gateway x402 is
      // used for the gas-free USDC settlement rail when configured.
      if (privacy && usdc && amountBaseUnits > 0n) {
        await privacy.withdraw({ recipientEvmAddress, amount: amountBaseUnits })
      } else if (gateway) {
        // No private layer configured: at least move the USDC via the Gateway.
        await gateway.deposit(fromBaseUnits(amountBaseUnits))
      }
      return { txRef: `unlink-withdraw:${accountId}` }
    },
  }
}

/** The single allowed live Arc smoke (read-only unless explicitly confirmed). */
export async function realSmoke(opts: { deposit?: string; pay?: string; confirm: boolean }): Promise<void> {
  const cfg = readKickbackEnv(process.env)
  const svc = await createRealSettlementService(process.env)
  console.log("Real settlement service:")
  console.log(`  wallet:     ${svc.live.wallet ? "REAL" : "unavailable"}`)
  console.log(`  privacy:    ${svc.live.privacy ? "REAL" : "unavailable"}`)
  console.log(`  settlement: ${svc.live.settlement ? "REAL" : "unavailable"}`)
  for (const n of svc.notes) console.log(`  • ${n}`)

  let gateway: RealGatewaySettlement | undefined
  if (cfg.payer && cfg.arc) {
    gateway = new RealGatewaySettlement({ privateKey: cfg.payer.privateKey, rpcUrl: cfg.arc.rpcUrl })
    try {
      const bal = await gateway.getDepositedBalance()
      console.log(`gateway deposited balance: ${fromBaseUnits(bal)} USDC (${bal} base units)`)
    } catch (e) {
      console.log(`gateway balance read failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (!opts.deposit && !opts.pay) {
    console.log("\n(read-only — pass --deposit <usdc> and/or --pay <url> with KICKBACK_SMOKE_CONFIRM=1 to move funds)")
    return
  }
  if (!opts.confirm) {
    console.error("\nRefusing to move funds: set KICKBACK_SMOKE_CONFIRM=1 to confirm the single allowed live test.")
    process.exit(1)
  }
  if (!gateway) {
    console.error("\nRefusing: Gateway not configured — set PAYER_* + ARC_* for the real client.")
    process.exit(1)
  }
  if (opts.deposit) {
    console.log(`\ndepositing ${opts.deposit} USDC into the Gateway…`)
    await gateway.deposit(opts.deposit)
    console.log(`new gateway balance: ${fromBaseUnits(await gateway.getDepositedBalance())} USDC`)
  }
  if (opts.pay) {
    console.log(`\npaying x402 resource ${opts.pay}…`)
    const receipt = await gateway.pay(opts.pay)
    console.log(`paid ${fromBaseUnits(receipt.amount)} USDC — ref ${receipt.reference}`)
  }
}
