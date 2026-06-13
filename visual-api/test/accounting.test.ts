import { describe, expect, test } from "bun:test"
import { computeImpressionCharge, DEV_SHARE_DENOMINATOR, IMPRESSIONS_PER_BLOCK } from "../src/accounting"

describe("computeImpressionCharge", () => {
  test("charges bid per 1,000 impressions and credits the dev 50%", () => {
    const r = computeImpressionCharge({ bidBaseUnits: 1_000_000n, budgetRemaining: 10_000_000n, count: 1000 })
    expect(r.charge).toBe(1_000_000n)
    expect(r.devCredit).toBe(500_000n)
  })

  test("a single impression is floor(bid / 1000)", () => {
    const r = computeImpressionCharge({ bidBaseUnits: 1_000_000n, budgetRemaining: 10_000_000n, count: 1 })
    expect(r.charge).toBe(1_000n)
    expect(r.devCredit).toBe(500n)
  })

  test("charge is clamped to the remaining budget (never overspends)", () => {
    const r = computeImpressionCharge({ bidBaseUnits: 1_000_000n, budgetRemaining: 400_000n, count: 1000 })
    expect(r.charge).toBe(400_000n)
    expect(r.devCredit).toBe(200_000n)
  })

  test("dev credit floors on odd charges", () => {
    // bid 2001 per block, 1000 impressions → charge 2001, dev gets floor(2001/2)=1000
    const r = computeImpressionCharge({ bidBaseUnits: 2001n, budgetRemaining: 10_000n, count: 1000 })
    expect(r.charge).toBe(2001n)
    expect(r.devCredit).toBe(1000n)
  })

  test("zero/negative inputs yield no charge", () => {
    expect(computeImpressionCharge({ bidBaseUnits: 1_000_000n, budgetRemaining: 10n, count: 0 })).toEqual({
      charge: 0n,
      devCredit: 0n,
    })
    expect(computeImpressionCharge({ bidBaseUnits: 0n, budgetRemaining: 10n, count: 10 })).toEqual({
      charge: 0n,
      devCredit: 0n,
    })
    expect(computeImpressionCharge({ bidBaseUnits: 10n, budgetRemaining: 0n, count: 10 })).toEqual({
      charge: 0n,
      devCredit: 0n,
    })
  })

  test("constants match the kickbacks economic model", () => {
    expect(IMPRESSIONS_PER_BLOCK).toBe(1000n)
    expect(DEV_SHARE_DENOMINATOR).toBe(2n)
  })
})
