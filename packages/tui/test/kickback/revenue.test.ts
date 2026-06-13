import { describe, expect, test } from "bun:test"
import { buildRevenueView, getDemoPrivateBalance, readPrivateBalance } from "../../src/kickback/revenue"
import { createAdStore, SAMPLE_AD, developerEarnings } from "../../src/kickback/ad-store"
import { createMockPrivacyProvider, MOCK_USDC } from "@kickback-ai/providers/mock"

describe("buildRevenueView", () => {
  test("maps an empty store to a zeroed, ad-less view", () => {
    const store = createAdStore({ enabled: true, ad: null })
    const view = buildRevenueView(store.getState(), 0n)
    expect(view.hasAd).toBe(false)
    expect(view.advertiser).toBe("")
    expect(view.adText).toBe("")
    expect(view.adUrl).toBe("")
    expect(view.impressions).toBe(0)
    expect(view.clicks).toBe(0)
    expect(view.earningsUsdc).toBe("0")
    expect(view.privateBalanceUsdc).toBe("0")
    expect(view.enabled).toBe(true)
  })

  test("surfaces ad fields and formats accrued earnings from counters", () => {
    const store = createAdStore({ enabled: true, ad: SAMPLE_AD })
    // 1000 impressions = exactly one block at the SAMPLE_AD bid (1 USDC), 50% share.
    for (let i = 0; i < 1000; i++) store.recordImpression()
    const state = store.getState()
    const view = buildRevenueView(state, 0n)

    expect(view.hasAd).toBe(true)
    expect(view.advertiser).toBe(SAMPLE_AD.advertiser)
    expect(view.adText).toBe(SAMPLE_AD.text)
    expect(view.adUrl).toBe(SAMPLE_AD.url)
    expect(view.impressions).toBe(1000)
    // developerEarnings stays the single source of truth; view just formats it.
    expect(state.developerEarningsBaseUnits).toBe(developerEarnings(SAMPLE_AD, 1000, 0))
    expect(view.earningsUsdc).toBe("0.5") // 1 USDC block × 50% share
  })

  test("formats the private balance independently of earnings", () => {
    const store = createAdStore({ enabled: true, ad: SAMPLE_AD })
    const view = buildRevenueView(store.getState(), 2_500_000n)
    expect(view.privateBalanceUsdc).toBe("2.5")
  })

  test("mirrors the consent kill-switch", () => {
    const store = createAdStore({ enabled: false, ad: SAMPLE_AD })
    expect(buildRevenueView(store.getState(), 0n).enabled).toBe(false)
  })
})

describe("readPrivateBalance", () => {
  test("returns 0 for an account holding no USDC", async () => {
    const privacy = createMockPrivacyProvider()
    await privacy.ensureRegistered()
    expect(await readPrivateBalance(privacy)).toBe(0n)
  })

  test("returns the held USDC balance after a faucet credit", async () => {
    const privacy = createMockPrivacyProvider()
    await privacy.ensureRegistered()
    await privacy.requestFaucet(MOCK_USDC)
    expect(await readPrivateBalance(privacy)).toBe(1_000_000n)
  })
})

describe("getDemoPrivateBalance", () => {
  test("seeds a non-zero demo balance offline and is stable across calls", async () => {
    const first = await getDemoPrivateBalance()
    expect(first).toBe(1_000_000n) // one faucet seed = 1 USDC
    // Singleton: a second call does not double-seed.
    const second = await getDemoPrivateBalance()
    expect(second).toBe(first)
  })
})
