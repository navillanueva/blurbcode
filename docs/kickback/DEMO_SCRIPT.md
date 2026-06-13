# Kickback AI — demo script (judge-facing walkthrough)

A ~4-minute walkthrough. Everything below runs **offline against the mocks** — no keys, no funds, no
network. The one live on-chain step is gated and optional (step 6).

## The pitch (15s)

> OpenCode's status line sits idle while the model thinks. Kickback AI turns that wait state into an
> ad marketplace: advertisers pay for the slot, and the developer whose machine renders the ad earns
> **50%** — settled as Circle Gateway x402 nanopayments on Arc testnet, kept private with Unlink, and
> identified with Dynamic. The ad is **display-only** — it never enters the model's context.

## 0. Setup (before the demo)

```bash
# Repo root. The toolchain is pinned to bun 1.3.14 (see PROGRESS.md if a plain `bun install` fails).
bun x bun@1.3.14 install --frozen-lockfile   # only if node_modules isn't populated yet
```

No `.env` is required for the demo — with keys absent, the factory cleanly uses the mocks.

## 1. Boot the TUI, show the status-line ad (45s)

```bash
bun dev .        # launches the OpenCode TUI in the current directory
```

- Point at the **status-line ad slot** (`AdSlot`, mounted in the live `home_footer`). It renders the
  seeded sample ad — `Acme DevTools — "Acme CI — ship green builds 2x faster"` — with a clickable `↗`.
  This is a clearly-marked placeholder (`example.com`), not a fabricated campaign.
- Explain: this text comes from `adStore`, the local display state. It is **never** sent to the LLM.

## 2. Impressions accrue (30s)

- Let the slot sit. `viewTracking` counts **one impression per 5-second window** (the interval is the
  debounce). Each impression updates `adStore` and the derived developer earnings.
- Optionally click the `↗`: it opens the URL **and** records a click — worth 50 impressions.

## 3. Open the `/me` revenue view (60s)

- Type **`/me`** (or pick `kickback.me` from the command palette). The `DialogMe` overlay shows:
  - the served ad (advertiser + copy, clickable `↗`),
  - **impressions** and **clicks**,
  - **accrued earnings** — the 50% developer share, derived from the counters,
  - **settled private balance** — read from the (mock) Unlink `PrivacyProvider`, seeded to a non-zero
    value via the in-memory faucet so the number isn't empty offline,
  - a consent / provenance line.
- Explain the split: `((impressions + clicks×50) × blockBid / 1000) × 50%`, integer math, floors
  visibly. All from `ad-store.ts` / `revenue.ts`.

## 4. The three integration tracks (45s)

Open [`docs/kickback/`](./README.md) and name the stack:

- **Dynamic** → wallet identity; the JWT `sub` becomes the Unlink `userId`. ([dynamic.md](./dynamic.md))
- **Unlink** → the developer's earnings as a private USDC balance on `arc-testnet`. ([unlink.md](./unlink.md))
- **Circle Gateway (x402)** → batched USDC settlement on Arc. ([circle-gateway.md](./circle-gateway.md))

Each has a real impl **and** a mock; [`factory.ts`](../../packages/kickback/src/factory.ts) picks per
provider from `.env` and **surfaces every fallback as a note** — degraded state is observable, never
faked.

## 5. Prove real-vs-mock honesty (30s)

```bash
bun packages/kickback/scripts/smoke.ts        # READ-ONLY
```

Shows `wallet / privacy / settlement = REAL or mock` and the fallback notes — exactly why each
provider is live or mocked given the current `.env`. With Gateway live it also prints the deposited
balance.

## 6. (Optional, gated) the single live settlement test

Run **at most once** — fund/rate-limited, never in a loop. Needs a real payer EOA in `.env`, a funded
Gateway, and a real Arc x402 seller URL:

```bash
KICKBACK_SMOKE_CONFIRM=1 bun packages/kickback/scripts/smoke.ts --deposit 0.10 --pay https://seller.example/resource
```

Be upfront with judges about what's still open (see `PROGRESS.md` → TODO(human)): a verified Unlink
Arc engine URL / Arc-registered SDK build, an `UNLINK_MNEMONIC`, real Dynamic browser sign-in, and a
real x402 seller URL. The architecture is wired end-to-end against interfaces; these are credentials
and one external resource, not missing design.

## Close (15s)

> Same surface developers already stare at, now a privacy-preserving revenue stream — built on
> Dynamic + Unlink + Circle Gateway on Arc, touching only two OpenCode UI surfaces and never the
> model's context.

## Quick reference

| Want | Command / path |
|---|---|
| Run the TUI | `bun dev .` |
| Open revenue view | `/me` in the TUI |
| Provider status (read-only) | `bun packages/kickback/scripts/smoke.ts` |
| Architecture diagram | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Per-track docs | [`README.md`](./README.md) |
| Open work | `PROGRESS.md` → TODO(human) |
