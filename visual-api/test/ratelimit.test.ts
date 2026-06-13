import { describe, expect, test } from "bun:test"
import { allowedImpressionCount, MAX_IMPRESSIONS_PER_REQUEST, MAX_IMPRESSIONS_PER_WINDOW } from "../src/ratelimit"

describe("allowedImpressionCount", () => {
  test("passes through a modest request", () => {
    expect(allowedImpressionCount({ requested: 10, recentInWindow: 0 })).toBe(10)
  })

  test("clamps to the per-request cap", () => {
    expect(allowedImpressionCount({ requested: 10_000, recentInWindow: 0 })).toBe(MAX_IMPRESSIONS_PER_REQUEST)
  })

  test("clamps to the remaining window room", () => {
    expect(allowedImpressionCount({ requested: 50, recentInWindow: MAX_IMPRESSIONS_PER_WINDOW - 5 })).toBe(5)
  })

  test("returns 0 when the window is full", () => {
    expect(allowedImpressionCount({ requested: 50, recentInWindow: MAX_IMPRESSIONS_PER_WINDOW })).toBe(0)
  })

  test("never negative", () => {
    expect(allowedImpressionCount({ requested: -5, recentInWindow: 0 })).toBe(0)
    expect(allowedImpressionCount({ requested: 10, recentInWindow: MAX_IMPRESSIONS_PER_WINDOW + 100 })).toBe(0)
  })

  test("honors injected limits", () => {
    expect(allowedImpressionCount({ requested: 5, recentInWindow: 0, maxPerRequest: 3 })).toBe(3)
    expect(allowedImpressionCount({ requested: 5, recentInWindow: 4, maxPerWindow: 6 })).toBe(2)
  })
})
