# Plan 4 — Private custodial settlement (v0.4)

*Implementation plan for making payments **actually private via Unlink**, grounded in the current
codebase. Built to be executed by another agent. Everything is **testnet**. The 50/50 split stays
**off-chain in Postgres**; on-chain Unlink ops happen **only at fund + withdraw** (never per
impression — per-impression settlement would be too expensive on gas).*

---

## 0. Decision (locked) & what this plan delivers

**Model: custodial-by-accounting + a single shielded treasury pool.** The backend owns one private
Unlink account (the "pool"); the Postgres ledger is the source of truth for per-account balances and
the 50/50 split. Money crosses the chain at exactly two coarse boundaries, both made **real**:

1. **Advertiser deposit (at fund time):** the advertiser's Dynamic wallet sends the campaign budget in
   USDC **on-chain to the platform treasury EOA** (public transfer). The backend verifies that
   payment, then does a **real private Unlink `deposit`** of the budget into the shielded pool.
2. **Developer payout (at withdraw time):** the backend does a **real private Unlink `withdraw`** from
   the pool out to the developer's wallet address. *(Already wired; this plan hardens it.)*

Per-impression accounting (`floor(bid×count/1000)`, dev credited 50%) stays exactly as-is in Postgres
(`src/accounting.ts`, `repo.recordImpression`). **No chain calls per impression.**

### Privacy property (state this honestly, don't oversell)
On-chain, three things remain **visible**: advertiser→treasury transfer (amount + advertiser), the
treasury→pool deposit (amount), and the pool→developer withdraw (amount + developer). What Unlink
**hides** is the *link* between them: which advertiser's budget funded which developer's payout, and
the per-developer earnings breakdown. As deposits/withdrawals from many advertisers/developers
aggregate in the pool (helped by timing/amount hygiene — §7), the advertiser↔developer spend graph is
unlinkable. That is the deliverable: **the relationship between who paid for ads and who earned from
serving them is private.**

---

## 1. Where the code is today (so the implementer has the map)

- **Settlement boundary:** `visual-api/src/settlement/service.ts` — `SettlementService.fundCampaign` /
  `withdrawEarnings`. Selected by `createSettlementService({mode})` in `factory.ts` (mock by default;
  `real` via dynamic `import("./real")`).
- **Real providers:** `real-unlink.ts` (`RealUnlinkPrivacy`: `ensureRegistered`/`getBalance`/
  `getAddress`/`requestFaucet`/`transfer`/`withdraw`), `real-gateway.ts` (Circle x402 — **unused in
  v0.4**), `real.ts` (`createRealSettlementService` + `realSmoke`).
- **Done this session (already on disk):** server-side Unlink wiring fixed — registration + per-user
  authorization tokens go through `createUnlinkAdmin` (`UNLINK_API_KEY`); `transfer`/`withdraw` return
  a `TransactionHandle`; the read-only smoke proves the pool account registers + reads its shielded
  balance live on Arc. **Real mode initializes and is read-only-proven.**
- **Fund route:** `app.ts:187` `POST /api/campaigns/:id/fund` → `settlement.fundCampaign({campaignId,
  amountBaseUnits: campaign.budgetBaseUnits, advertiserAddress})` → `repo.activateCampaign` +
  `repo.recordSettlement(kind:"fund")`.
- **Withdraw route:** `app.ts:227` `POST /api/withdraw` → reads `earnings.balanceBaseUnits` →
  `settlement.withdrawEarnings({accountId, amountBaseUnits, recipientEvmAddress})` →
  `repo.zeroEarnings` + `recordSettlement(kind:"withdraw")`. Order is correct (settle first, then zero;
  failure throws 502 before zeroing).
- **Today's `fundCampaign` is a stub:** real mode calls `privacy.requestFaucet()` (faucet into the
  pool) — replace this. The faucet also **does not support the configured token** (see §2 P0a).
- **Web fund flow:** `visual-web/app/advertise/page.tsx:90` → `lib/api.ts:128 fundCampaign(id)` →
  `POST /api/campaigns/:id/fund`. **No wallet signing happens today.** Dynamic wallet is available via
  `useDynamicContext().primaryWallet` (`app/wallet/page.tsx:15`).
- **DB schema:** `src/db/schema.ts` — `campaigns(... budget_base_units, budget_remaining_base_units,
  status)`, `settlements(id, account_id, amount_base_units, tx_ref, kind, created_at)`,
  `earnings(account_id PK, balance_base_units)`.
