// Kickback AI — view tracking (Task 3).
//
// Counts 5-second impressions for the rendered ad. A counted impression = the ad slot
// stayed live for one full interval. The fixed interval IS the debounce: at most one
// impression per window, so we never over-count a busy render loop.
//
// The store's recordImpression() already no-ops when consent is off or the slot is
// empty, so the tracker stays dumb — it just ticks. Timers are injectable so the
// behavior is unit-testable without real wall-clock waits.
//
// TODO(human): for production fidelity, gate ticks on terminal focus/visibility (don't
// accrue while the terminal is backgrounded). MVP counts whenever the slot is mounted.

import type { AdStore } from "./ad-store"

/** Reference economic model: 1 impression = 5 seconds of exposure. */
export const IMPRESSION_INTERVAL_MS = 5000

type IntervalHandle = ReturnType<typeof setInterval>

/** Injectable timer surface (defaults to the global timers). */
export interface ViewTrackingTimers {
  setInterval(callback: () => void, ms: number): IntervalHandle
  clearInterval(handle: IntervalHandle): void
}

export interface ViewTrackingOptions {
  /** Milliseconds per counted impression. Defaults to IMPRESSION_INTERVAL_MS (5s). */
  intervalMs?: number
  /** Override the timers (tests inject a fake clock). */
  timers?: ViewTrackingTimers
}

const defaultTimers: ViewTrackingTimers = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle),
}

/**
 * Start counting impressions into `store`. Returns a stop function that clears the
 * interval; calling it more than once is safe.
 */
export function startViewTracking(
  store: Pick<AdStore, "recordImpression">,
  options: ViewTrackingOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? IMPRESSION_INTERVAL_MS
  const timers = options.timers ?? defaultTimers
  const handle = timers.setInterval(() => store.recordImpression(), intervalMs)

  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    timers.clearInterval(handle)
  }
}
