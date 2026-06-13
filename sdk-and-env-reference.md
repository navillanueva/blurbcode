# Kickback AI — SDK & Environment Reference

*Verified values. ✅ = confirmed. ⚠️ VERIFY = confirm before hardcoding.*
*Reference implementation of the core loop: https://docs.unlink.xyz/partner-integrations*

---

## ✅ Blocker status (all clear)

| Blocker | Status |
|---|---|
| Unlink live on Arc testnet | ✅ `arc-testnet` (chain 5042002) listed **Available** |
| Dynamic + Unlink API keys | ✅ both self-serve (see below) — no booth needed |
| Delegation webhook | ✅ NOT needed for MVP (only for Dynamic agentic-prize polish) |
| Testnet USDC | ✅ have it; keep some on the payer EOA (USDC = gas on Arc) |

---

## The reference tutorial (READ FIRST)

`docs.unlink.xyz/partner-integrations` — "Build a private nanopayment app" — is our
exact stack: Dynamic sign-in → private Unlink account on arc-testnet → withdraw to a
payer EOA → pay an x402 resource via Circle Gateway. Treat it as the canonical pattern
for the money/privacy loop. Packages it uses: `@unlink-xyz/sdk@canary` and
`@circle-fin/x402-batching`.

## OpenCode (the harness we fork)

- **Repo:** `github.com/anomalyco/opencode` (formerly `sst/opencode`). **License: MIT.**
- **Stack:** TypeScript monorepo, **Bun**. TUI = **OpenTUI** (SolidJS/React/Vue components). Code under `packages/`.
- **Latest dev:** `dev` branch (`github:anomalyco/opencode`).
- **Run from source:** clone → `bun install` → run dev TUI (see repo CONTRIBUTING for exact command).
- **Our edits (OpenTUI/SolidJS):** (1) status-line/spinner → ad slot; (2) new tab → marketplace.

## Unlink (privacy) — ✅ canonical API (canary)

- **Packages:** `@unlink-xyz/sdk@canary` (npm org: `npmjs.com/org/unlink-xyz`).
- **Client (browser):** `import { account, createUnlinkClient } from "@unlink-xyz/sdk/browser";`
  - `createUnlinkClient({ environment: "arc-testnet", account: account.fromMnemonic({ mnemonic }), userId })`
  - `account.fromMnemonic({ mnemonic })` or `account.fromMetaMask({ chainId: 5042002, ... })` (chainId MUST match env)
  - `client.ensureRegistered()`
  - `client.faucet.requestPrivateTokens({ token: usdc })`  ← private testnet faucet
  - `client.getBalances()` (faucet tx is not pollable; balances are the confirmation)
  - `client.transfer({ recipientAddress, token, amount })` (amount in base units, USDC = 6 dec → "1000000" = 1 USDC)
  - `client.withdraw({ recipientEvmAddress, token, amount })`
- **Backend (admin):** `import { createUnlinkAdmin, createUnlinkAuthRoutes } from "@unlink-xyz/sdk/admin";`
  - `createUnlinkAdmin({ environment: "arc-testnet", apiKey: process.env.UNLINK_API_KEY })`
  - `createUnlinkAuthRoutes({ admin, authenticate, onRegister, authorizeUnlinkAddress, authorizeUserStorage })` mounted behind Dynamic JWT verification.
- **Privacy hygiene:** avoid same-size deposit+withdraw in one flow (amount/timing correlation weakens unlinkability); keep a larger private balance, withdraw smaller amounts later.
- **Where to get the API key:** Quickstart → "create an API key" → `docs.unlink.xyz/quickstart#create-an-api-key`. Scoped to `arc-testnet`. **Backend only.**
- **Docs:** `docs.unlink.xyz` · index `docs.unlink.xyz/llms.txt` · Telegram support in llms.txt.

## Dynamic (wallets)

- **Where to get keys:** `app.dynamic.xyz` → create project (use **Sandbox**) → **Developer** tab.
  - **Environment ID:** "SDK & API Keys" section (public; goes in the SDK provider).
  - **Server API token:** "API Token" → "Create Token" → starts with `dyn_`, shown ONCE — copy it. → `DYNAMIC_SERVER_API_KEY`.
  - **Enable Arc:** `app.dynamic.xyz/dashboard/chains-and-networks#evm`.
