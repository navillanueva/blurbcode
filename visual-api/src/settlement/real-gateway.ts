// Migrated from packages/kickback/src/real/settlement.ts — Circle Gateway x402
// batched nanopayments on Arc. The payer is a plain server-side EOA (keep USDC on
// it — USDC is gas on Arc). This is the "Dynamic server wallet / payer EOA" that
// holds settlement authority per visual-code-mvp-architecture.md.
//
// @circle-fin/x402-batching IS on the public registry, so this file is part of
// the normal typecheck. Signatures verified against 3.0.4:
//   new GatewayClient({ chain, privateKey, rpcUrl })
//   deposit(amount: decimal string) ; getBalances() -> { gateway: { available: bigint } }
//   pay(url) -> { amount: bigint, transaction: string }

import { GatewayClient, type SupportedChainName } from "@circle-fin/x402-batching/client"
import type { Hex } from "@kickback/config"
import type { BaseUnits } from "@kickback/money"

export interface RealGatewayConfig {
  /** Payer EOA private key (signs deposits + x402 payment authorizations). */
  privateKey: Hex
  /** Arc testnet RPC URL. */
  rpcUrl: string
  /** Circle chain key (camelCase). Defaults to "arcTestnet". */
  chain?: SupportedChainName
}

export interface GatewayReceipt {
  resourceUrl: string
  amount: BaseUnits
  reference?: string
}

export class RealGatewaySettlement {
  private readonly client: GatewayClient

  constructor(config: RealGatewayConfig) {
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
  async pay(resourceUrl: string): Promise<GatewayReceipt> {
    const result = await this.client.pay(resourceUrl)
    return { resourceUrl, amount: result.amount, reference: result.transaction }
  }
}
