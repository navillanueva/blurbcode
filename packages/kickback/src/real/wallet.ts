// RealWalletProvider — the developer's identity + payer EOA for the headless MVP.
//
// Interactive Dynamic browser sign-in and server-side JWT verification are
// deferred (see CLAUDE.md: browser embedded-wallet onboarding needs a real
// browser session). This adapter performs NO interactive auth and pulls in NO
// Dynamic SDK; it surfaces the real payer EOA address plus whatever Dynamic
// identity env already provides (userId = JWT `sub`, optional raw JWT). When the
// browser sign-in lands, that flow populates the same session shape.
//
// TODO(human): wire real Dynamic sign-in (@dynamic-labs/sdk-react-core in the
// browser) + verify the JWT server-side (DYNAMIC_SERVER_API_KEY) before reusing
// `sub` as the Unlink userId.

import type { WalletProvider, WalletSession } from "../wallet"

export interface RealWalletConfig {
  /** Stable user id (Dynamic JWT `sub`); falls back to the EOA address upstream. */
  userId: string
  /** Plain payer EOA address (the Gateway x402 payer). */
  address: string
  /** Raw Dynamic JWT, when a prior sign-in produced one. */
  jwt?: string
}

export class RealWalletProvider implements WalletProvider {
  private session: WalletSession | null = null
  private readonly seed: WalletSession

  constructor(config: RealWalletConfig) {
    this.seed = {
      userId: config.userId,
      address: config.address,
      ...(config.jwt !== undefined ? { jwt: config.jwt } : {}),
    }
  }

  async signIn(): Promise<WalletSession> {
    this.session = { ...this.seed }
    return { ...this.session }
  }

  getSession(): WalletSession | null {
    return this.session ? { ...this.session } : null
  }

  async signOut(): Promise<void> {
    this.session = null
  }
}

export function createRealWalletProvider(config: RealWalletConfig): RealWalletProvider {
  return new RealWalletProvider(config)
}