- **Money discipline:** `packages/kickback/src/money.ts` — base units (6dp) as bigint; Unlink amounts
  are base-unit decimal strings; Arc native gas is 18dp. **Never mix.**

---

## 2. Prerequisites / blockers (do these first — Phase 0)

### P0a — Pool token & decimals (RESOLVED 2026-06-13)
The shielded pool's token on arc-testnet is **`0x4F592595Ec2dcb794d949551554436807565b300`** — the
`ULNKMock` test token (symbol `ULNKm`), confirmed on-chain (faucet mint tx + `decimals()`/`symbol()`
reads). It is **NOT** the canonical Arc USDC `0x3600…0000` — that's why `requestPrivateTokens` returned
`token not supported by faucet`. No API enumerates it; it's the project token behind `UNLINK_API_KEY`.
Top up the treasury EOA with more ULNKm via the SDK faucet (`faucet.requestTestTokens` → mints public
ERC-20 to an EVM address) or whatever faucet minted the current 20 ULNKm.

⚠️ **DECIMALS = 18, not 6 — handle this carefully.** The money layer assumes USDC = 6dp
(`packages/kickback/src/money.ts` `USDC_DECIMALS = 6`; `config.ts` sets `Token.decimals = 6`;
`visual-web/lib/{money,arc}.ts` hardcode 6). ULNKMock is **18dp** (the faucet minted `20e18`). Real
USDC on mainnet IS 6dp, so make decimals **configurable**, not a blanket constant swap:
- Add **`ARC_USDC_DECIMALS`** (default `6`; **set `18` on arc-testnet for ULNKMock**) to env +
  `.env.example` + Railway. `readKickbackEnv` (`packages/kickback/src/config.ts`) must read it into
  `arc.usdc.decimals` instead of hardcoding `USDC_DECIMALS`.
- Pick **one** base-unit convention end-to-end = the token's decimals. Every human↔base conversion must
  pass `token.decimals` to `toBaseUnits`/`fromBaseUnits` (both already accept a decimals arg, default 6).
  Audit + fix callers: `real.ts` `realSmoke` (`fromBaseUnits(bal)`, `toBaseUnits(opts.unlinkWithdraw)`),
  web campaign create/display, and any smoke/log output. Ledger amounts stay abstract base-unit
  integers — internally consistent as long as the SAME decimals is used at every boundary; on-chain a
  budget of `1e18` base units = 1 ULNKm.
- The web must NOT hardcode 6: `GET /api/treasury` (§3.5) returns `decimals` — the advertiser transfer
  (`parseUnits(amount, decimals)`) and all display (`formatUnits`) read it from there.

**Already set during planning** (root `.env` + `visual-api/.env`, both gitignored):
`ARC_USDC_ADDRESS=0x4F592595Ec2dcb794d949551554436807565b300`, `ARC_USDC_DECIMALS=18`. Still TODO:
mirror to Railway `visual-api` + `visual-web/lib/arc.ts`, and **wire `ARC_USDC_DECIMALS` in code**
(config currently still hardcodes 6 — read-only smoke works because balance is 0; deposit/withdraw amount
math will be wrong until threaded).

> **Verification:** `KICKBACK_SMOKE_CONFIRM=1 bun run smoke --unlink-deposit 0.10 --unlink-withdraw 0.05`
> (§5) must complete a real deposit→withdraw round-trip once decimals are threaded.

### P0b — SDK distribution for Railway (HARD BLOCKER for deploy)
`@unlink-xyz/sdk` is a **restricted/private** npm package. `bun install` silently drops it; locally
it resolves only because of a dev symlink into the bun store. A clean Railway build (root dir
`visual-api/`) will **not** have it. Pick one:

- **(Recommended) Vendor a tarball.** `cd` to the cached package dir and `bun pm pack` (or
  `npm pack`) → commit `visual-api/vendor/unlink-xyz-sdk-0.3.0-canary.552.tgz` → in
  `visual-api/package.json` set `"@unlink-xyz/sdk": "file:vendor/unlink-xyz-sdk-0.3.0-canary.552.tgz"`
  (keep it under `optionalDependencies` so mock-only deploys still build) → `bun install` to refresh
  `bun.lock`. Deterministic, no registry creds in CI.
- **(Alt) Private registry.** Add an `.npmrc`/`bunfig.toml` scoped registry for `@unlink-xyz` with an
  auth token from Railway env (`NPM_TOKEN`). Requires the token to keep working; less reproducible.