- **Human onboarding (embedded wallet, browser):** `@dynamic-labs/sdk-react-core` (`DynamicContextProvider`, `DynamicWidget`, `mergeNetworks`) + `@dynamic-labs/ethereum` (`EthereumWalletConnectors`). Browser-only → local-server handoff from a TUI.
- **Autonomous signing (server wallets + delegated access) — PRIZE POLISH, not MVP:** `@dynamic-labs-wallet/node-evm` (`createDelegatedEvmWalletClient`, `delegatedSignTransaction`). Needs the delegation **webhook** (below).
- **Docs:** `dynamic.xyz/docs` · Docs MCP: `https://www.dynamic.xyz/docs/mcp`

### The delegation webhook (optional — only for Dynamic agentic prize)
You HOST it; you don't get it from anyone. User approves delegation once (client-side) →
Dynamic POSTs credentials (walletId, walletApiKey, keyShare) to your endpoint → server signs later.
Register the URL under Developer → Webhooks; for local dev expose localhost via ngrok/cloudflared.
**MVP skips this** (tutorial uses Dynamic sign-in + a plain payer EOA instead).

## Arc settlement + x402 (Circle Gateway) — ✅

- **Chain ID:** `5042002` · **RPC:** `https://rpc.testnet.arc.network` · **Explorer:** `https://testnet.arcscan.app`
- **Native gas = USDC.** ⚠️ DECIMALS: native gas = **18 dec**; ERC-20 USDC = **6 dec**. Gateway deposits are **decimal USDC** ("1.99"); Unlink amounts are **base units** ("1000000"). Don't mix.
- **Faucet:** `https://faucet.circle.com` → "Arc Testnet" (~1 USDC/day; human captcha).
- **x402 on Arc = Circle Gateway batching:** `@circle-fin/x402-batching`
  - `import { GatewayClient } from "@circle-fin/x402-batching/client";`
  - `new GatewayClient({ chain: "arcTestnet", privateKey: payerPrivateKey, rpcUrl })`  ← note Circle uses `arcTestnet` (camel); Unlink env is `arc-testnet`
  - `gateway.deposit("1.99")` then `gateway.pay("https://seller.example/resource")`
  - Payer must be a plain **EOA** (not an Unlink execution/smart account). Keep USDC on it for gas.
  - Circle guides: `developers.circle.com/gateway/nanopayments/howtos/x402-buyer` + `.../supported-networks`
- **Tooling:** EVM-compatible; Arc available by default in viem (verify `arcTestnet` export). Official Circle skill: `github.com/circlefin/skills` → `plugins/circle/skills/use-arc/SKILL.md`.
- **USDC ERC-20 address on Arc:** ⚠️ VERIFY on explorer / Circle docs before hardcoding.

## kickbacks.ai — REFERENCE ONLY (proprietary, not reusable)
`github.com/andrewmccalip/kickbacks.ai`. Use only for the economic model (blocks = 1,000 × 5s impressions; clicks 50×; ascending auction; 50% split). Do NOT copy code.

---

## .env.example (put REAL values here, NOT in committed markdown — repo is public)

```dotenv
# Model for the harness itself
ANTHROPIC_API_KEY=

# Arc testnet
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
ARC_USDC_ADDRESS=                # VERIFY on testnet.arcscan.app
PAYER_ADDRESS=                   # plain EOA, funded from faucet.circle.com
PAYER_PRIVATE_KEY=               # EOA key for Gateway x402 payments

# Dynamic (app.dynamic.xyz → Developer tab)
DYNAMIC_ENVIRONMENT_ID=          # SDK & API Keys section
DYNAMIC_SERVER_API_KEY=          # API Token → Create Token (dyn_...)
# DYNAMIC_DELEGATION_WEBHOOK_URL= # ONLY if doing delegated access (prize polish)

# Unlink (docs.unlink.xyz/quickstart#create-an-api-key)
UNLINK_ENVIRONMENT=arc-testnet
UNLINK_API_KEY=                  # backend only
```
