# Plan 2 — Visual Code Web (frontend)

**Read first:** `plans/CONTRACT.md`, `visual-code-mvp-architecture.md`. You're in the worktree
`~/visualcode/wt-web` (branch `visual-web`). Build a self-contained **Next.js (App Router, React +
TypeScript)** app in `visual-web/` at the repo root of your worktree. Bun 1.3.14. OpenCode branding.

## Stack: Next.js + Dynamic React SDK (NOT SolidStart)
Dynamic wallet creation is the MVP centerpiece, and **Dynamic's embedded-wallet SDK is React-first**
(`@dynamic-labs/sdk-react-core` + `@dynamic-labs/ethereum`) — Next.js makes it a drop-in. (No real
loss vs SolidStart: the Solid TUI's terminal components don't port to the web anyway.) The **backend
is a SEPARATE service** (`visual-api/`, Plan 3); this app only CALLS it via the contract over HTTP.

Deps: `@dynamic-labs/sdk-react-core`, `@dynamic-labs/ethereum`, `viem` (Arc network + import-key),
contract money helpers from `packages/kickback/src/money.ts` (copy the tiny file or import).

## Wallet — Dynamic creation (primary), import-key (fallback)
- Wrap the app in `DynamicContextProvider`: `environmentId` = `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID`,
  `walletConnectors: [EthereumWalletConnectors]`, and add **Arc testnet** as a custom EVM network via
  `overrides.evmNetworks` + `mergeNetworks` (chainId **5042002**, rpc `https://rpc.testnet.arc.network`,
  native USDC). Enable Arc in the Dynamic dashboard too.
- A **"Create / connect wallet" button** = `<DynamicWidget />` (or `useDynamicContext`). On auth, read
  the Dynamic **JWT** (`getAuthToken()`), POST it to the backend `POST /api/auth/dynamic` to
  create/link the account to the wallet address. Non-custodial — the key stays with Dynamic.
- **Fallback:** an "import a private key" form → `POST /api/auth/import`.

## Pages (3)
1. **Landing** (`/`) — kickbacks.ai-style: ads in your coding harness; advertisers pay, devs earn,
   settled privately on Arc. CTAs to Advertise + Connect wallet.
2. **Advertise** (`/advertise`) — create a campaign (advertiser, text, URL, bid USDC/1k impressions,
   budget) → fund (`POST /api/campaigns/:id/fund`) → live spend + remaining budget. Requires a
   connected wallet.
3. **Wallet / account** (`/wallet`) — create/connect with Dynamic (or import a key); show address,
   balance, accrued earnings; **generate a device token** (`POST /api/device-tokens`) with a copy
   button + a one-liner to run `/wallet` in the OpenCode TUI and paste it; a **Withdraw** button
   (`POST /api/withdraw`).

## Env (`visual-web/.env` + `.env.example`)
- `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` — public; the Dynamic SDK provider. (Value is in the repo
  root `.env`: `7414ec5a-966e-4219-8b8a-2fe843f38ff2`.)
- `NEXT_PUBLIC_VISUALCODE_API_URL` — the `visual-api` backend URL (Railway will provide it).
- The `DYNAMIC_SERVER_API_KEY` stays in the BACKEND (`visual-api`), NOT here.

## Deploy (Railway)
- Railway service, root directory `visual-web/`, build `bun run build` (`next build`), start
  `next start`. Set the `NEXT_PUBLIC_*` vars.

## Constraints
- Touch ONLY `visual-web/`. Do NOT edit `packages/tui`, `packages/kickback`, or `visual-api`.
- Do NOT run git — I (the human) commit/merge this branch.
- Do NOT change `CONTRACT.md`; if a change is truly needed, STOP and flag it.

## Verify
- `cd visual-web && bun install && bun run build` succeeds; `bun dev` renders the 3 pages; the Dynamic
  widget loads with the env id; wallet connect → `/api/auth/dynamic` round-trips (mock backend OK).

## Done = a Railway URL where someone creates a wallet with Dynamic (social/email), funds a campaign,
and copies a device token to paste into the TUI.
