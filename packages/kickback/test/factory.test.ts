import { describe, expect, test } from "bun:test"
import { createProviders } from "../src/factory"
import { RealSettlementProvider } from "../src/real/settlement"
import { RealWalletProvider } from "../src/real/wallet"
import { MockPrivacyProvider } from "../src/mock/privacy"
import { MockSettlementProvider } from "../src/mock/settlement"
import { MockWalletProvider } from "../src/mock/wallet"

// Hardhat test account #0 — PUBLIC well-known key, never a real secret.
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
const TEST_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
const USDC = "0x3600000000000000000000000000000000000000"

const ARC_PAYER_ENV: Record<string, string | undefined> = {
  ARC_TESTNET_RPC_URL: "https://rpc.testnet.arc.network",
  ARC_CHAIN_ID: "5042002",
  ARC_USDC_ADDRESS: USDC,
  PAYER_ADDRESS: TEST_ADDR,
  PAYER_PRIVATE_KEY: TEST_KEY,
  UNLINK_ENVIRONMENT: "arc-testnet",
  // No UNLINK_MNEMONIC / UNLINK_ENGINE_URL — privacy must mock out (tonight's state).
}

describe("createProviders", () => {
  test("empty env → all mocks, nothing live, a note per provider", () => {
    const { providers, live, notes } = createProviders({})
    expect(providers.wallet).toBeInstanceOf(MockWalletProvider)
    expect(providers.privacy).toBeInstanceOf(MockPrivacyProvider)
    expect(providers.settlement).toBeInstanceOf(MockSettlementProvider)
    expect(live).toEqual({ wallet: false, privacy: false, settlement: false })
    expect(notes.length).toBeGreaterThanOrEqual(3)
    expect(notes.join("\n")).toMatch(/wallet:/)
    expect(notes.join("\n")).toMatch(/settlement:/)
    expect(notes.join("\n")).toMatch(/privacy:/)
  })

  test("payer + arc, no unlink creds → real wallet + settlement, mock privacy", () => {
    const { providers, live, notes } = createProviders(ARC_PAYER_ENV)
    expect(providers.wallet).toBeInstanceOf(RealWalletProvider)
    expect(providers.settlement).toBeInstanceOf(RealSettlementProvider)
    expect(providers.privacy).toBeInstanceOf(MockPrivacyProvider)
    expect(live).toEqual({ wallet: true, privacy: false, settlement: true })
    // Privacy fallback reason is surfaced (no mnemonic).
    expect(notes.join("\n")).toMatch(/UNLINK_MNEMONIC/)
    // Wallet falls back to payer address as userId (no DYNAMIC_USER_ID).
    expect(notes.join("\n")).toMatch(/DYNAMIC_USER_ID/)
  })

  test("real wallet session carries the payer EOA + userId fallback", async () => {
    const { providers } = createProviders(ARC_PAYER_ENV)
    const session = await providers.wallet.signIn()
    expect(session.address).toBe(TEST_ADDR)
    expect(session.userId).toBe(TEST_ADDR) // falls back to address with no DYNAMIC_USER_ID
    expect(session.jwt).toBeUndefined()
  })

  test("DYNAMIC_USER_ID is used as the wallet userId when present", async () => {
    const { providers, notes } = createProviders({ ...ARC_PAYER_ENV, DYNAMIC_USER_ID: "sub-xyz" })
    const session = await providers.wallet.signIn()
    expect(session.userId).toBe("sub-xyz")
    expect(notes.join("\n")).not.toMatch(/DYNAMIC_USER_ID/)
  })

  test("mnemonic present but unknown env without engineUrl → mock privacy, honest note", () => {
    const { providers, live, notes } = createProviders({
      ...ARC_PAYER_ENV,
      UNLINK_MNEMONIC: "test test test test test test test test test test test junk",
    })
    expect(providers.privacy).toBeInstanceOf(MockPrivacyProvider)
    expect(live.privacy).toBe(false)
    expect(notes.join("\n")).toMatch(/not built into the SDK/)
  })
})
