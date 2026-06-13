// Trivial ascending auction (pure). The highest-bidding active campaign that
// still has budget wins the status-line slot; ties break to the earliest-created
// campaign (first bid takes the slot, per the kickbacks model). Returns the ad to
// serve or `null` when the slot has no eligible winner.

import type { BaseUnits } from "@kickback/money"

export interface AuctionCandidate {
  id: string
  advertiser: string
  text: string
  url: string
  bidBaseUnits: BaseUnits
  budgetRemaining: BaseUnits
  status: string
  /** Tie-breaker — earlier wins. Accepts a Date or epoch ms. */
  createdAt: Date | number
}

/** The CONTRACT shape returned by GET /api/ad/serve. */
export interface ServedAd {
  id: string
  advertiser: string
  text: string
  url: string
}

function ms(t: Date | number): number {
  return typeof t === "number" ? t : t.getTime()
}

/** Pick the auction winner, or `null` if no campaign is eligible. */
export function selectWinner(candidates: AuctionCandidate[]): ServedAd | null {
  const eligible = candidates.filter((c) => c.status === "active" && c.budgetRemaining > 0n && c.bidBaseUnits > 0n)
  if (eligible.length === 0) return null
  eligible.sort((a, b) => {
    if (a.bidBaseUnits !== b.bidBaseUnits) return a.bidBaseUnits > b.bidBaseUnits ? -1 : 1
    return ms(a.createdAt) - ms(b.createdAt)
  })
  const w = eligible[0]
  if (!w) return null
  return { id: w.id, advertiser: w.advertiser, text: w.text, url: w.url }
}