Keep the `tsconfig.json` `exclude` of `real.ts`/`real-unlink.ts` only if a token-less build must still
typecheck; once the SDK is reliably present in CI, consider removing the exclude so the real path is
type-checked in the default `bun run typecheck`.

### P0c — Treasury funding (testnet)
Treasury EOA = `PAYER_ADDRESS`/`PAYER_PRIVATE_KEY` (reuse; see §3.1). It must hold (a) enough native
gas (USDC, 18dp — `faucet.circle.com` Arc) for `approve` + `deposit` txs, and (b) it's a *pass-through*
for advertiser funds (receives `budget`, immediately deposits `budget` into the pool). Confirm the
payer EOA holds the **pool token** (P0a), not only `0x3600…0000` — these may differ.

---

## 3. Backend changes (`visual-api`)

### 3.1 Config & env (`src/config.ts` / `src/env.ts`, `.env.example`, `@kickback/config`)
- `ARC_USDC_ADDRESS` → the pool token `0x4F592595Ec2dcb794d949551554436807565b300` (ULNKMock, P0a).
- `ARC_USDC_DECIMALS` → **18** on arc-testnet (default 6 for mainnet USDC). Read into `arc.usdc.decimals`
  in `readKickbackEnv`; thread `token.decimals` through every `toBaseUnits`/`fromBaseUnits` call (P0a).
- `TREASURY_ADDRESS` — the EOA advertisers pay into. **Default to `PAYER_ADDRESS`** (treasury and
  Gateway payer are the same EOA). Surface via a new `GET /api/treasury` (§3.5) and as
  `NEXT_PUBLIC_TREASURY_ADDRESS` for the web.
- `FUND_MIN_CONFIRMATIONS` (default `1`) — confirmations required on the advertiser payment tx.
- No new Unlink vars: `UNLINK_MNEMONIC` (pool account), `UNLINK_API_KEY`, `UNLINK_ENGINE_URL`,
  `PAYER_PRIVATE_KEY` (treasury/deposit signer) already exist and are validated in
  `readKickbackEnv` (`packages/kickback/src/config.ts`).
- Set `SETTLEMENT_MODE=real` on the Railway `visual-api` service (currently `mock`).

### 3.2 `RealUnlinkPrivacy` — add a real `deposit()` + an EVM signer (`src/settlement/real-unlink.ts`)
The pool account currently has no EVM signer, so it can only do view/withdraw/transfer ops that the
relayer handles. `deposit` pulls public ERC-20 from the treasury EOA into the shielded pool and needs
a viem signer. Verified SDK surface (canary .552):

```ts
import { account, createUnlinkClient, evm } from "@unlink-xyz/sdk/client"
import type { TransactionHandle, UnlinkClient, UnlinkLocalAccount } from "@unlink-xyz/sdk/client"
import { createUnlinkAdmin } from "@unlink-xyz/sdk/admin"
import { createWalletClient, createPublicClient, http, defineChain } from "viem"
import { privateKeyToAccount } from "viem/accounts"

export interface RealUnlinkConfig {
  environment?: string
  engineUrl?: string
  apiKey: string
  account: UnlinkLocalAccount
  token: Token
  /** Treasury EOA signer + Arc RPC — required for deposit() (pulls public USDC into the pool). */
  evmSigner?: { privateKey: `0x${string}`; rpcUrl: string; chainId: number }
}
```

Construct the EVM provider once in the constructor when `evmSigner` is present
(`evm.fromViem({ walletClient, publicClient })` — verified `ViemProviderOptions`):

```ts
const chain = defineChain({ id: cfg.chainId, name: "arc", nativeCurrency: { name:"USDC", symbol:"USDC", decimals:18 }, rpcUrls: { default: { http: [cfg.rpcUrl] } } })
const acct = privateKeyToAccount(cfg.privateKey)
const walletClient = createWalletClient({ account: acct, chain, transport: http(cfg.rpcUrl) })
const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) })
this.evmProvider = evm.fromViem({ walletClient, publicClient })   // satisfies EvmProvider (signTypedData/sendTransaction/call/getCode/getErc20Allowance)
```

Add the method (Permit2 approval handled first; idempotent — no-op once approved):

