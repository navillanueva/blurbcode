import { describe, expect, test } from "bun:test"
import { createMockSettlementProvider } from "../src/mock/settlement"

const RESOURCE = "https://seller.example/resource"

describe("MockSettlementProvider", () => {
  test("deposit converts decimal USDC to base units", async () => {
    const s = createMockSettlementProvider()
    await s.deposit("1.99")
    expect(await s.getDepositedBalance()).toBe(1_990_000n)
    await s.deposit("0.01")
    expect(await s.getDepositedBalance()).toBe(2_000_000n)
  })

  test("rejects non-positive deposits", async () => {
    const s = createMockSettlementProvider()
    await expect(s.deposit("0")).rejects.toThrow(/must be positive/)
  })

  test("pay debits the resource price and returns a receipt", async () => {
    const s = createMockSettlementProvider({ prices: { [RESOURCE]: 500_000n } })
    await s.deposit("1")
    const receipt = await s.pay(RESOURCE)
    expect(receipt).toEqual({ resourceUrl: RESOURCE, amount: 500_000n, reference: "mock-x402-1" })
    expect(await s.getDepositedBalance()).toBe(500_000n)
    expect(s.payments).toHaveLength(1)
  })

  test("falls back to the default price for unknown resources", async () => {
    const s = createMockSettlementProvider({ defaultPrice: 10_000n })
    await s.deposit("1")
    const receipt = await s.pay("https://other.example/x")
    expect(receipt.amount).toBe(10_000n)
  })

  test("references increment deterministically", async () => {
    const s = createMockSettlementProvider({ defaultPrice: 1n })
    await s.deposit("1")
    expect((await s.pay(RESOURCE)).reference).toBe("mock-x402-1")
    expect((await s.pay(RESOURCE)).reference).toBe("mock-x402-2")
  })

  test("throws on insufficient deposit without debiting", async () => {
    const s = createMockSettlementProvider({ prices: { [RESOURCE]: 2_000_000n } })
    await s.deposit("1")
    await expect(s.pay(RESOURCE)).rejects.toThrow(/insufficient Gateway deposit/)
    expect(await s.getDepositedBalance()).toBe(1_000_000n)
    expect(s.payments).toHaveLength(0)
  })
})
