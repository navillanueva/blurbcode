import { describe, expect, test } from "bun:test"
import { readKickbackEnv } from "../src/config"

// Hardhat test account #0 — a PUBLIC well-known key, never a real secret.
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
const TEST_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
const USDC = "0x3600000000000000000000000000000000000000"

const FULL_ENV: Record<string, string | undefined> = {
  ARC_TESTNET_RPC_URL: "https://rpc.testnet.arc.network",
  ARC_CHAIN_ID: "5042002",
  ARC_USDC_ADDRESS: USDC,
  PAYER_ADDRESS: TEST_ADDR,
  PAYER_PRIVATE_KEY: TEST_KEY,
  DYNAMIC_ENVIRONMENT_ID: "env-123",
  DYNAMIC_SERVER_API_KEY: "dyn_secret",
  DYNAMIC_USER_ID: "user-abc",
  UNLINK_ENVIRONMENT: "arc-testnet",
  UNLINK_API_KEY: "unlink_secret",
  UNLINK_MNEMONIC: "test test test",
  UNLINK_ENGINE_URL: "https://engine.example",
}

describe("readKickbackEnv", () => {
  test("parses a fully-populated environment", () => {
    const cfg = readKickbackEnv(FULL_ENV)
    expect(cfg.arc).toEqual({
      rpcUrl: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      usdc: { symbol: "USDC", address: USDC, decimals: 6 },
    })
    expect(cfg.payer).toEqual({ address: TEST_ADDR, privateKey: TEST_KEY })
    expect(cfg.dynamic).toEqual({
      environmentId: "env-123",
      serverApiKey: "dyn_secret",
      userId: "user-abc",
    })
    expect(cfg.unlink).toEqual({
      environment: "arc-testnet",
      engineUrl: "https://engine.example",
      apiKey: "unlink_secret",
      mnemonic: "test test test",
    })
  })

  test("chainId is a number, not a string", () => {
    const cfg = readKickbackEnv(FULL_ENV)
    expect(typeof cfg.arc?.chainId).toBe("number")
  })

  test("rejects a malformed private key (arc still parses, payer drops)", () => {
    const cfg = readKickbackEnv({ ...FULL_ENV, PAYER_PRIVATE_KEY: "0xnothex" })
    expect(cfg.payer).toBeUndefined()
    expect(cfg.arc).toBeDefined()
  })

  test("rejects a malformed USDC address (arc drops)", () => {
    const cfg = readKickbackEnv({ ...FULL_ENV, ARC_USDC_ADDRESS: "0x1234" })
    expect(cfg.arc).toBeUndefined()
  })

  test("rejects a non-numeric chain id", () => {
    const cfg = readKickbackEnv({ ...FULL_ENV, ARC_CHAIN_ID: "abc" })
    expect(cfg.arc).toBeUndefined()
  })

  test("treats empty strings as absent", () => {
    const cfg = readKickbackEnv({ ...FULL_ENV, PAYER_ADDRESS: "  ", DYNAMIC_USER_ID: "" })
    expect(cfg.payer).toBeUndefined()
    expect(cfg.dynamic.userId).toBeUndefined()
  })

  test("defaults UNLINK_ENVIRONMENT to arc-testnet when unset", () => {
    const cfg = readKickbackEnv({})
    expect(cfg.unlink.environment).toBe("arc-testnet")
    expect(cfg.unlink.mnemonic).toBeUndefined()
    expect(cfg.arc).toBeUndefined()
    expect(cfg.payer).toBeUndefined()
  })
})