```ts
/** Shield `amount` (base units) of the pool token from the treasury EOA into the private pool. */
async deposit(amount: BaseUnits): Promise<TransactionHandle> {
  if (!this.evmProvider) throw new Error("deposit requires an EVM signer (PAYER_PRIVATE_KEY/ARC_*)")
  await this.client.ensureErc20Approval({ token: this.token.address, amount: amount.toString(), evm: this.evmProvider })
  return this.client.deposit({ token: this.token.address, amount: amount.toString(), evm: this.evmProvider })
}
```

> Implementer: confirm `ensureErc20Approval` return/idempotency and whether to prefer
> `depositWithApproval({ token, amount, evm, waitForApproval })` (single call that waits for the
> approval tx) over `ensureErc20Approval`+`deposit`. Both are on `UnlinkClient`. Either is fine; pick
> the one that reliably waits for approval before depositing on the **first** deposit.

### 3.3 `real.ts` — wire the signer + rewrite `fundCampaign` (`src/settlement/real.ts`)
Pass the signer when building the pool provider (both in `createRealSettlementService` and `realSmoke`):

```ts
privacy = new RealUnlinkPrivacy({
  engineUrl: cfg.unlink.engineUrl, environment: cfg.unlink.environment, apiKey: cfg.unlink.apiKey!,
  account: unlinkAccountFromMnemonic(cfg.unlink.mnemonic!), token: cfg.arc.usdc,
  evmSigner: cfg.payer && cfg.arc ? { privateKey: cfg.payer.privateKey, rpcUrl: cfg.arc.rpcUrl, chainId: cfg.arc.chainId } : undefined,
})
```

Extend `SettlementService.fundCampaign` params with `paymentTxHash: string` (and keep
`advertiserAddress`). New real `fundCampaign`:

```ts
async fundCampaign({ campaignId, amountBaseUnits, advertiserAddress, paymentTxHash }) {
  if (!privacy) throw new Error("real privacy unavailable")           // surface, don't fake
  // 1) Verify the advertiser actually paid the treasury on-chain (see §3.4).
  await verifyPaymentToTreasury({ rpcUrl: cfg.arc.rpcUrl, token: cfg.arc.usdc.address,
    treasury: cfg.treasuryAddress, from: advertiserAddress, minAmount: amountBaseUnits,
    txHash: paymentTxHash, minConfirmations: cfg.fundMinConfirmations })
  // 2) Shield the budget into the pool (real private deposit).
  const handle = await privacy.deposit(amountBaseUnits)
  await handle.wait({ timeoutMs: 120_000 })
  return { txRef: `unlink-deposit:${handle.txId}` }
}
```

The route (§3.5) enforces idempotency on `paymentTxHash` **before** calling this, so a verified payment
is consumed once. If the deposit fails after verification, the route must **not** mark the payment
consumed in a way that blocks retry (see §3.6 — store `payment_tx_hash` + a `funded_at`/deposit status,
allow re-running the deposit for a verified-but-not-deposited campaign).

### 3.4 Payment-verification helper (new `src/settlement/verify-payment.ts`)
Pure viem; no SDK. Verifies the advertiser's ERC-20 transfer landed at the treasury:

```ts
// getTransactionReceipt(txHash) → status === "success"; confirmations ≥ min;
// among logs, find an ERC-20 Transfer (topic0 = keccak256("Transfer(address,address,uint256)"))
//   where log.address == token, topics[2] == pad(treasury), data(value) ≥ minAmount,
//   and (optionally) topics[1] == pad(from=advertiserAddress).
// Throw a descriptive Error on any mismatch (wrong token / recipient / amount / unconfirmed / reverted).
```

Edge cases to handle explicitly: tx not found / pending, reverted, wrong token contract, amount short,
recipient ≠ treasury, advertiser address mismatch (warn vs reject — decide), and **reuse** (handled at
the DB layer, §3.6).

### 3.5 Routes (`src/app.ts`)
- **`GET /api/treasury`** (new, public or session): `{ address: TREASURY_ADDRESS, token:
  ARC_USDC_ADDRESS, chainId: ARC_CHAIN_ID, decimals: 6 }` so the web knows where to send + which token
  (no frontend hardcoding).
