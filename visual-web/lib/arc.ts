// Arc testnet wiring. Values come from plans/CONTRACT.md + sdk-and-env-reference.md:
//   chainId 5042002 · rpc https://rpc.testnet.arc.network · explorer testnet.arcscan.app
//   native gas = USDC (18 dp) · ERC-20 USDC = 6 dp (0x3600...0000)
import { defineChain } from "viem"

export const ARC_CHAIN_ID = 5042002
export const ARC_RPC_URL = "https://rpc.testnet.arc.network"
export const ARC_EXPLORER_URL = "https://testnet.arcscan.app"
/** USDC ERC-20 on Arc testnet (6 dp). From CONTRACT.md. */
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000"

/**
 * Custom EVM network handed to Dynamic via `overrides.evmNetworks` + `mergeNetworks`.
 * Shape matches Dynamic's `EvmNetwork` (structurally typed at the merge call site).
 * nativeCurrency.decimals = 18 because Arc's native gas token is USDC at 18 dp — the
 * ERC-20 USDC used for amounts/settlement is a separate 6 dp token (see money.ts).
 */
export const ARC_EVM_NETWORK = {
  blockExplorerUrls: [ARC_EXPLORER_URL],
  chainId: ARC_CHAIN_ID,
  chainName: "Arc Testnet",
  iconUrls: ["https://app.dynamic.xyz/assets/networks/eth.svg"],
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USD Coin",
    symbol: "USDC",
  },
  networkId: ARC_CHAIN_ID,
  rpcUrls: [ARC_RPC_URL],
  vanityName: "Arc Testnet",
}

/** viem chain for the import-key fallback (derive address from a raw private key). */
export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
  blockExplorers: { default: { name: "Arcscan", url: ARC_EXPLORER_URL } },
  testnet: true,
})
