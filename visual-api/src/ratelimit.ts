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

/**
 * How many of `requested` impressions to actually credit, given how many were
 * already recorded for this account inside the window. Clamps to the per-request
 * cap first, then to whatever room is left in the window. Never negative.
 */
export function allowedImpressionCount(params: {
  requested: number
  recentInWindow: number
  maxPerRequest?: number
  maxPerWindow?: number
}): number {
  const maxReq = params.maxPerRequest ?? MAX_IMPRESSIONS_PER_REQUEST
  const maxWin = params.maxPerWindow ?? MAX_IMPRESSIONS_PER_WINDOW
  const requested = Math.max(0, Math.trunc(params.requested))
  const recent = Math.max(0, Math.trunc(params.recentInWindow))
  const perRequest = Math.min(requested, maxReq)
  const windowRoom = Math.max(0, maxWin - recent)
  return Math.min(perRequest, windowRoom)
}
