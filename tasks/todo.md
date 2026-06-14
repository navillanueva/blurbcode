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

