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
import { fromBaseUnits, toBaseUnits } from "@kickback/money"
import type { BaseUnits } from "@kickback/money"
import type { SettlementService } from "./service"
import { RealGatewaySettlement } from "./real-gateway"
import { RealUnlinkPrivacy, unlinkAccountFromMnemonic } from "./real-unlink"
import { verifyPaymentToTreasury } from "./verify-payment"

/** Cache the live pool-balance read so `/health` (and repeated calls) stay cheap. */
const POOL_BALANCE_TTL_MS = 15_000

export async function createRealSettlementService(env: Record<string, string | undefined>): Promise<SettlementService> {
  const cfg = readKickbackEnv(env)
  const notes: string[] = []

  // Gateway is constructed for status reporting only; v0.4 payouts go through
  // Unlink (private), never the non-private Gateway rail.
  let gateway: RealGatewaySettlement | undefined
  if (cfg.payer && cfg.arc) {
    gateway = new RealGatewaySettlement({ privateKey: cfg.payer.privateKey, rpcUrl: cfg.arc.rpcUrl })
  } else {
    notes.push("settlement: missing PAYER_*/ARC_* — Circle Gateway unavailable (no x402 payout)")
  }

  let privacy: RealUnlinkPrivacy | undefined
  if (cfg.unlink.mnemonic && cfg.unlink.engineUrl && cfg.unlink.apiKey && cfg.arc) {
    privacy = new RealUnlinkPrivacy({
      engineUrl: cfg.unlink.engineUrl,
      environment: cfg.unlink.environment,
      apiKey: cfg.unlink.apiKey,
      account: unlinkAccountFromMnemonic(cfg.unlink.mnemonic),
      token: cfg.arc.usdc,
      // Treasury EOA signer — required so deposit() can pull public ERC-20 into the pool.
      evmSigner:
        cfg.payer && cfg.arc
          ? { privateKey: cfg.payer.privateKey, rpcUrl: cfg.arc.rpcUrl, chainId: cfg.arc.chainId }
          : undefined,
    })
    await privacy.ensureRegistered()
    if (!cfg.payer) notes.push("settlement: no PAYER_* signer — fund (deposit) disabled; withdraw/read only")
  } else {
    notes.push(
      "privacy: missing UNLINK_MNEMONIC/UNLINK_ENGINE_URL/UNLINK_API_KEY/ARC_* — Unlink unavailable (payouts not private)",
    )
  }

  let poolCache: { value: BaseUnits; at: number } | undefined

  return {
    mode: "real",
    live: { wallet: !!cfg.payer, privacy: !!privacy, settlement: !!gateway },
    notes,

    async fundCampaign({ campaignId, amountBaseUnits, advertiserAddress, paymentTxHash }) {
      const p = privacy
      if (!p) throw new Error("real settlement: Unlink privacy unavailable — cannot fund privately")
      if (!p.canDeposit()) {
        throw new Error("real settlement: no EVM signer for deposit (set PAYER_PRIVATE_KEY + ARC_TESTNET_RPC_URL)")
      }
      if (!cfg.arc) throw new Error("real settlement: ARC_* config missing")
      if (!cfg.treasuryAddress) throw new Error("real settlement: TREASURY_ADDRESS/PAYER_ADDRESS missing")
      if (amountBaseUnits <= 0n) throw new Error("fund amount must be positive")
      if (!paymentTxHash) throw new Error("paymentTxHash is required in real mode (advertiser's on-chain payment)")

      // 1) Verify the advertiser actually paid the treasury on-chain (public transfer).
      await verifyPaymentToTreasury({
        rpcUrl: cfg.arc.rpcUrl,
        token: cfg.arc.usdc.address,
        treasury: cfg.treasuryAddress,
        from: advertiserAddress || undefined,
        minAmount: amountBaseUnits,
        txHash: paymentTxHash,
        minConfirmations: cfg.fundMinConfirmations,
      })

      // 2) Shield the verified budget into the pool (real private deposit).
      const handle = await p.deposit(amountBaseUnits)
      const result = await handle.wait({ timeoutMs: 120_000 })
      if (result.status === "failed") throw new Error(`private deposit failed (txId=${handle.txId})`)
      poolCache = undefined // balance changed
      // Prefer the real on-chain deposit tx hash (linkable on Arcscan); fall back to
      // the Unlink txId when the adapter didn't surface a hash.
      return { txRef: result.txHash ?? `unlink-deposit:${handle.txId}` }
    },

    async withdrawEarnings({ accountId, amountBaseUnits, recipientEvmAddress }) {
      const p = privacy
      // Fail visibly rather than route a payout through the non-private Gateway.
      if (!p) throw new Error("real settlement: Unlink privacy unavailable — refusing non-private payout")
      if (amountBaseUnits <= 0n) return { txRef: `unlink-withdraw:${accountId}:noop` }
      if (!recipientEvmAddress) throw new Error("withdraw requires a recipient EVM address")

      // Guard: never zero the ledger if the pool can't cover the payout. The route
      // settles before zeroing, so this throw → 502 → earnings stay intact.
      const poolBalance = await p.getBalance()
      if (poolBalance < amountBaseUnits) {
        throw new Error(`pool balance ${poolBalance} base units < requested ${amountBaseUnits} — refusing to withdraw`)
      }

      // Wait for terminal so a failed payout never zeroes earnings.
      const handle = await p.withdraw({ recipientEvmAddress, amount: amountBaseUnits })
      const result = await handle.wait({ timeoutMs: 120_000 })
      if (result.status === "failed") throw new Error(`private withdraw failed (txId=${handle.txId})`)
      poolCache = undefined // balance changed
      // Prefer the real on-chain payout tx hash (linkable on Arcscan); fall back to
      // the Unlink txId when the adapter didn't surface a hash.
      return { txRef: result.txHash ?? `unlink-withdraw:${handle.txId}` }
    },

    ...(privacy
      ? {
          async getPoolBalance(): Promise<BaseUnits | null> {
            const p = privacy
            if (!p) return null
            const fresh = poolCache && Date.now() - poolCache.at < POOL_BALANCE_TTL_MS
            if (fresh) return poolCache!.value
            try {
              const value = await p.getBalance()
              poolCache = { value, at: Date.now() }
              return value
            } catch {
              return null
            }
          },
        }
      : {}),
  }
}

