// Migrated from packages/kickback/src/real/privacy.ts — Unlink private balances
// on Arc testnet (the privacy layer that makes amounts/counterparties/graph
// unlinkable, with a view key for audit).
//
// EXCLUDED FROM THE DEFAULT TYPECHECK: @unlink-xyz/sdk@0.3.0-canary.552 is NOT on
// the public npm registry, so it can't be installed in this sandbox. This file is
// only loaded via the factory's dynamic import when SETTLEMENT_MODE=real, in an
// environment that has the SDK. It is a faithful port of the already-typechecked
// kickback provider. See tsconfig.json `exclude` and README "Real settlement".
//
// Verified shapes (canary .552):
//   createUnlinkClient({ environment | engineUrl, account }) -> UnlinkClient
//   account.fromMnemonic({ mnemonic }) -> UnlinkLocalAccount
//   client.ensureRegistered() / transfer(p) / withdraw(p) / faucet.requestPrivateTokens(p)
//   client.balanceOf(token) -> string | null   (base-unit decimal string)

import { account, createUnlinkClient } from "@unlink-xyz/sdk/client"
import type { UnlinkClient, UnlinkLocalAccount } from "@unlink-xyz/sdk/client"
import type { BaseUnits, Token } from "@kickback/money"

export interface RealUnlinkConfig {
  environment?: string
  /** Engine URL escape hatch — required for "arc-testnet" (not built into the SDK). */
  engineUrl?: string
  account: UnlinkLocalAccount
  token: Token
}

export class RealUnlinkPrivacy {
  private readonly client: UnlinkClient
  private readonly token: Token

  constructor(config: RealUnlinkConfig) {
    const connection = config.engineUrl ? { engineUrl: config.engineUrl } : { environment: config.environment }
    this.client = createUnlinkClient({ ...connection, account: config.account })
    this.token = config.token
  }

  async ensureRegistered(): Promise<void> {
    await this.client.ensureRegistered()
  }

  async getBalance(): Promise<BaseUnits> {
    const raw = await this.client.balanceOf(this.token.address)
    return BigInt(raw ?? "0")
  }

  async requestFaucet(): Promise<void> {
    await this.client.faucet.requestPrivateTokens({ token: this.token.address })
  }

  /** Privately transfer `amount` (base units) to another Unlink account. */
  async transfer(params: { recipientAddress: string; amount: BaseUnits }): Promise<void> {
    await this.client.transfer({
      token: this.token.address,
      amount: params.amount.toString(),
      recipientAddress: params.recipientAddress,
    })
  }

  /** Withdraw `amount` (base units) privately out to a public EVM address. */
  async withdraw(params: { recipientEvmAddress: string; amount: BaseUnits }): Promise<void> {
    await this.client.withdraw({
      recipientEvmAddress: params.recipientEvmAddress,
      token: this.token.address,
      amount: params.amount.toString(),
    })
  }
}

/** Build an Unlink local account from a BIP-39 mnemonic (local key derivation). */
export function unlinkAccountFromMnemonic(mnemonic: string): UnlinkLocalAccount {
  return account.fromMnemonic({ mnemonic })
}
