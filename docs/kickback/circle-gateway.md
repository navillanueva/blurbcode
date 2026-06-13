# Track: Circle Gateway (x402 settlement)

Circle Gateway is how advertiser USDC actually moves. x402 is the "HTTP 402 Payment Required"
challenge/response flow; Circle's batching layer settles those nanopayments on Arc. In Kickback AI,
Gateway is the `SettlementProvider`: it funds a Gateway balance from a plain payer EOA and pays
x402-protected resources.

## What it does in Kickback AI

- `deposit("1.99")` — moves decimal USDC from the payer EOA into the Gateway wallet (approve +
  deposit).
- `getDepositedBalance()` — the spendable Gateway balance, in base units.
- `pay(resourceUrl)` — runs the full 402-challenge → pay flow against an x402 seller resource and
  returns a receipt (`amount` in base units + a transaction `reference`).

The payer **must** be a plain EOA (not an Unlink execution/smart account). Keep USDC on it — on Arc,
USDC is also the native gas token.

## Where the code lives

- **Interface:** [`packages/kickback/src/settlement.ts`](../../packages/kickback/src/settlement.ts) —
  `deposit(decimal)` / `getDepositedBalance()` / `pay(url) → receipt`.
- **Real impl:** [`packages/kickback/src/real/settlement.ts`](../../packages/kickback/src/real/settlement.ts)
  — adapts `@circle-fin/x402-batching` `GatewayClient`.
- **Mock impl:** [`packages/kickback/src/mock/settlement.ts`](../../packages/kickback/src/mock/settlement.ts)
  — decimal deposit → base units, per-resource prices, deterministic `mock-x402-N` references.
- **Smoke harness:** [`packages/kickback/scripts/smoke.ts`](../../packages/kickback/scripts/smoke.ts)
  — read-only by default; the single allowed live `fund → pay` test is hard-gated (see below).

## SDK surface (verified against the installed types — `@circle-fin/x402-batching@3.0.4`)

```ts
import { GatewayClient } from "@circle-fin/x402-batching/client"

const client = new GatewayClient({ chain: "arcTestnet", privateKey, rpcUrl })
await client.deposit("1.99")                    // DECIMAL string, not base units
const { gateway } = await client.getBalances()  // gateway.available is a bigint (base units)
const { amount, transaction } = await client.pay("https://seller.example/resource")
```

Note the chain key: **Circle uses `arcTestnet` (camelCase)**, while Unlink's environment is
`arc-testnet`. Don't mix them up. (Gateway domain 26 — noted in the real impl.)

## Arc constants

| | |
|---|---|
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Native gas | USDC, **18 dp** |
| ERC-20 USDC | **6 dp**, address from `ARC_USDC_ADDRESS` |
| Faucet | `https://faucet.circle.com` → "Arc Testnet" (human captcha) |

`ARC_USDC_ADDRESS` in `.env.example` is `0x3600000000000000000000000000000000000000`. It is loaded from
env (never hardcoded in code); confirm it on `testnet.arcscan.app` before any mainnet-equivalent use.

## How the factory degrades to the mock

[`factory.ts`](../../packages/kickback/src/factory.ts) constructs the **real** Gateway client only
when both `PAYER_*` (valid EOA address + 32-byte key) and `ARC_*` config are present. If construction
throws, it's caught and reported as a note (`real Gateway client failed to init …; using mock`).
Otherwise it logs `missing PAYER_* or ARC_* config; using mock settlement`.

## The single allowed live smoke test

Live testnet calls are fund/rate-limited — run **at most one** end-to-end test, never in a loop.
`scripts/smoke.ts` enforces this:

```bash
# Read-only (safe, default): prints live/mock per provider, fallback notes, and the Gateway balance.
bun packages/kickback/scripts/smoke.ts

# The single allowed live test — moves funds. Needs BOTH the confirm var AND an explicit seller URL.
KICKBACK_SMOKE_CONFIRM=1 bun packages/kickback/scripts/smoke.ts --deposit 0.10 --pay https://seller.example/resource
```

It refuses to move funds without `KICKBACK_SMOKE_CONFIRM=1`, and refuses if settlement is the mock.

## TODO(human) — blockers

- **x402 seller URL.** The live `--pay` smoke needs a real Arc x402-protected seller resource URL.
  None known yet — without it the end-to-end test isn't reachable regardless.
- **x402 runtime peer.** `@x402/core` resolved into the store; confirm `@x402/evm` (a peer of
  `@circle-fin/x402-batching`) is present before the live `pay()` — `GatewayClient` constructs fine
  offline, but `pay()` may load it lazily.

## References

- Circle x402 buyer guide: `developers.circle.com/gateway/nanopayments/howtos/x402-buyer`
- Supported networks: `developers.circle.com/gateway/nanopayments/howtos/supported-networks`
- Env vars: see [`.env.example`](../../.env.example) (`ARC_*`, `PAYER_*`).
