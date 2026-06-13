# Kickback AI — docs

Kickback AI is a fork of [OpenCode](https://github.com/anomalyco/opencode) (MIT) that turns the
harness's status-line wait state into a crypto-native ad marketplace. Advertisers pay for the ad
slot; the developer whose machine renders the ad earns **50%**, settled as Circle Gateway x402
nanopayments on **Arc testnet** (chain `5042002`) and kept private via **Unlink**. Wallets are
**Dynamic**.

The money/privacy loop follows the Unlink reference tutorial
(`docs.unlink.xyz/partner-integrations`): Dynamic sign-in → private Unlink account on `arc-testnet`
→ withdraw to a payer EOA → pay an x402 resource via Circle Gateway.

## Three integration tracks

Each track has a real impl **and** an offline mock, selected per-provider at runtime by
[`packages/kickback/src/factory.ts`](../../packages/kickback/src/factory.ts). Missing or
unreachable config never throws — it degrades to the mock and records a human-readable note.

| Track | What it does | Doc |
|---|---|---|
| **Unlink** | Private USDC balances on Arc (the developer's earnings, kept unlinkable) | [unlink.md](./unlink.md) |
| **Circle Gateway (x402)** | Batched USDC nanopayment settlement on Arc | [circle-gateway.md](./circle-gateway.md) |
| **Dynamic** | Wallet identity — the JWT `sub` becomes the Unlink `userId` | [dynamic.md](./dynamic.md) |

## Also here

- [ARCHITECTURE.md](./ARCHITECTURE.md) — end-to-end data-flow diagram (advertiser → ad slot →
  impressions → settlement → private balance → `/me`).
- [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) — judge-facing walkthrough.

## Where the code lives

- **Providers (interfaces + mock + real):** [`packages/kickback/src/`](../../packages/kickback/src)
  - Interfaces: `wallet.ts`, `privacy.ts`, `settlement.ts`; money boundary: `money.ts`
  - Mocks: `src/mock/`; real impls: `src/real/`; env loader: `src/config.ts`; selector: `src/factory.ts`
  - Smoke harness: [`scripts/smoke.ts`](../../packages/kickback/scripts/smoke.ts)
- **TUI ad layer:** [`packages/tui/src/kickback/`](../../packages/tui/src/kickback)
  (`ad-store.ts`, `view-tracking.ts`, `ad-slot.tsx`, `revenue.ts`) +
  [`component/dialog-me.tsx`](../../packages/tui/src/component/dialog-me.tsx) (the `/me` view).

## Decimal discipline (read before touching amounts)

Arc native gas = **18 dp**; ERC-20 USDC = **6 dp**. Circle Gateway deposits are **decimal strings**
(`"1.99"`); Unlink amounts are **base units** (`"1000000"` = 1 USDC). The single conversion
boundary is [`money.ts`](../../packages/kickback/src/money.ts) (`toBaseUnits` / `fromBaseUnits`,
`USDC_DECIMALS = 6`). Never hand-roll the math.

## Configuration

All keys are read from `.env` (gitignored). The canonical template — including every variable name
the code reads — is [`.env.example`](../../.env.example). Source of truth for the values:
[`sdk-and-env-reference.md`](../../sdk-and-env-reference.md). Never commit real keys; never fabricate
addresses, URLs, or signatures.