/** The single allowed live Arc smoke (read-only unless explicitly confirmed). */
export async function realSmoke(opts: {
  deposit?: string
  pay?: string
  unlinkFaucet?: boolean
  unlinkDeposit?: string
  unlinkWithdraw?: string
  confirm: boolean
}): Promise<void> {
  const cfg = readKickbackEnv(process.env)
  // Pool-token decimals (ULNKMock = 18 on arc-testnet, USDC = 6 on mainnet). Every
  // human↔base conversion in this smoke MUST use this, or 0.10 becomes dust.
  const dec = cfg.arc?.usdc.decimals ?? 6
  const svc = await createRealSettlementService(process.env)
  console.log("Real settlement service:")
  console.log(`  wallet:     ${svc.live.wallet ? "REAL" : "unavailable"}`)
  console.log(`  privacy:    ${svc.live.privacy ? "REAL" : "unavailable"}`)
  console.log(`  settlement: ${svc.live.settlement ? "REAL" : "unavailable"}`)
  console.log(`  pool token: ${cfg.arc?.usdc.address ?? "?"} (${dec}dp)`)
  for (const n of svc.notes) console.log(`  • ${n}`)

  let gateway: RealGatewaySettlement | undefined
  if (cfg.payer && cfg.arc) {
    gateway = new RealGatewaySettlement({ privateKey: cfg.payer.privateKey, rpcUrl: cfg.arc.rpcUrl })
    try {
      const bal = await gateway.getDepositedBalance()
      // Gateway uses the canonical Circle USDC (6dp), distinct from the pool token.
      console.log(`gateway deposited balance: ${fromBaseUnits(bal)} USDC (${bal} base units)`)
    } catch (e) {
      console.log(`gateway balance read failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // The private (Unlink) account. Building + registering + reading its shielded
  // balance exercises the full server-side path (admin register → per-user
  // authorization token → balanceOf). The deposit signer mirrors createRealSettlementService.
  let privacy: RealUnlinkPrivacy | undefined
  if (cfg.unlink.mnemonic && cfg.unlink.engineUrl && cfg.unlink.apiKey && cfg.arc) {
    privacy = new RealUnlinkPrivacy({
      engineUrl: cfg.unlink.engineUrl,
      environment: cfg.unlink.environment,
      apiKey: cfg.unlink.apiKey,
      account: unlinkAccountFromMnemonic(cfg.unlink.mnemonic),
      token: cfg.arc.usdc,
      evmSigner: cfg.payer
        ? { privateKey: cfg.payer.privateKey, rpcUrl: cfg.arc.rpcUrl, chainId: cfg.arc.chainId }
        : undefined,
    })
    try {
      await privacy.ensureRegistered()
      const bal = await privacy.getBalance()
      console.log(`unlink private account: ${await privacy.getAddress()}`)
      console.log(`unlink private balance: ${fromBaseUnits(bal, dec)} (${bal} base units)`)
    } catch (e) {
      console.log(`unlink read failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const wantsAction = !!(opts.deposit || opts.pay || opts.unlinkFaucet || opts.unlinkDeposit || opts.unlinkWithdraw)
  if (!wantsAction) {
    console.log(
      "\n(read-only — to move funds set KICKBACK_SMOKE_CONFIRM=1 and pass:" +
        "\n   private leg : --unlink-deposit <usdc> --unlink-withdraw <usdc>  (advertiser deposit + dev payout via Unlink)" +
        "\n   gateway leg : --deposit <usdc> --pay <x402-url>                 (Circle Gateway x402, optional spend rail))",
    )
    return
  }
  if (!opts.confirm) {
    console.error("\nRefusing to move funds: set KICKBACK_SMOKE_CONFIRM=1 to confirm the single allowed live test.")
    process.exit(1)
  }

  // ── Private leg (Unlink): the deliverable. Advertiser deposit + developer
  //    payout both route through the shielded pool — amounts, counterparties,
  //    and the spend graph stay private (view key for audit). ──
  if (opts.unlinkFaucet) {
    // The Engine faucet rejects the configured project token ("token not supported
    // by faucet"); the real deposit leg replaces it. Kept as a visible no-op note.
    console.log("\n[faucet] skipped — the Unlink faucet does not support the pool token; use --unlink-deposit instead.")
  }
  if (opts.unlinkDeposit || opts.unlinkWithdraw) {
    if (!privacy || !cfg.arc) {
      console.error(
        "\nRefusing: Unlink privacy not configured — set UNLINK_MNEMONIC/UNLINK_ENGINE_URL/UNLINK_API_KEY + ARC_*.",
      )
      process.exit(1)
    }
    if (opts.unlinkDeposit) {
      if (!privacy.canDeposit()) {
        console.error("\nRefusing: deposit needs the treasury signer — set PAYER_PRIVATE_KEY + ARC_TESTNET_RPC_URL.")
        process.exit(1)
      }
      const amount = toBaseUnits(opts.unlinkDeposit, dec)
      const before = await privacy.getBalance()
      console.log(
        `\n[deposit · private] shielding ${opts.unlinkDeposit} (${amount} base units) from the treasury into the pool…`,
      )
      const handle = await privacy.deposit(amount)
      console.log(`  submitted txId=${handle.txId} status=${handle.status} — waiting for terminal…`)
      try {
        const result = await handle.wait({ timeoutMs: 120_000 })
        console.log(`  deposit ${result.status}${result.txHash ? ` (tx ${result.txHash})` : ""}`)
      } catch (e) {
        console.log(
          `  not terminal within 120s: ${e instanceof Error ? e.message : String(e)} (txId=${handle.txId} may still confirm)`,
        )
      }
      const after = await privacy.getBalance()
      console.log(
        `  shielded balance: ${fromBaseUnits(before, dec)} → ${fromBaseUnits(after, dec)}` +
          (after > before ? " — private deposit CONFIRMED" : " (not yet reflected)"),
      )
    }
    if (opts.unlinkWithdraw) {
      const requested = toBaseUnits(opts.unlinkWithdraw, dec)
      const balance = await privacy.getBalance()
      const amount = requested <= balance ? requested : balance
      const recipient = cfg.payer?.address
      if (!recipient) {
        console.error("\nRefusing: no PAYER_ADDRESS to receive the private withdraw.")
        process.exit(1)
      }
      if (amount <= 0n) {
        console.log(`\n[payout · private] skipped — shielded balance is 0 (fund it with --unlink-deposit first).`)
      } else {
        if (amount < requested) {
          console.log(
            `\n[payout · private] capping to shielded balance ${fromBaseUnits(amount, dec)} (requested ${opts.unlinkWithdraw}).`,
          )
        }
        console.log(`[payout · private] withdrawing ${fromBaseUnits(amount, dec)} privately to ${recipient}…`)
        const handle = await privacy.withdraw({ recipientEvmAddress: recipient, amount })
        console.log(`  submitted txId=${handle.txId} status=${handle.status} — waiting for terminal…`)
        try {
          const result = await handle.wait({ timeoutMs: 120_000 })
          console.log(`  withdraw ${result.status}${result.txHash ? ` (tx ${result.txHash})` : ""} — private payout CONFIRMED`)
        } catch (e) {
          console.log(
            `  not terminal within 120s: ${e instanceof Error ? e.message : String(e)} (txId=${handle.txId} may still confirm)`,
          )
        }
        console.log(`  shielded balance now: ${fromBaseUnits(await privacy.getBalance(), dec)}`)
      }
    }
  }

  // ── Gateway leg (Circle x402): optional settlement / agentic-spend rail. ──
  if (opts.deposit || opts.pay) {
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
}
