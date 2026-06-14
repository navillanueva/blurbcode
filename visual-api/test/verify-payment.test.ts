// Unit tests for the pure payment-verification logic (no RPC). Builds synthetic
// receipts with ERC-20 Transfer logs and asserts each accept/reject path.

import { describe, expect, test } from "bun:test"
import { encodeEventTopics, erc20Abi, toHex, type Log } from "viem"
import { assertValidPayment } from "../src/settlement/verify-payment"

const TOKEN = "0x" + "a".repeat(40)
const TREASURY = "0x" + "b".repeat(40)
const ADVERTISER = "0x" + "c".repeat(40)
const OTHER = "0x" + "d".repeat(40)

/** Synthetic ERC-20 Transfer log that viem's parseEventLogs will decode. */
function transferLog(token: string, from: string, to: string, value: bigint): Log {
  const topics = encodeEventTopics({
    abi: erc20Abi,
    eventName: "Transfer",
    args: { from: from as `0x${string}`, to: to as `0x${string}` },
  })
  return {
    address: token as `0x${string}`,
    topics,
    data: toHex(value, { size: 32 }),
    blockHash: ("0x" + "0".repeat(64)) as `0x${string}`,
    blockNumber: 100n,
    logIndex: 0,
    removed: false,
    transactionHash: ("0x" + "1".repeat(64)) as `0x${string}`,
    transactionIndex: 0,
  } as Log
}

function receipt(logs: Log[], status: "success" | "reverted" = "success", blockNumber = 100n) {
  return { status, blockNumber, logs }
}

const base = { token: TOKEN, treasury: TREASURY, minAmount: 1_000_000n, minConfirmations: 1 }

describe("assertValidPayment", () => {
  test("accepts a confirmed transfer of the budget to the treasury", () => {
    const r = receipt([transferLog(TOKEN, ADVERTISER, TREASURY, 1_000_000n)])
    const v = assertValidPayment(r, 100n, base)
    expect(v.value).toBe(1_000_000n)
    expect(v.to.toLowerCase()).toBe(TREASURY)
    expect(v.from.toLowerCase()).toBe(ADVERTISER)
    expect(v.confirmations).toBe(1)
  })

  test("accepts an overpayment (value > minAmount)", () => {
    const r = receipt([transferLog(TOKEN, ADVERTISER, TREASURY, 5_000_000n)])
    expect(assertValidPayment(r, 105n, base).value).toBe(5_000_000n)
  })

  test("enforces the advertiser address when provided", () => {
    const r = receipt([transferLog(TOKEN, OTHER, TREASURY, 1_000_000n)])
    expect(() => assertValidPayment(r, 100n, { ...base, from: ADVERTISER })).toThrow(/does not match the advertiser/)
    // …but accepts when from matches.
    const ok = receipt([transferLog(TOKEN, ADVERTISER, TREASURY, 1_000_000n)])
    expect(assertValidPayment(ok, 100n, { ...base, from: ADVERTISER }).from.toLowerCase()).toBe(ADVERTISER)
  })

  test("rejects a transfer of the wrong token", () => {
    const r = receipt([transferLog(OTHER, ADVERTISER, TREASURY, 1_000_000n)])
    expect(() => assertValidPayment(r, 100n, base)).toThrow(/no ERC-20 Transfer/)
  })

  test("rejects a transfer to the wrong recipient", () => {
    const r = receipt([transferLog(TOKEN, ADVERTISER, OTHER, 1_000_000n)])
    expect(() => assertValidPayment(r, 100n, base)).toThrow(/no ERC-20 Transfer/)
  })

  test("rejects an amount short of the budget", () => {
    const r = receipt([transferLog(TOKEN, ADVERTISER, TREASURY, 999_999n)])
    expect(() => assertValidPayment(r, 100n, base)).toThrow(/short of the required/)
  })

  test("rejects an unconfirmed tx (too few confirmations)", () => {
    const r = receipt([transferLog(TOKEN, ADVERTISER, TREASURY, 1_000_000n)])
    expect(() => assertValidPayment(r, 100n, { ...base, minConfirmations: 3 })).toThrow(/confirmation/)
  })

  test("rejects a reverted tx", () => {
    const r = receipt([transferLog(TOKEN, ADVERTISER, TREASURY, 1_000_000n)], "reverted")
    expect(() => assertValidPayment(r, 100n, base)).toThrow(/reverted/)
  })

  test("picks the largest matching transfer when several land at the treasury", () => {
    const r = receipt([
      transferLog(TOKEN, ADVERTISER, TREASURY, 400_000n),
      transferLog(TOKEN, ADVERTISER, TREASURY, 1_200_000n),
    ])
    expect(assertValidPayment(r, 100n, base).value).toBe(1_200_000n)
  })
})
