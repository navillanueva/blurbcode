# Visual Code API (Plan 3 — the backend hub)

The backend is **the only thing that moves money and the single source of truth**
(`visual-code-mvp-architecture.md`). The TUI and the web frontend both talk to
*this* service; they never talk to each other. It implements **exactly** the
endpoints in [`../plans/CONTRACT.md`](../plans/CONTRACT.md).

- **Runtime:** Bun 1.3.14, [Hono](https://hono.dev) HTTP, [drizzle-orm](https://orm.drizzle.team) over Postgres.
- **Standalone:** its own `package.json`/`node_modules`; Railway root dir = `visual-api/`.
- **Shared code:** imports the mocks + `money.ts` + provider interfaces from
  `packages/kickback` via tsconfig path aliases (`@kickback/*`). The **real**
  on-chain providers (Unlink + Circle Gateway) are migrated into
  `src/settlement/` here.

## Endpoints (all under `/api`)

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | `/api/auth/dynamic` | – | `{ dynamicJwt }` → `{ address, ok }` — verify the Dynamic JWT (JWKS for `DYNAMIC_ENVIRONMENT_ID`, gated by `DYNAMIC_SERVER_API_KEY`), link the account to the wallet address (**non-custodial**) |
| POST | `/api/auth/import` | – | `{ privateKey }` → `{ address, ok }` — derive address (viem), store the key **encrypted** (custodial fallback) |
| POST | `/api/device-tokens` | session | → `{ token }` — issue a TUI bearer token |
| POST | `/api/campaigns` | session | `{ advertiser, text, url, bidBaseUnits, budgetBaseUnits }` → `{ campaign }` |
| GET | `/api/campaigns` | session | → `{ campaigns: [...with spendBaseUnits] }` |
| POST | `/api/campaigns/:id/fund` | session | → `{ campaign, txRef }` — settle the deposit (Unlink/mock) + activate |
| GET | `/api/me` | session | → `{ address, balanceBaseUnits, role }` |
| POST | `/api/withdraw` | session | → `{ ok, withdrawnBaseUnits, txRef }` — settle earnings to the wallet |
| GET | `/api/ad/serve` | bearer | → `{ ad: { id, advertiser, text, url } \| null }` — auction winner |
| POST | `/api/impressions` | bearer | `{ adId, count }` → `{ ok: true, creditedBaseUnits }` |
| GET | `/api/me/earnings` | bearer | → `{ balanceBaseUnits, impressions, clicks, walletAddress }` |
| GET | `/health` | – | → `{ ok, settlement: { mode, live, notes } }` |

- **Web routes** authenticate with a signed **session cookie** (`vc_session`,
  HMAC over the account id with `TOKEN_SIGNING_SECRET`).
- **TUI routes** authenticate with `Authorization: Bearer <device-token>`.
- **All amounts are USDC base-unit integer strings** (`"1000000"` = 1 USDC) —
  exactly what the TUI client (`packages/kickback/src/client.ts`) parses.

> `POST /api/auth/dynamic` is the MVP-primary, non-custodial auth (in the
> committed `CONTRACT.md`). `POST /api/auth/import` is the custodial fallback.

## How it works

- **Auction** (`src/auction.ts`, pure): highest bid among `active` campaigns with
  budget remaining wins; ties break to the earliest-created (first bid takes the
  slot). Bids are priced **per 1,000 impressions** (one "block").
- **Accounting** (`src/accounting.ts`, pure): per impression batch, charge =
  `floor(bid × count / 1000)` clamped to remaining budget; the developer is
  credited **50%**. Applied atomically in `src/db/repo.ts#recordImpression`
  (budget decrement is guarded against overspend; the campaign flips to
  `exhausted` at zero).
- **Anti-abuse** (`src/ratelimit.ts`, MVP-level — **not** real ad-fraud defense):
  bearer required; per-request cap (120) + a rolling per-account window cap.
- **Settlement** (`src/settlement/`): `fundCampaign` (advertiser deposit) and
  `withdrawEarnings` (developer payout). **Mock by default**; the real path is
  gated behind `SETTLEMENT_MODE=real`.

## Database

Postgres, schema in [`drizzle/0000_init.sql`](drizzle/0000_init.sql) (the
CONTRACT tables: `accounts`, `device_tokens`, `campaigns`, `impressions`,
`earnings`, `settlements`; plus an additive `campaigns.budget_base_units` so
`GET /api/campaigns` can report spend). Drizzle schema mirror in
`src/db/schema.ts`. `numeric` columns hold base-unit integers (serialized as
strings — the wire shape).

```bash
bun run migrate     # apply drizzle/0000_init.sql to $DATABASE_URL (idempotent)
```

The server also auto-applies the (idempotent) schema on start.

## Run locally

```bash
cd visual-api
bun install
cp .env.example .env            # set DATABASE_URL + TOKEN_SIGNING_SECRET

# Postgres: use a local instance or Docker —
#   docker run -d --name vc-pg -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres:16
#   DATABASE_URL=postgres://postgres:pw@localhost:5432/postgres

bun run migrate                 # create tables
bun run dev                     # http://localhost:8787  (settlement=mock)
```

`SETTLEMENT_MODE=mock` (default) needs no chain/keys. No Postgres is needed to
run the **tests** — they use in-process PGlite.

## Test / verify

```bash
bun run typecheck   # tsgo --noEmit
bun test            # 36 tests: auction + accounting + ratelimit + JWT verify
                    # + mock settlement + a full e2e (auth → token → campaign →
                    # fund → serve → impressions → earnings → withdraw) on PGlite
```

## Railway env vars

**Required:** `DATABASE_URL` (Railway Postgres), `TOKEN_SIGNING_SECRET`
(`openssl rand -hex 32`). Recommended: `PORT`, `VISUALCODE_API_URL` (public URL),
`CORS_ORIGIN` (the web app origin), `SETTLEMENT_MODE=mock`.

**Dynamic auth:** `DYNAMIC_ENVIRONMENT_ID`, `DYNAMIC_SERVER_API_KEY`.

**Real settlement (only when `SETTLEMENT_MODE=real`):** `ARC_TESTNET_RPC_URL`,
`ARC_CHAIN_ID=5042002`, `ARC_USDC_ADDRESS`, `PAYER_ADDRESS`, `PAYER_PRIVATE_KEY`,
`UNLINK_ENVIRONMENT=arc-testnet`, `UNLINK_API_KEY`,
`UNLINK_ENGINE_URL=https://arc-testnet-production-api.unlink.xyz`,
`UNLINK_MNEMONIC`. Names mirror the repo root `.env.example`.

Railway: root directory = `visual-api/`, build `bun install`, start `bun run start`.

## Real settlement (the single gated live Arc smoke)

`src/settlement/real-gateway.ts` (Circle Gateway x402) + `src/settlement/real-unlink.ts`
(Unlink privacy) + `src/settlement/real.ts` (wiring) are migrated from
`packages/kickback/src/real/*`. They are loaded **only** when
`SETTLEMENT_MODE=real`, via a dynamic import, so the default (mock) path never
touches a vendor SDK or the chain.

```bash
bun run smoke                                                    # read-only status
KICKBACK_SMOKE_CONFIRM=1 bun run smoke --deposit 0.10 --pay <x402-url>   # one live test
```

> **Environment note:** `@unlink-xyz/sdk` is **not published on the public npm
> registry**, so it can't be installed in every environment (it's an
> `optionalDependency` here). When it's absent, `real-unlink.ts` / `real.ts` are
> excluded from `bun run typecheck`, and `SETTLEMENT_MODE=real` / `bun run smoke`
> fail **visibly** with a clear message. The mock path and all 36 tests are
> unaffected. Install the Unlink SDK from your Arc/private source to enable the
> real path.
