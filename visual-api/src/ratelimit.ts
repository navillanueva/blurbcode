// Impression rate-limiting / dedup (pure). Impressions are client-reported, so
// the backend bounds them: a hard per-request cap and a rolling per-account
// window cap. This is MVP-level abuse resistance, NOT real ad-fraud defense —
// documented as such in the README and CONTRACT graceful-degradation note.

/** Max impressions accepted in a single POST /api/impressions call. */
export const MAX_IMPRESSIONS_PER_REQUEST = 120

/** Rolling window for the per-account cap. */
export const RATE_WINDOW_MS = 60_000

/**
 * Max impressions credited to one account per window. A real 5s view yields ~12
 * impressions/minute; 600 is far above any honest rate while still bounding abuse.
 */
export const MAX_IMPRESSIONS_PER_WINDOW = 600

/** Rolling 24h window for the per-account daily cap. */
export const DAY_WINDOW_MS = 86_400_000

/**
 * Max impressions credited to one account per rolling day. A real 5s view yields
 * ~12 impressions/minute, so a *full* 24h of continuous honest viewing is
 * 24 * 60 * 12 = 17,280 — a ceiling no human legitimately exceeds (nobody codes
 * 24h straight). The per-minute cap stops bursts; this stops a single account
 * grinding the per-minute cap around the clock. Under fixed $10/1,000 pricing this
 * bounds one account's daily charge to ~$172.80 (dev share ~$86.40) — tune lower if
 * that headroom feels generous; combined with the World-ID one-human-one-account
 * payout gate, it bounds total single-human daily take, not just per-account.
 */
export const MAX_IMPRESSIONS_PER_DAY = 17_280

/**
 * How many of `requested` impressions to actually credit, given how many were
 * already recorded for this account inside the minute window AND the rolling day.
 * Clamps to the per-request cap, then to whatever room is left in the minute
 * window, then to whatever room is left in the day. Never negative. `recentInDay`
 * defaults to 0 so existing callers (and the pure unit tests) keep their behavior.
 */
export function allowedImpressionCount(params: {
  requested: number
  recentInWindow: number
  recentInDay?: number
  maxPerRequest?: number
  maxPerWindow?: number
  maxPerDay?: number
}): number {
  const maxReq = params.maxPerRequest ?? MAX_IMPRESSIONS_PER_REQUEST
  const maxWin = params.maxPerWindow ?? MAX_IMPRESSIONS_PER_WINDOW
  const maxDay = params.maxPerDay ?? MAX_IMPRESSIONS_PER_DAY
  const requested = Math.max(0, Math.trunc(params.requested))
  const recent = Math.max(0, Math.trunc(params.recentInWindow))
  const recentDay = Math.max(0, Math.trunc(params.recentInDay ?? 0))
  const perRequest = Math.min(requested, maxReq)
  const windowRoom = Math.max(0, maxWin - recent)
  const dayRoom = Math.max(0, maxDay - recentDay)
  return Math.min(perRequest, windowRoom, dayRoom)
}

/** Max ad clicks recorded for one account per minute window (measurement integrity:
 *  stops a saved click URL being hammered). Clicks are not monetized — generous. */
export const MAX_CLICKS_PER_WINDOW = 30
