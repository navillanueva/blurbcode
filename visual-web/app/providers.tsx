"use client"

import { DynamicContextProvider, getAuthToken, mergeNetworks } from "@dynamic-labs/sdk-react-core"
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum"
import { ARC_EVM_NETWORK } from "@/lib/arc"
import { authDynamic } from "@/lib/api"

// Public env id. The plan ships a real value for the shared sandbox, used as the
// default so `bun dev` renders the widget even before anyone creates a .env.
const ENVIRONMENT_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? "7414ec5a-966e-4219-8b8a-2fe843f38ff2"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: ENVIRONMENT_ID,
        walletConnectors: [EthereumWalletConnectors],
        // Add Arc testnet as a custom EVM network on top of whatever the Dynamic
        // dashboard already enables.
        overrides: {
          evmNetworks: (dashboardNetworks) => mergeNetworks([ARC_EVM_NETWORK], dashboardNetworks),
        },
        events: {
          // On a successful Dynamic login, hand the JWT to the backend so it can
          // verify it and link the account to the embedded wallet address
          // (non-custodial — the key stays with Dynamic).
          onAuthSuccess: async () => {
            const jwt = getAuthToken()
            if (!jwt) {
              console.error("Dynamic auth succeeded but getAuthToken() returned no JWT")
              return
            }
            try {
              await authDynamic(jwt)
            } catch (e) {
              // Best-effort link: the wallet exists regardless. Log loudly; the
              // /wallet page surfaces backend reachability via GET /api/me.
              console.error("POST /api/auth/dynamic failed (account not linked):", e)
            }
            // After a general sign-in, take the user to their wallet page (device
            // token + earnings). Skip when they're already on an authed page so the
            // advertise / earnings flows aren't yanked away mid-task.
            if (typeof window !== "undefined") {
              const path = window.location.pathname
              if (path !== "/wallet" && path !== "/advertise" && path !== "/me") {
                window.location.assign("/wallet")
              }
            }
          },
        },
      }}
    >
      {children}
    </DynamicContextProvider>
  )
}
