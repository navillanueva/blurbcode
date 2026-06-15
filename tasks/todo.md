# v0.4 — Private custodial settlement (Plan 4)

Spec: `ETH Global AI Plans/plans/plan-4-private-custodial-settlement.md`. Work in main repo
(`visual-api/`, `visual-web/`). Testnet only. ONE live fund-moving smoke (gated). User commits (GPG).

## Phase 0 — Unblock  ✅ (mostly pre-done)
- [x] Pool token `0x4F59…b300` (ULNKMock, 18dp) + `ARC_USDC_DECIMALS=18` + `SETTLEMENT_MODE=real` in `visual-api/.env`
- [x] Treasury EOA = PAYER_ADDRESS, funded (20 ULNKm + 20 gas, per user)
- [x] Read-only smoke shows REAL + pool account registers
- [ ] P0b — vendor SDK tarball for Railway (deferred to Phase 4 prep)

## Phase 1 — Backend deposit + verify + routes + migration (+ decimals)  ✅
- [x] config.ts: read `ARC_USDC_DECIMALS`→`arc.usdc.decimals`; add `treasuryAddress` (default PAYER), `fundMinConfirmations`
- [x] real-unlink.ts: `evmSigner` config + `evm.fromViem` provider + `deposit()` (depositWithApproval)
- [x] verify-payment.ts (NEW): pure viem ERC-20 Transfer receipt verification (+ pure assert helper for tests)
- [x] service.ts: add `paymentTxHash?` to fundCampaign params + optional getPoolBalance
- [x] real.ts: wire signer; rewrite fundCampaign (verify→deposit→wait); thread decimals; smoke `--unlink-deposit`; pool-balance getter
- [x] smoke.ts: parse `--unlink-deposit`
- [x] schema.ts: `campaigns.payment_tx_hash`
- [x] drizzle/0001_fund_payment.sql (NEW) + migrate.ts applies all *.sql sorted
- [x] repo.ts: setCampaignPaymentTx / getCampaignByPaymentTx / sumOutstandingEarnings + paymentTxHash on CampaignRow
- [x] app.ts: GET /api/treasury; fund route takes paymentTxHash + idempotency
- [x] .env.example: ARC_USDC_DECIMALS / TREASURY_ADDRESS / FUND_MIN_CONFIRMATIONS / pool-token note
- [x] tests: verify-payment, fund idempotency, withdraw atomicity; 51 green; real-files typecheck clean

## Phase 3 — Withdraw hardening + reconciliation (backend)  ✅ (folded into Phase 1 real.ts pass)
- [x] real.ts withdrawEarnings: pool-balance guard + wait-for-terminal + Unlink-only (drop silent Gateway)
- [x] app.ts /health: poolBalance vs Σ earnings + healthy flag (guarded/cached)

## Phase 2 — Frontend on-chain payment
- [ ] lib/api.ts: fundCampaign(id, txHash); getTreasury()
- [ ] lib/arc.ts: ARC_USDC_ADDRESS = pool token; expose decimals
- [ ] advertise/page.tsx: Dynamic-wallet USDC transfer → wait receipt → fund(txHash); thread decimals; fix copy
- [ ] (user) browser verify with Dynamic wallet

## Phase 4 — Live round-trip + flip prod
- [x] (user-approved) single gated smoke: deposit 0.10 → withdraw 0.05 — BOTH legs processed on Arc
      deposit tx 0x8f46fedc…f59000 · withdraw tx 0x50db3435…5e2a · pool ends 0.05 shielded
- [ ] P0b vendor SDK tarball (deploy gate — deferred; would disturb working local symlink)
- [ ] (user) manual web E2E: create→pay→fund→serve→impressions→withdraw
- [ ] (user) flip Railway visual-api → SETTLEMENT_MODE=real (after P0b)

## CONTRACT.md  ✅
- [x] document `fund {paymentTxHash}` + `GET /api/treasury` + configurable decimals

