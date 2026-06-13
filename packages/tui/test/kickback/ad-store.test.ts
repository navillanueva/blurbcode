import { describe, expect, test } from "bun:test"
import {
  createAdStore,
  developerEarnings,
  type Ad,
  CLICK_MULTIPLIER,
} from "../../src/kickback/ad-store"

const AD: Ad = {
  id: "t1",
  advertiser: "Test Co",
  text: "buy stuff",
  url: "https://example.com/x",
  blockBidBaseUnits: 1_000_000n, // 1 USDC per 1,000 impressions
}

describe("developerEarnings", () => {
  test("a full block of impressions earns the 50% developer share", () => {
    // 1000 impressions = 1 block = 1 USDC gross; dev share = 0.5 USDC = 500_000 base units
    expect(developerEarnings(AD, 1000, 0)).toBe(500_000n)
  })

  test("scales linearly with impressions (floored, never rounded up)", () => {
    // 2 impressions: gross = 2 * 1_000_000 / 1000 = 2000; dev = 1000
    expect(developerEarnings(AD, 2, 0)).toBe(1_000n)
  })

  test("a click is worth CLICK_MULTIPLIER impressions", () => {
    expect(CLICK_MULTIPLIER).toBe(50n)
    // 1 click = 50 impression-equivalents: gross = 50 * 1_000_000 / 1000 = 50_000; dev = 25_000
    expect(developerEarnings(AD, 0, 1)).toBe(25_000n)
  })

  test("impressions and clicks combine", () => {
    // weighted = 10 + 1*50 = 60; gross = 60 * 1_000_000 / 1000 = 60_000; dev = 30_000
    expect(developerEarnings(AD, 10, 1)).toBe(30_000n)
  })

  test("no ad or negative counters earn nothing", () => {
    expect(developerEarnings(null, 100, 1)).toBe(0n)
    expect(developerEarnings(AD, -1, 0)).toBe(0n)
  })
})

describe("createAdStore", () => {
  test("records impressions and clicks, deriving earnings", () => {
    const store = createAdStore({ enabled: true, ad: AD })
    store.recordImpression()
    store.recordImpression()
    store.recordClick()
    const s = store.getState()
    expect(s.impressions).toBe(2)
    expect(s.clicks).toBe(1)
    // weighted = 2 + 50 = 52; gross = 52_000; dev = 26_000
    expect(s.developerEarningsBaseUnits).toBe(26_000n)
  })

  test("consent off (kill-switch) blocks all accrual", () => {
    const store = createAdStore({ enabled: false, ad: AD })
    store.recordImpression()
    store.recordClick()
    expect(store.getState().impressions).toBe(0)
    expect(store.getState().clicks).toBe(0)
  })

  test("no accrual without an ad set", () => {
    const store = createAdStore({ enabled: true, ad: null })
    store.recordImpression()
    expect(store.getState().impressions).toBe(0)
  })

  test("toggleEnabled flips and returns the new value", () => {
    const store = createAdStore({ enabled: true, ad: AD })
    expect(store.toggleEnabled()).toBe(false)
    store.recordImpression()
    expect(store.getState().impressions).toBe(0) // blocked while off
    expect(store.toggleEnabled()).toBe(true)
    store.recordImpression()
    expect(store.getState().impressions).toBe(1)
  })

  test("subscribers fire on change and stop after unsubscribe", () => {
    const store = createAdStore({ enabled: true, ad: AD })
    const seen: number[] = []
    const unsub = store.subscribe((s) => seen.push(s.impressions))
    store.recordImpression() // -> 1
    store.recordImpression() // -> 2
    unsub()
    store.recordImpression() // not observed
    expect(seen).toEqual([1, 2])
  })

  test("resetCounters clears counts but keeps the ad", () => {
    const store = createAdStore({ enabled: true, ad: AD })
    store.recordImpression()
    store.resetCounters()
    expect(store.getState().impressions).toBe(0)
    expect(store.getState().ad).toBe(AD)
  })

  test("setAd swaps the served ad", () => {
    const store = createAdStore({ enabled: true, ad: AD })
    store.setAd(null)
    expect(store.getState().ad).toBeNull()
    store.recordImpression()
    expect(store.getState().impressions).toBe(0)
  })
})
