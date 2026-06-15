import { describe, expect, test } from "bun:test"
import {
  allowedImpressionCount,
  MAX_IMPRESSIONS_PER_REQUEST,
  MAX_IMPRESSIONS_PER_WINDOW,
  MAX_IMPRESSIONS_PER_DAY,
} from "../src/ratelimit"

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

  test("ignores the day window by default (recentInDay unset → no daily clamp)", () => {
    // Far below MAX_IMPRESSIONS_PER_DAY: the window cap alone governs, unchanged.
    expect(allowedImpressionCount({ requested: 10, recentInWindow: 0 })).toBe(10)
  })

  test("clamps to the remaining daily room", () => {
    expect(allowedImpressionCount({ requested: 50, recentInWindow: 0, recentInDay: MAX_IMPRESSIONS_PER_DAY - 5 })).toBe(5)
  })

  test("returns 0 when the day is full (even with window room left)", () => {
    expect(allowedImpressionCount({ requested: 50, recentInWindow: 0, recentInDay: MAX_IMPRESSIONS_PER_DAY })).toBe(0)
  })

  test("takes the tightest of request / window / day caps", () => {
    // Window has room for 10, but only 3 left in the day → 3 wins.
    expect(
      allowedImpressionCount({ requested: 100, recentInWindow: MAX_IMPRESSIONS_PER_WINDOW - 10, recentInDay: MAX_IMPRESSIONS_PER_DAY - 3 }),
    ).toBe(3)
  })

  test("honors an injected daily limit", () => {
    expect(allowedImpressionCount({ requested: 50, recentInWindow: 0, recentInDay: 8, maxPerDay: 10 })).toBe(2)
  })
})
