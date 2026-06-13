import { describe, expect, test } from "bun:test"
import { createMockSettlementService } from "../src/settlement/mock"

describe("mock settlement service", () => {
  test("reports mock mode with no live providers", () => {
    const s = createMockSettlementService()
    expect(s.mode).toBe("mock")
    expect(s.live).toEqual({ wallet: false, privacy: false, settlement: false })
    expect(s.notes.length).toBeGreaterThan(0)
  })

  test("fundCampaign returns a deterministic ref and tolerates a zero amount", async () => {
    const s = createMockSettlementService()
    const r1 = await s.fundCampaign({ campaignId: "c1", amountBaseUnits: 1_000_000n, advertiserAddress: "0xabc" })
    expect(r1.txRef).toMatch(/^mock-fund:c1:/)
    const r0 = await s.fundCampaign({ campaignId: "c2", amountBaseUnits: 0n, advertiserAddress: "0xabc" })
    expect(r0.txRef).toMatch(/^mock-fund:c2:/)
  })

  test("withdrawEarnings returns a deterministic ref", async () => {
    const s = createMockSettlementService()
    const r = await s.withdrawEarnings({ accountId: "a1", amountBaseUnits: 500_000n, recipientEvmAddress: "0xdef" })
    expect(r.txRef).toMatch(/^mock-withdraw:a1:/)
  })
})
