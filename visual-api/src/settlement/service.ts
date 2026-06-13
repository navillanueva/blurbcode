// The settlement boundary the routes depend on. It moves money on-chain (or
// simulates it in mock mode) and returns a reference; the DB-side accounting
// (budget decrement, earnings credit) lives in the repo layer, not here.
//
// fundCampaign  → advertiser deposit when a campaign is funded (Unlink private
//                 deposit on Arc in real mode).
// withdrawEarnings → pay developer earnings out to their wallet (Circle Gateway
//                 x402 + Unlink transfer/withdraw in real mode).

import type { BaseUnits } from "@kickback/money"

export interface SettlementResult {
  /** On-chain tx / settlement reference (or a deterministic mock ref). */
  txRef: string
}

export interface SettlementService {
  readonly mode: "mock" | "real"
  /** Which underlying providers are the real vendor-SDK impls vs mocks. */
  readonly live: { wallet: boolean; privacy: boolean; settlement: boolean }
  /** Human-readable notes on any mock fallback (golden rule: surface, don't fake). */
  readonly notes: string[]
  fundCampaign(p: {
    campaignId: string
    amountBaseUnits: BaseUnits
    advertiserAddress: string
  }): Promise<SettlementResult>
  withdrawEarnings(p: {
    accountId: string
    amountBaseUnits: BaseUnits
    recipientEvmAddress: string
  }): Promise<SettlementResult>
}
