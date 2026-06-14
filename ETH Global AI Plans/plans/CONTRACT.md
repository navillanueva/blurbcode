# Visual Code — Shared API Contract (single source of truth)

All three plans agree on THIS. The backend (Plan 3) implements it; the TUI (Plan 1) and the web
frontend (Plan 2) consume it. Base URL is configurable (`VISUALCODE_API_URL`); Railway gives the web
service a public URL.

## Identity & auth (MVP = Dynamic wallet creation; import-key is the fallback)
- A **web account** is created by **Dynamic social/email login → embedded wallet** (browser, via the
  Dynamic React SDK). The frontend sends the Dynamic **JWT** to the backend, which verifies it and
  links the account to the Dynamic **wallet address**. NON-custodial: the backend never holds the
  key — it sends earnings to the address; advertiser deposits are signed client-side via the Dynamic
  wallet (or a Dynamic server wallet later).
- **Fallback:** importing a raw private key (custodial; backend stores it encrypted to sign).
- A **device token** links the TUI to an account. Issued in the web app, pasted into the TUI.
- Web routes use a **session cookie**; TUI routes use **`Authorization: Bearer <device-token>`**.

## TUI ↔ backend (Bearer device token)
- `GET /api/ad/serve` → `{ ad: { id, advertiser, text, url } | null }` — the auction winner to show.
- `POST /api/impressions` `{ adId, count }` → `{ ok: true, creditedBaseUnits: string }` — record N
  5-second impressions; backend decrements advertiser budget + credits this dev 50%.
- `GET /api/me/earnings` → `{ balanceBaseUnits, impressions, clicks, walletAddress }`.

## Web ↔ backend (session)
- `POST /api/auth/dynamic` `{ dynamicJwt }` → `{ address, ok }` (verify the Dynamic JWT with
  `DYNAMIC_SERVER_API_KEY`, link the account to the Dynamic wallet address — MVP primary, non-custodial).
- `POST /api/auth/import` `{ privateKey }` → `{ address, ok }` (fallback; custodial, key stored encrypted).
- `POST /api/device-tokens` → `{ token }` (issue a TUI device token for the logged-in account).
- `POST /api/campaigns` `{ advertiser, text, url, bidBaseUnits, budgetBaseUnits }` → `{ campaign }`.
- `GET /api/treasury` → `{ address, token, chainId, decimals }` — the EOA the advertiser sends their
  public USDC budget to, the token to send, and its decimals. The web reads this (no hardcoding).
- `POST /api/campaigns/:id/fund` `{ paymentTxHash }` → verifies the advertiser's public USDC transfer
  to the treasury (real mode), then does a private Unlink **deposit** of the budget into the pool and
  activates the campaign. Idempotent per campaign; a `paymentTxHash` funds at most one campaign (409 on
  reuse). `paymentTxHash` is ignored in mock mode.
- `GET /api/campaigns` → advertiser's campaigns + spend.
- `GET /api/me` → `{ address, balanceBaseUnits, role }`.
- `POST /api/withdraw` → settle earnings to the account's wallet via a private Unlink **withdraw** from
  the pool (waits for terminal; never zeroes earnings if the payout fails).

## Amounts & chain
- All amounts are **token base units as strings** (`"1000000"` = 1 USDC at 6 dec). Reuse
  `packages/kickback`'s `toBaseUnits`/`fromBaseUnits` — pass the token's decimals. **Decimals are
  configurable** (`ARC_USDC_DECIMALS`): USDC is 6, but the arc-testnet Unlink pool token (ULNKMock,
  `0x4F592595Ec2dcb794d949551554436807565b300`) is **18**. Clients read decimals from `GET /api/treasury`.
- Arc testnet: chain `5042002`, settlement/pool token from `ARC_USDC_ADDRESS`, Unlink engine
  `https://arc-testnet-production-api.unlink.xyz`, Gateway via `@circle-fin/x402-batching`.

## Postgres schema (Plan 3 owns; minimal MVP)
- `accounts(id, address UNIQUE, enc_private_key, email NULL, created_at)`
- `device_tokens(token PK, account_id, created_at, revoked_at NULL)`
- `campaigns(id, advertiser_account_id, advertiser, text, url, bid_base_units, budget_remaining_base_units, status, created_at)`
- `impressions(id, dev_account_id, campaign_id, count, created_at)`
- `earnings(account_id PK, balance_base_units)` (or derive from impressions; a cached balance is fine)
- `settlements(id, account_id, amount_base_units, tx_ref, kind, created_at)`

## Graceful degradation (important for Plan 1)
If the TUI has **no `VISUALCODE_API_URL`/token**, it must fall back to the existing **local mock**
(`SAMPLE_AD` + mock providers) so the harness still works offline. Backend-served data is additive.
