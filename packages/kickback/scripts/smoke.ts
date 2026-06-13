// Kickback AI — provider smoke harness.
//
// READ-ONLY by default: prints which providers are live vs mock, the fallback
// notes, and (if settlement is live) the current Gateway-deposited balance. No
// funds move unless you EXPLICITLY opt in.
//
// Run from the repo root so Bun auto-loads `.env`:
//   bun packages/kickback/scripts/smoke.ts
//
// THE SINGLE ALLOWED LIVE TEST (golden rule 5 — once for the whole night, never
// in a loop). Move funds only with BOTH a confirm env var and an explicit seller
// x402 resource URL, e.g.:
//   KICKBACK_SMOKE_CONFIRM=1 bun packages/kickback/scripts/smoke.ts --deposit 0.10 --pay https://seller.example/resource
//
// TODO(human): supply a real Arc x402 seller resource URL before running --pay.

import { createProviders, fromBaseUnits } from "../src/index"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const { providers, live, notes } = createProviders()

  console.log("Kickback providers:")
  console.log(`  wallet:     ${live.wallet ? "REAL" : "mock"}`)
  console.log(`  privacy:    ${live.privacy ? "REAL" : "mock"}`)
  console.log(`  settlement: ${live.settlement ? "REAL" : "mock"}`)
  if (notes.length) {
    console.log("\nFallback notes:")
    for (const n of notes) console.log(`  • ${n}`)
  }

  const session = await providers.wallet.signIn()
  console.log(`\nwallet session: userId=${session.userId} address=${session.address}`)

  // Read-only: current spendable Gateway balance.
  try {
    const bal = await providers.settlement.getDepositedBalance()
    console.log(`gateway deposited balance: ${fromBaseUnits(bal)} USDC (${bal} base units)`)
  } catch (e) {
    console.log(`gateway balance read failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  // ── Mutating path: hard-gated, single shot, never run by the loop. ──────────
  const depositAmt = arg("--deposit")
  const payUrl = arg("--pay")
  const confirmed = process.env.KICKBACK_SMOKE_CONFIRM === "1"
  if (!depositAmt && !payUrl) {
    console.log("\n(read-only — pass --deposit <usdc> and/or --pay <url> with KICKBACK_SMOKE_CONFIRM=1 to move funds)")
    return
  }
  if (!confirmed) {
    console.error("\nRefusing to move funds: set KICKBACK_SMOKE_CONFIRM=1 to confirm the single allowed live test.")
    process.exit(1)
  }
  if (!live.settlement) {
    console.error("\nRefusing: settlement provider is the mock — configure PAYER_* + ARC_* for the real Gateway client.")
    process.exit(1)
  }

  if (depositAmt) {
    console.log(`\ndepositing ${depositAmt} USDC into the Gateway…`)
    await providers.settlement.deposit(depositAmt)
    const bal = await providers.settlement.getDepositedBalance()
    console.log(`new gateway balance: ${fromBaseUnits(bal)} USDC`)
  }
  if (payUrl) {
    console.log(`\npaying x402 resource ${payUrl}…`)
    const receipt = await providers.settlement.pay(payUrl)
    console.log(`paid ${fromBaseUnits(receipt.amount)} USDC — ref ${receipt.reference}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
