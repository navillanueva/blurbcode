import { describe, expect, test } from "bun:test"
import { startViewTracking, IMPRESSION_INTERVAL_MS, type ViewTrackingTimers } from "../../src/kickback/view-tracking"
import { createAdStore, type Ad } from "../../src/kickback/ad-store"

const AD: Ad = {
  id: "t",
  advertiser: "Test",
  text: "x",
  url: "https://example.com",
  blockBidBaseUnits: 1_000_000n,
}

/** Fake clock: captures the interval callback so tests can drive it deterministically. */
function fakeTimers() {
  let callback: (() => void) | null = null
  let ms = 0
  let cleared = false
  const timers: ViewTrackingTimers = {
    setInterval(cb, interval) {
      callback = cb
      ms = interval
      return 1 as unknown as ReturnType<typeof setInterval>
    },
    clearInterval() {
      cleared = true
      callback = null
    },
  }
  return {
    timers,
    tick: () => callback?.(),
    intervalMs: () => ms,
    isCleared: () => cleared,
  }
}

describe("startViewTracking", () => {
  test("defaults to a 5-second impression interval", () => {
    const clock = fakeTimers()
    startViewTracking(createAdStore({ enabled: true, ad: AD }), { timers: clock.timers })
    expect(clock.intervalMs()).toBe(IMPRESSION_INTERVAL_MS)
    expect(IMPRESSION_INTERVAL_MS).toBe(5000)
  })

  test("each interval tick records one impression", () => {
    const clock = fakeTimers()
    const store = createAdStore({ enabled: true, ad: AD })
    startViewTracking(store, { timers: clock.timers })
    clock.tick()
    clock.tick()
    clock.tick()
    expect(store.getState().impressions).toBe(3)
  })

  test("ticks while consent is off do not accrue", () => {
    const clock = fakeTimers()
    const store = createAdStore({ enabled: false, ad: AD })
    startViewTracking(store, { timers: clock.timers })
    clock.tick()
    clock.tick()
    expect(store.getState().impressions).toBe(0)
  })

  test("stop() clears the interval and is idempotent", () => {
    const clock = fakeTimers()
    const store = createAdStore({ enabled: true, ad: AD })
    const stop = startViewTracking(store, { timers: clock.timers })
    clock.tick()
    stop()
    expect(clock.isCleared()).toBe(true)
    clock.tick() // no callback after clear
    expect(store.getState().impressions).toBe(1)
    stop() // safe to call again
  })

  test("respects a custom interval", () => {
    const clock = fakeTimers()
    startViewTracking(createAdStore({ enabled: true, ad: AD }), { timers: clock.timers, intervalMs: 1000 })
    expect(clock.intervalMs()).toBe(1000)
  })
})
