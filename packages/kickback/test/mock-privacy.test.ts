import { describe, expect, test } from "bun:test"
import { MOCK_USDC } from "../src/mock/token"
import { createMockPrivacyProvider } from "../src/mock/privacy"

describe("MockPrivacyProvider", () => {
  test("requires ensureRegistered before any operation", async () => {
    const p = createMockPrivacyProvider()
    await expect(p.requestFaucet(MOCK_USDC)).rejects.toThrow(/ensureRegistered/)
    await expect(p.transfer({ recipientAddress: "0xrecv", token: MOCK_USDC, amount: 1n })).rejects.toThrow(
      /ensureRegistered/,
    )
    await expect(
      p.withdraw({ recipientEvmAddress: "0xrecv", token: MOCK_USDC, amount: 1n }),
    ).rejects.toThrow(/ensureRegistered/)
  })

  test("faucet credits the configured amount and shows up in balances", async () => {
    const p = createMockPrivacyProvider({ faucetAmount: 5_000_000n })
    await p.ensureRegistered()
    await p.requestFaucet(MOCK_USDC)
    await p.requestFaucet(MOCK_USDC)
    const balances = await p.getBalances()
    expect(balances).toEqual([{ token: MOCK_USDC, amount: 10_000_000n }])
  })

  test("transfer debits balance and is logged", async () => {
    const p = createMockPrivacyProvider({ faucetAmount: 1_000_000n })
    await p.ensureRegistered()
    await p.requestFaucet(MOCK_USDC)
    await p.transfer({ recipientAddress: "0xrecv", token: MOCK_USDC, amount: 400_000n })
    expect((await p.getBalances())[0]?.amount).toBe(600_000n)
    expect(p.transfers).toHaveLength(1)
    expect(p.transfers[0]?.recipientAddress).toBe("0xrecv")
  })

  test("withdraw debits balance and is logged", async () => {
    const p = createMockPrivacyProvider({ faucetAmount: 1_000_000n })
    await p.ensureRegistered()
    await p.requestFaucet(MOCK_USDC)
    await p.withdraw({ recipientEvmAddress: "0xeoa", token: MOCK_USDC, amount: 250_000n })
    expect((await p.getBalances())[0]?.amount).toBe(750_000n)
    expect(p.withdrawals).toHaveLength(1)
  })

  test("throws on insufficient balance without mutating state", async () => {
    const p = createMockPrivacyProvider({ faucetAmount: 1_000_000n })
    await p.ensureRegistered()
    await p.requestFaucet(MOCK_USDC)
    await expect(
      p.transfer({ recipientAddress: "0xrecv", token: MOCK_USDC, amount: 2_000_000n }),
    ).rejects.toThrow(/insufficient private balance/)
    expect((await p.getBalances())[0]?.amount).toBe(1_000_000n)
    expect(p.transfers).toHaveLength(0)
  })

  test("rejects non-positive amounts", async () => {
    const p = createMockPrivacyProvider()
    await p.ensureRegistered()
    await expect(p.transfer({ recipientAddress: "0xr", token: MOCK_USDC, amount: 0n })).rejects.toThrow(
      /must be positive/,
    )
  })
})
