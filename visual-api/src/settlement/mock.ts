// Mock settlement — the default for all dev/repeated work (golden rule 5). No
// network, deterministic refs. It still drives the shared `packages/kickback`
// mock providers (ensureRegistered / deposit / signIn) so the wiring exercised in
// dev is the same shape the real providers implement.

import { createMockPrivacyProvider, createMockSettlementProvider, createMockWalletProvider } from "@kickback/mock"
import { fromBaseUnits } from "@kickback/money"
import type { SettlementService } from "./service"

export function createMockSettlementService(): SettlementService {
  const privacy = createMockPrivacyProvider()
  const settlement = createMockSettlementProvider()
  const wallet = createMockWalletProvider()
  let funds = 0
  let withdraws = 0

  return {
    mode: "mock",
    live: { wallet: false, privacy: false, settlement: false },
    notes: ["settlement: SETTLEMENT_MODE=mock — no on-chain calls; deterministic refs"],

    async fundCampaign({ campaignId, amountBaseUnits }) {
      await privacy.ensureRegistered()
      if (amountBaseUnits > 0n) {
        // Gateway deposits take a decimal USDC string (not base units).
        await settlement.deposit(fromBaseUnits(amountBaseUnits))
      }
      funds += 1
      return { txRef: `mock-fund:${campaignId}:${funds}` }
    },

    async withdrawEarnings({ accountId }) {
      await wallet.signIn()
      await privacy.ensureRegistered()
      withdraws += 1
      return { txRef: `mock-withdraw:${accountId}:${withdraws}` }
    },
  }
}