- **`POST /api/campaigns/:id/fund`** now reads `{ paymentTxHash }` from the body. Flow:
  1. Ownership check (existing).
  2. **Idempotency:** if `campaign.payment_tx_hash` already set and campaign is `active`, return the
     existing settlement (no double-deposit). Reject a `paymentTxHash` already bound to another
     campaign (unique index, §3.6).
  3. `settlement.fundCampaign({ campaignId, amountBaseUnits: budget, advertiserAddress, paymentTxHash })`.
  4. On success: `repo.setCampaignPaymentTx(id, paymentTxHash)`, `repo.activateCampaign(id)`,
     `repo.recordSettlement({kind:"fund", txRef})`. On failure: 502, campaign stays `draft`.
- **`/health`** (existing `app.ts:75`): add reconciliation — `poolBalance` (live `privacy.getBalance()`
  when real) vs `liabilities` (`SUM(earnings.balance_base_units)`); report both + a `healthy:
  poolBalance ≥ liabilities` flag. (Cache/guard the live call so `/health` stays cheap.)
- **`POST /api/withdraw`** unchanged in shape; hardening is in §3.3/§3.7 (wait for terminal, pool guard).

### 3.6 DB (`src/db/schema.ts` + new `drizzle/0001_fund_payment.sql` + `repo.ts`)
- `campaigns`: add `payment_tx_hash text` (nullable). Unique index to prevent reuse:
  ```sql
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS payment_tx_hash text;
  CREATE UNIQUE INDEX IF NOT EXISTS campaigns_payment_tx_hash_uniq
    ON campaigns (payment_tx_hash) WHERE payment_tx_hash IS NOT NULL;
  ```
  (Idempotent, matches the `drizzle/0000_init.sql` style; the server auto-applies migrations on start.)
- `settlements`: optionally add `tx_hash text` (the advertiser payment hash, distinct from `tx_ref` =
  Unlink deposit/withdraw id) for audit. Optional for v0.4.
- `repo.ts`: `setCampaignPaymentTx(db, id, hash)`; `getCampaignByPaymentTx(db, hash)` (idempotency);
  `sumOutstandingEarnings(db)` (reconciliation). Add the `paymentTxHash` field to the drizzle
  `schema.ts` `campaigns` table object.

### 3.7 Withdraw hardening (`real.ts withdrawEarnings`)
- Guard: `if ((await privacy.getBalance()) < amountBaseUnits) throw` — never zero the ledger if the
  pool can't cover it (the route already settles-before-zeroing, so a throw → 502 → earnings intact).
- Wait for terminal: `const h = await privacy.withdraw({recipientEvmAddress, amount}); await
  h.wait({timeoutMs:120_000})` so a failed payout doesn't zero earnings. Map a `wait` timeout to a
  clear non-fatal "pending" state if needed (don't zero on timeout — leave earnings, record a pending
  settlement, reconcile later).
- Remove the Gateway fallback branch in `withdrawEarnings` (v0.4 is Unlink-only); or keep it behind an
  explicit flag. Don't silently route payouts through the non-private Gateway.

### 3.8 Mock parity (`src/settlement/mock.ts`)
- `fundCampaign` accepts `paymentTxHash` (ignored in mock) so the 36 PGlite tests + offline dev still
  pass. Mock already calls `privacy.ensureRegistered()` + `settlement.deposit(...)`; keep returning
  deterministic `mock-fund:` refs. No on-chain verification in mock.

---

## 4. Frontend changes (`visual-web`)

### 4.1 `lib/api.ts`
- `fundCampaign(id, paymentTxHash)` → `POST /api/campaigns/:id/fund` with `body:{paymentTxHash}`.
- `getTreasury()` → `GET /api/treasury` → `{address, token, chainId, decimals}`.

### 4.2 `app/advertise/page.tsx` — real on-chain payment before fund
Replace the bare `await fundCampaign(id)` with: get treasury, send USDC from the Dynamic wallet, wait
for the receipt, then call fund with the tx hash.

```ts
import { isEthereumWallet } from "@dynamic-labs/ethereum"   // add dep if not present
import { erc20Abi, parseUnits } from "viem"
// ...
const { primaryWallet } = useDynamicContext()
const { address: treasury, token, decimals } = await getTreasury()
if (!primaryWallet || !isEthereumWallet(primaryWallet)) throw new Error("connect an EVM wallet")
const walletClient = await primaryWallet.getWalletClient()   // viem WalletClient on Arc
const amount = parseUnits(budgetHumanString, decimals)       // 6dp USDC base units
const hash = await walletClient.writeContract({ address: token, abi: erc20Abi, functionName: "transfer", args: [treasury, amount] })
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(ARC_RPC_URL) })
await publicClient.waitForTransactionReceipt({ hash })
await fundCampaign(id, hash)
```

