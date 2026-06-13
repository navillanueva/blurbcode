// Real provider implementations. Each adapts a vendor SDK to one of the three
// Kickback interfaces and reads NO env directly — config is injected (see
// config.ts + factory.ts). Mocks remain the default for offline/iterative work.

export { RealWalletProvider, createRealWalletProvider } from "./wallet"
export type { RealWalletConfig } from "./wallet"
export {
  RealPrivacyProvider,
  createRealPrivacyProvider,
  unlinkAccountFromMnemonic,
} from "./privacy"
export type { RealPrivacyConfig } from "./privacy"
export { RealSettlementProvider, createRealSettlementProvider } from "./settlement"
export type { RealSettlementConfig } from "./settlement"
