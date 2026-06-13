// RealPrivacyProvider — Unlink private balances on Arc testnet.
//
// Adapts `@unlink-xyz/sdk` to our PrivacyProvider. Signatures verified against the
// installed canary types (0.3.0-canary.552). NOTE: we import the framework-agnostic
// `@unlink-xyz/sdk/client` entry (not `/browser`) because this adapter runs in the
// TUI's Bun/Node process, not a browser — both entries export the same
// `createUnlinkClient` + `account`. Verified shapes:
//   createUnlinkClient({ environment | engineUrl, account }) -> UnlinkClient
//   account.fromMnemonic({ mnemonic }) -> UnlinkLocalAccount
//   client.ensureRegistered() / transfer(p) / withdraw(p) / faucet.requestPrivateTokens(p)
//   client.balanceOf(token) -> string | null   (base-unit decimal string)
//   transfer/withdraw/faucet amounts are base-unit strings ("1000000" = 1 USDC).
//
// ⚠️ "arc-testnet" is NOT a built-in environment in canary .552 — supply
// `engineUrl` (the escape hatch) for a verified Arc Engine URL, or use a build
// where Arc is registered. createUnlinkClient resolves the URL eagerly, so an
// unknown `environment` with no `engineUrl` throws at construction.

import { account, createUnlinkClient } from "@unlink-xyz/sdk/client"
import type { UnlinkClient, UnlinkLocalAccount } from "@unlink-xyz/sdk/client"
import type { BaseUnits, Token } from "../money"
import type { PrivacyBalance, PrivacyProvider, PrivacyTransfer, PrivacyWithdraw } from "../privacy"

export interface RealPrivacyConfig {
  /** Named hosted environment (e.g. "arc-testnet"). Ignored when `engineUrl` is set. */
  environment?: string
  /** Engine URL escape hatch — required for environments not built into the SDK. */
  engineUrl?: string
  /** The user's private Unlink account (e.g. `unlinkAccountFromMnemonic(...)`). */
  account: UnlinkLocalAccount
  /** The token whose private balance we report (Arc USDC). */
  token: Token
}

export class RealPrivacyProvider implements PrivacyProvider {
  private readonly client: UnlinkClient
  private readonly token: Token

  constructor(config: RealPrivacyConfig) {
    // Exactly one of engineUrl / environment must be set (the SDK throws otherwise).
    const connection = config.engineUrl
      ? { engineUrl: config.engineUrl }
      : { environment: config.environment }
    this.client = createUnlinkClient({ ...connection, account: config.account })
    this.token = config.token
  }

  async ensureRegistered(): Promise<void> {
    await this.client.ensureRegistered()
  }

  async getBalances(): Promise<PrivacyBalance[]> {
    const raw = await this.client.balanceOf(this.token.address)
    return [{ token: this.token, amount: BigInt(raw ?? "0") }]
  }

  async requestFaucet(token: Token): Promise<void> {
    await this.client.faucet.requestPrivateTokens({ token: token.address })
  }

  async transfer(params: PrivacyTransfer): Promise<void> {
    await this.client.transfer({
      token: params.token.address,
      amount: params.amount.toString(),
      recipientAddress: params.recipientAddress,
    })
  }

  async withdraw(params: PrivacyWithdraw): Promise<void> {
    await this.client.withdraw({
      recipientEvmAddress: params.recipientEvmAddress,
      token: params.token.address,
      amount: params.amount.toString(),
    })
  }
}

/** Build an Unlink local account from a BIP-39 mnemonic (local key derivation). */
export function unlinkAccountFromMnemonic(mnemonic: string): UnlinkLocalAccount {
  return account.fromMnemonic({ mnemonic })
}

export function createRealPrivacyProvider(config: RealPrivacyConfig): RealPrivacyProvider {
  return new RealPrivacyProvider(config)
}