- Pre-checks: wallet on Arc (chain 5042002 — `arc.ts` already defines the network for Dynamic), USDC
  balance ≥ budget, and native gas present. Surface clear errors.
- Fix the misleading copy at `advertise/page.tsx:91` ("on-chain private deposit is in flight") — the
  advertiser→treasury transfer is **public**; the *private* deposit is the backend pool step. Reword
  to reflect what's actually visible vs private (see §0 privacy property).

### 4.3 `lib/arc.ts`
- `ARC_USDC_ADDRESS` must equal the **pool token** (P0a). Today it's `0x3600…0000`; update if the pool
  token differs. Keep the 6dp/18dp discipline (transfer amounts are 6dp base units; native gas 18dp).

---

## 5. The single live smoke (extend `real.ts` / `smoke.ts`)
The faucet path is dead (token unsupported). Replace it with a **real deposit** leg so the one allowed
live run proves the full custodial round-trip end-to-end:

- Add `--unlink-deposit <usdc>` → `privacy.deposit(toBaseUnits(x))` + `await handle.wait()` + balance
  before/after (the advertiser-deposit leg, funded from the treasury EOA).
- Keep `--unlink-withdraw <usdc>` → private withdraw to the payer/treasury EOA + `wait` (the dev-payout
  leg). Cap to shielded balance (already implemented).
