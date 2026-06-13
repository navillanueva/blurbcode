// Per-impression accounting (pure, deterministic — the unit-tested core).
//
// A bid is priced per 1,000 impressions (one "block", per the kickbacks economic
// model). For `count` impressions the advertiser is charged
// `floor(bid * count / 1000)`, clamped to the remaining budget so a campaign can
// never overspend. The developer is credited 50% of whatever was actually
// charged; the other 50% is the platform's. All math is bigint base units.

import type { BaseUnits } from "@kickback/money"

/** One bid covers this many 5-second impressions. */
export const IMPRESSIONS_PER_BLOCK = 1000n

/** Developer revenue share of each charge (50%). */
export const DEV_SHARE_NUMERATOR = 1n
export const DEV_SHARE_DENOMINATOR = 2n

export interface ImpressionCharge {
  /** Total decremented from the advertiser's remaining budget. */
  charge: BaseUnits
  /** Credited to the developer (50% of `charge`). */
  devCredit: BaseUnits
}

/**
 * Compute the charge + developer credit for `count` impressions. Returns zeros
 * for non-positive inputs. `charge` is clamped to `budgetRemaining`, so the
 * caller can apply it without a separate overspend check.
 */
export function computeImpressionCharge(params: {
  bidBaseUnits: BaseUnits
  budgetRemaining: BaseUnits
  count: number
}): ImpressionCharge {
  const { bidBaseUnits, budgetRemaining } = params
  const count = BigInt(Math.max(0, Math.trunc(params.count)))
  if (count === 0n || bidBaseUnits <= 0n || budgetRemaining <= 0n) {
    return { charge: 0n, devCredit: 0n }
  }
  let charge = (bidBaseUnits * count) / IMPRESSIONS_PER_BLOCK
  if (charge > budgetRemaining) charge = budgetRemaining
  const devCredit = (charge * DEV_SHARE_NUMERATOR) / DEV_SHARE_DENOMINATOR
  return { charge, devCredit }
}
