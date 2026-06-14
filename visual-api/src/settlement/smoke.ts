// The single allowed live Arc smoke (golden rule 5 — once, never in a loop).
//
// READ-ONLY by default: prints which providers are live, the Gateway balance, and
// the private Unlink balance. Moves funds only with KICKBACK_SMOKE_CONFIRM=1 plus
// an explicit action flag. Delegates to the real module (dynamically loaded) so
// this file stays free of the Unlink SDK import.
//
//   bun run smoke                         # read-only status
//   # private leg (the deliverable — deposit from treasury → pool, then payout):
//   KICKBACK_SMOKE_CONFIRM=1 bun run smoke --unlink-deposit 0.10 --unlink-withdraw 0.05
//   # gateway leg (optional Circle x402 spend rail):
//   KICKBACK_SMOKE_CONFIRM=1 bun run smoke --deposit 0.10 --pay https://seller/x402

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function flag(name: string): boolean {
  return process.argv.includes(name)
}

interface RealModule {
  realSmoke(opts: {
    deposit?: string
    pay?: string
    unlinkFaucet?: boolean
    unlinkDeposit?: string
    unlinkWithdraw?: string
    confirm: boolean
  }): Promise<void>
}

async function main() {
  const spec = "./real"
  let mod: RealModule
  try {
    mod = (await import(spec)) as RealModule
  } catch (e) {
    console.error(
      "Cannot load real settlement module (is @unlink-xyz/sdk installed? it is not on the public npm registry):",
      e instanceof Error ? e.message : String(e),
    )
    process.exit(1)
  }
  await mod.realSmoke({
    deposit: arg("--deposit"),
    pay: arg("--pay"),
    unlinkFaucet: flag("--unlink-faucet"),
    unlinkDeposit: arg("--unlink-deposit"),
    unlinkWithdraw: arg("--unlink-withdraw"),
    confirm: process.env.KICKBACK_SMOKE_CONFIRM === "1",
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