- Drop/keep `--unlink-faucet` as a no-op note (faucet doesn't support the project token).

```
cd visual-api
KICKBACK_SMOKE_CONFIRM=1 bun run smoke --unlink-deposit 0.10 --unlink-withdraw 0.05
# expect: shielded balance 0 → 0.10 (deposit CONFIRMED) → withdraw 0.05 to treasury (CONFIRMED) → 0.05 left
```

This is the **one** fund-moving smoke (golden rule 5). Treasury EOA must hold ≥0.10 pool-token USDC +
gas.

---

## 6. Tests
- **Keep all 36 green** (PGlite + mock). Mock `fundCampaign` accepting `paymentTxHash` is the only
  change touching them.
- **New unit tests** (`test/`): `verify-payment` (mock viem RPC: success / wrong token / short amount /
  wrong recipient / unconfirmed / reverted); fund idempotency (same `paymentTxHash` twice → one
  deposit; reused hash on a second campaign → rejected); withdraw pool-balance guard (insufficient pool
  → throws, earnings not zeroed); accounting (`recordImpression`) **unchanged**.
- **e2e (PGlite, mock settlement):** auth → device token → campaign → fund(`paymentTxHash`) → serve →
  impressions → earnings → withdraw still passes with the new signatures.
- **Live:** the §5 smoke (once).

---

## 7. Failure modes, idempotency, security, privacy hygiene
- **Fund atomicity:** verify → deposit → (DB) activate + set `payment_tx_hash` + record settlement.
  Deposit failure after verification → 502, campaign stays `draft`, payment **not** consumed so the
  advertiser can retry the fund (re-verifies the same hash, re-attempts deposit). Don't lose the
  advertiser's money or double-deposit.
- **Withdraw atomicity:** settle (wait terminal) → then `zeroEarnings`. Failure/timeout → earnings
  intact (route throws before zeroing). Guard concurrent withdraws (the `zeroEarnings` should be atomic
  / row-locked; reject a second concurrent withdraw for the same account).
- **Reconciliation:** `/health` reports `poolBalance` vs `Σ outstanding earnings`; pool must always be
  ≥ liabilities. Alert on drift. (Platform's accrued 50% cut also sits in the pool until withdrawn —
  out of scope here.)
- **Keys:** `PAYER_PRIVATE_KEY` (treasury/deposit signer) + `UNLINK_MNEMONIC` (pool account) live in
  Railway secrets + local gitignored `.env`. Never log. Testnet now — **rotate before mainnet** (both
  were echoed during setup). `UNLINK_API_KEY` is backend-only (admin).
- **Privacy hygiene (optional MVP, document):** avoid identical deposit/withdraw amounts and tight
  timing (weakens unlinkability). Prefer keeping a larger standing pool balance and withdrawing varied
  amounts later; batch deposits/withdrawals when possible. State plainly what is visible vs hidden
  (§0).

---

## 8. Rollout (ordered; each phase shippable + verifiable)
- **Phase 0 — Unblock.** (P0a) set the pool token; (P0b) vendor the SDK tarball so Railway builds;
  (P0c) fund the treasury EOA with pool-token USDC + gas. **Accept:** `bun run smoke` read-only shows
  `privacy: REAL` + correct token; clean `bun install` in `visual-api` has `@unlink-xyz/sdk`.
- **Phase 1 — Backend deposit + verify.** §3.2–3.8 (deposit(), signer, fundCampaign rewrite, verify
  helper, `/api/treasury`, migration, repo, mock parity). **Accept:** new + existing unit/e2e tests
  pass; default + real-files typecheck clean.
- **Phase 2 — Frontend on-chain payment.** §4. **Accept:** in the web app, funding a campaign prompts
  the Dynamic wallet, sends USDC to treasury, and `fund(txHash)` activates the campaign (against a real
  backend).
- **Phase 3 — Withdraw hardening + reconciliation.** §3.7 + `/health`. **Accept:** withdraw waits for
  terminal; pool-insufficient is rejected without zeroing; `/health` shows pool ≥ liabilities.
- **Phase 4 — Live round-trip + flip prod.** Run the §5 smoke once; do a manual web E2E
  (create→pay→fund→serve→impressions→withdraw) with `SETTLEMENT_MODE=real`; set Railway
  `visual-api` to `real`. **Accept:** deposit + withdraw both confirm privately on Arc; advertiser↔dev
  link not on-chain.

---

## 9. File-by-file change index (for the implementing agent)
| File | Change |
|---|---|
| `visual-api/src/settlement/real-unlink.ts` | add `evmSigner` config + `evm.fromViem` provider + `deposit()` (+ approval) |
| `visual-api/src/settlement/real.ts` | wire signer; rewrite `fundCampaign` (verify→deposit→wait); harden `withdrawEarnings`; smoke `--unlink-deposit` |
| `visual-api/src/settlement/verify-payment.ts` | **new** — viem ERC-20 Transfer receipt verification |
| `visual-api/src/settlement/service.ts` | add `paymentTxHash` to `fundCampaign` params |
| `visual-api/src/settlement/mock.ts` | accept `paymentTxHash` (ignored) |
| `visual-api/src/settlement/smoke.ts` | parse `--unlink-deposit` |
| `visual-api/src/app.ts` | `GET /api/treasury`; fund route takes `paymentTxHash` + idempotency; `/health` reconciliation |
| `visual-api/src/db/schema.ts` + `drizzle/0001_fund_payment.sql` + `repo.ts` | `campaigns.payment_tx_hash` (+ unique idx); repo helpers |
| `visual-api/src/config.ts` / `env.ts` / `.env.example` | `TREASURY_ADDRESS`, `FUND_MIN_CONFIRMATIONS`, `ARC_USDC_ADDRESS`=pool token |
| `visual-api/package.json` + `vendor/*.tgz` | vendored SDK tarball (Railway) |
| `visual-web/lib/api.ts` | `fundCampaign(id, txHash)`, `getTreasury()` |
| `visual-web/app/advertise/page.tsx` | Dynamic-wallet USDC transfer → wait receipt → `fund(txHash)`; fix copy |
| `visual-web/lib/arc.ts` | `ARC_USDC_ADDRESS` = pool token |
| `ETH Global AI Plans/plans/CONTRACT.md` | document `fund {paymentTxHash}` + `GET /api/treasury` |

---

## 10. Open questions / TODO(human)
- **Pool token address — RESOLVED:** `0x4F592595Ec2dcb794d949551554436807565b300` (ULNKMock, **18dp**;
  see P0a). Remaining work is threading `ARC_USDC_DECIMALS=18` through the money layer (config still
  hardcodes 6) and mirroring the env to Railway + `visual-web/lib/arc.ts`.
- **Treasury = payer EOA?** Plan assumes yes (reuse `PAYER_*`). Split into a dedicated `TREASURY_*` if
  you want the deposit signer separate from the Gateway payer.
- **Confirmations** (`FUND_MIN_CONFIRMATIONS`) — 1 is fine on testnet; raise for mainnet.
- **Refunds / platform-cut withdrawal** — unspent campaign budget and the platform's accrued 50% both
  sit in the pool; refund + platform-payout flows are **out of scope for v0.4** (note for v0.5).
- **Advertiser address binding** — reject a payment whose `from` ≠ the advertiser's linked address, or
  just warn? (Stricter is safer; decide.)