## Review
- Phases 1, 3, 2 fully implemented + verified (typecheck, 51 tests, real-files typecheck, next build).
- Live smoke proved the real private deposit→withdraw round-trip; decimals (18dp) correct end-to-end.
- Remaining = user-gated only: browser frontend verify, then P0b vendoring + Railway flip to real.
- Surfaced (not mine, excluded from commits): a 26-line edit to `ETH Global AI Plans/CLAUDE.md`.

---

# Anti-fraud hardening: daily earning cap + server-observed clicks

Context: an open-source TUI fork can strip the ad and/or fabricate impressions. The
withdrawal-time World ID gate already kills the sybil farm and budget-clamping caps
advertiser loss. These two additions tighten the residual single-account exposure and
replace a self-reported click stat with a server-observed one.

## Feature A — per-account daily impression cap (bounds single-account daily take)
- [ ] `ratelimit.ts`: add `DAY_WINDOW_MS` + `MAX_IMPRESSIONS_PER_DAY`; extend
      `allowedImpressionCount` to also clamp by remaining daily room.
- [ ] `app.ts` `POST /api/impressions`: compute `recentInDay` (reuse
      `repo.recentImpressionCount` with a 24h `since`) and pass it through.
- [ ] `ratelimit.test.ts`: cover the daily clamp (pure-function level).

## Feature C — server-observed clicks via redirect endpoint (un-stub `clicks: 0`)
- [ ] `schema.ts` + `drizzle/0004_clicks.sql`: new `clicks` table (dev, campaign, ts).
- [ ] `repo.ts`: `recordClick`, `recentClickCount`; add `clicks` to `getEarnings`.
- [ ] `auth/click-token.ts`: HMAC-signed `(accountId, campaignId)` token (mirrors
      `session.ts`; URL-safe, constant-time verify).
- [ ] `app.ts`: `AppDeps.apiBaseUrl?`; serve attaches `clickUrl`; new unauth
      `GET /api/click/:campaignId` (verify token → rate-limit → record → 302 to campaign
      url, validated http/https); earnings returns real click count.
- [ ] `index.ts`: wire `apiBaseUrl` from env (else request-origin fallback).
- [ ] providers `client.ts`: `ServedAd.clickUrl?` + parse.
- [ ] TUI `ad-store.ts` / `ad-slot.tsx` / `status-bar-ad.tsx`: open `clickUrl ?? url`.
- [ ] `click.test.ts`: serve→clickUrl, click→302+record, earnings reflect it, bad token.

NOTE: clicks stay MEASUREMENT-ONLY (accounting still credits impressions only).
Monetizing clicks later must reuse the World-ID withdrawal chokepoint + these caps.

## Verify
- [x] `bun run typecheck` clean: visual-api, packages/kickback, packages/tui (all EXIT 0)
- [x] `bun test` green: visual-api 86 pass / 0 fail · providers 58 pass / 0 fail

## Review
- Feature A (daily cap) + Feature C (server-observed clicks) both implemented & verified.
- A: `MAX_IMPRESSIONS_PER_DAY=17_280` (24h at honest ~12/min); route now clamps by
  request/minute/day (the tightest wins). Pure-function tested in `ratelimit.test.ts`.
  No integration test for the route-level daily clamp — reaching it needs time-travel
  past the per-minute cap; the pure function is the right test altitude (matches the
  existing window tests). Tune the constant down if $172/day per-account headroom is
  too generous.
- C: clicks are MEASUREMENT-ONLY (no payout wired). New `clicks` table + migration
  0004, signed click-token attribution, `GET /api/click/:id` redirect (verify → rate-
  limit 30/min → record → 302), `clickUrl` threaded serve→providers→TUI, earnings
  un-stubbed. Integration-tested end to end in `click.test.ts` (valid/tampered/missing/
  cross-campaign/unknown).
- Click base URL derives from `VISUALCODE_API_URL` (→ `apiBaseUrl`), else the request
  origin — correct behind Railway's proxy.
- NOT done (out of scope, by design): monetizing clicks; web `/me` click display
  (backend now returns the real count; surface it in the UI later if wanted).

