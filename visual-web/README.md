# Visual Code Web

The frontend for Visual Code — a Next.js (App Router, React + TypeScript) app where developers
create a wallet and link the OpenCode TUI, and advertisers fund campaigns. Wallets are created with
**Dynamic** (non-custodial embedded wallet, primary) with a **private-key import** fallback. Money
settles privately on **Arc testnet** (chain `5042002`).

This app contains **no business logic** — it only calls the `visual-api` backend (Plan 3) over HTTP
per `plans/CONTRACT.md`.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- `@dynamic-labs/sdk-react-core` + `@dynamic-labs/ethereum` (wallet creation/connect)
- `viem` (Arc network + import-key address derivation)
- Money helpers copied from `packages/kickback/src/money.ts` → `lib/money.ts`

## Pages

- `/` — landing (how it works, CTAs)
- `/advertise` — create a campaign → fund it on Arc → live spend / remaining budget
- `/wallet` — connect/create wallet, generate a TUI device token (with copy + instructions), withdraw

## Setup

```bash
cd visual-web
cp .env.example .env        # or .env.local
bun install
bun dev                     # http://localhost:3000
```

### Environment

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` | Public Dynamic SDK environment id (app.dynamic.xyz → Developer). |
| `NEXT_PUBLIC_VISUALCODE_API_URL` | Base URL of the `visual-api` backend. |

> `DYNAMIC_SERVER_API_KEY` lives in the **backend**, never here. Only `NEXT_PUBLIC_*` vars are read.

Enable Arc testnet in the Dynamic dashboard too (Developer → Chains & Networks → EVM). The app also
registers Arc client-side via `overrides.evmNetworks` + `mergeNetworks`.

## Build / deploy

```bash
bun run build               # next build
bun run start               # next start
```

Deploy on Railway with root directory `visual-web/`, build `bun run build`, start `next start`, and
the two `NEXT_PUBLIC_*` vars set.
