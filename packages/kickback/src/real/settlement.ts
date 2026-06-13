// RealSettlementProvider — Circle Gateway x402 batched nanopayments on Arc.
//
// Adapts `@circle-fin/x402-batching` `GatewayClient` to our SettlementProvider.
// Signatures verified against the installed types (3.0.4):
//   new GatewayClient({ chain, privateKey, rpcUrl })
//   deposit(amount: decimal string) -> DepositResult
//   getBalances() -> { gateway: { available: bigint, ... }, wallet: {...} }
//   pay(url) -> { amount: bigint /* atomic units */, transaction: string, ... }
// The payer MUST be a plain EOA (keep USDC on it — USDC is gas on Arc).

import { GatewayClient } from "@circle-fin/x402-batching/client"
import type { SupportedChainName } from "@circle-fin/x402-batching/client"
import type { Hex } from "../config"
import type { BaseUnits } from "../money"
import type { SettlementProvider, SettlementReceipt } from "../settlement"

export interface RealSettlementConfig {
  /** Payer EOA private key (Circle uses it to sign deposits + payment auth). */
  privateKey: Hex
  /** Arc testnet RPC URL. */
  rpcUrl: string
  /** Circle chain key (camelCase). Defaults to "arcTestnet" (Gateway domain 26). */
  chain?: SupportedChainName
}

export class RealSettlementProvider implements SettlementProvider {
  private readonly client: GatewayClient

  constructor(config: RealSettlementConfig) {
    this.client = new GatewayClient({
      chain: config.chain ?? "arcTestnet",
      privateKey: config.privateKey,
      rpcUrl: config.rpcUrl,
    })
  }

  /** Deposit decimal USDC ("1.99") into the Gateway wallet (approve + deposit). */
  async deposit(decimalAmount: string): Promise<void> {
    await this.client.deposit(decimalAmount)
  }

  /** Spendable Gateway balance, in base units. */
  async getDepositedBalance(): Promise<BaseUnits> {
    const balances = await this.client.getBalances()
    return balances.gateway.available
  }

  /** Run the full x402 402-challenge → pay flow and map the result to a receipt. */
  async pay(resourceUrl: string): Promise<SettlementReceipt> {
    const result = await this.client.pay(resourceUrl)
    return {
      resourceUrl,
      amount: result.amount, // already atomic/base units (bigint)
      reference: result.transaction,
    }
  }
}

export function createRealSettlementProvider(config: RealSettlementConfig): RealSettlementProvider {
  return new RealSettlementProvider(config)
}
