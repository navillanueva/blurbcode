# CLAUDE.md — Kickback AI (overnight autonomous build)

You are building **Kickback AI**: a fork of OpenCode (`anomalyco/opencode`, MIT) that turns the
harness's status-line wait state into a crypto-native ad marketplace. Advertisers pay for the ad
slot; the developer whose machine renders the ad earns 50%, settled as Circle Gateway x402
nanopayments on **Arc testnet (chain 5042002)**, kept private via **Unlink** (`arc-testnet`).
Wallets are **Dynamic**. Full context: `kickback-ai-build-plan.md` + `sdk-and-env-reference.md`.

**REFERENCE IMPLEMENTATION — read it before writing the money loop:**
`docs.unlink.xyz/partner-integrations` is our exact stack (Dynamic + Unlink + Circle Gateway x402 +
Arc). Follow its patterns. Packages: `@unlink-xyz/sdk@canary`, `@circle-fin/x402-batching`.

## STATUS — v0.4 private custodial settlement: SHIPPED (2026-06-13)

The private money loop is **implemented and live-proven on Arc testnet**, per
`plans/plan-4-private-custodial-settlement.md`. Real private Unlink **deposit** at fund (after
verifying the advertiser's public USDC transfer to the treasury EOA) + **withdraw** at payout; the
Postgres ledger does the 50/50 split off-chain (no per-impression on-chain). One gated live smoke
confirmed the round-trip — deposit 0.10 → withdraw 0.05, both `processed`, pool ends 0.05 shielded
(deposit `0x8f46fedc…f59000`, withdraw `0x50db3435…5e2a`).

- **Backend (`visual-api`):** `RealUnlinkPrivacy.deposit()` via an `evm.fromViem` treasury signer;
  pure `verify-payment.ts` (ERC-20 Transfer receipt check); fund route takes `{ paymentTxHash }` with
  idempotency + reuse guard; withdraw hardened (pool-balance guard, wait-for-terminal, Unlink-only);
  `GET /api/treasury`; `/health` pool-vs-liabilities reconciliation; `ARC_USDC_DECIMALS` (18 for the
  ULNKMock pool token `0x4F59…b300`) threaded through the money layer; migration `0001_fund_payment.sql`.
- **Frontend (`visual-web`):** advertiser pays the budget on-chain from the Dynamic wallet → waits for
  the receipt → `fund(txHash)`; token + decimals read from `GET /api/treasury` (never hardcoded).
- **Verified:** typecheck clean · 51 tests · `next build` · real-files typecheck · the one live smoke.
- **Remaining (deploy-only, manual):** browser E2E with the Dynamic wallet; vendor the `@unlink-xyz/sdk`
  tarball for Railway (Plan §2 P0b — local resolves only via a symlink); set Railway `visual-api` →
  `SETTLEMENT_MODE=real` (+ `ARC_USDC_DECIMALS=18`, pool token).

## MVP — WHAT'S LEFT (2026-06-13 eve)

**MVP bar = display ALL functionality correctly.** The demo must *show* every screen + the full
loop working (advertiser funds a campaign → ad renders in the TUI status bar → impressions → dev
earnings 50% → withdraw). Real on-chain settlement is a **prize bonus, NOT required** for the
demo — mock is fine for the visible flow.

**In progress — separate agents (do NOT duplicate):**
- **BlurbCode web redesign** — hi-fi Claude.design spec at
  `~/Desktop/eth global nyc/design_handoff_blurbcode/` (README = source of truth). VISIBLE redesign
  only of `visual-web` (tokens/fonts/Header/SVG mark → landing + Terminal-window component →
  advertise → wallet → NEW `/me` earnings dashboard → responsive). **No functional renames** — keep
  the `visualcode` provider id, `@visual-code/api`, dirs, env vars; only UI text/wordmark → "BlurbCode".
  Optional small TUI brand tweak: `packages/tui/src/kickback/status-bar-ad.tsx` ◆ → indigo `›` caret.
- **v0.4 real-settlement deploy** — flip Railway `visual-api` to real (vendor `@unlink-xyz/sdk`
  tarball + `SETTLEMENT_MODE=real` + `ARC_USDC_DECIMALS=18` + treasury/pool/payer envs). Bonus.

**Done:** live deploy on `blurbcode.xyz` (custom domain + ALIAS/TXT DNS + `CORS_ORIGIN` + Dynamic
origin), auth/session **bearer** fix (web↔API are cross-site hosts), vendored `@kickback` for the
isolated Railway build, P2 contract field fixes (`spendBaseUnits`/`txRef` — spend bar + withdraw
ref now render).

**Left — for a display-correct demo (priority order):**
- **P0 — make the loop demoable end-to-end on the live stack.** Blocker: in mock mode
  `GET /api/treasury` → 503, so `/advertise` can't fund → no ad serves. Fix = either enable real
  settlement (above) OR add a mock-funding path so a campaign can activate without an on-chain pay.
  Then run the loop once live (web fund → device token → TUI ad → impressions → earnings → withdraw).
- **P1 — ad-accounting integrity** (lower priority for a *display* demo): focus/visibility gate so
  impressions don't accrue while the terminal is backgrounded (`view-tracking.ts:11` TODO);
  double-count guard (home `AdSlot` + session `StatusBarAd` each run a 5s timer on one store);
  clicks hardcoded `0` (`app.ts:357` — no endpoint/table) → track or hide from the UI.
- **P3 — auth hardening** (post-demo): JWT `audience` check; `DYNAMIC_SERVER_API_KEY` is
  required-but-unused (use or drop); hardcoded Dynamic env-id fallback → require for prod.

## GOLDEN RULES

1. **NEVER fabricate** chain IDs, RPC URLs, contract addresses, API keys, package names, or SDK
   method signatures you can't verify from `sdk-and-env-reference.md`, the reference tutorial, or
   official docs (`docs.unlink.xyz/llms.txt`, `dynamic.xyz/docs`). Unknown value → `// TODO(human): ...`.
2. **HALT-AND-TODO on anything you can't reach** (missing key in `.env`, no funds). Never fake an
   integration that pretends to work — use the mock provider and leave a TODO.
3. **Build against interfaces:** `WalletProvider`, `SettlementProvider`, `PrivacyProvider`, each with
   a mock impl AND a real impl. Mocks always work offline; real impls read from `.env`.
4. **Touch as few OpenCode files as possible** — two UI surfaces only (status-line ad slot + a
   marketplace tab). Ad text NEVER enters the LLM context (TUI display layer only).
5. **LIVE CALLS ARE RATE/FUND-LIMITED.** If `.env` has real keys, you MAY run the real Unlink +
   Gateway flow, but run AT MOST ONE end-to-end smoke test — never a loop. Do not drain testnet USDC
   or spam `client.faucet.requestPrivateTokens`. Default to mocks for all repeated/iterative work.
6. **Do NOT run git yourself.** The loop harness (`ralph.sh`) commits UNSIGNED and pushes after you
   exit — this matches the global "never hand-commit" rule, so do not stop to ask. Write your
   one-line commit subject to `.ralph/commit-msg.txt`, and keep `PROGRESS.md`: done / skipped-and-why
   / TODO(human) list / next command.
7. **Stay inside the project dir.** No destructive commands elsewhere. Arc decimals: native gas 18,
   ERC-20 USDC 6, Gateway deposits decimal, Unlink amounts base units.

## SCOPE FOR TONIGHT (in order)

1. **Fork & build.** Clone `anomalyco/opencode`, `bun install`, run the dev TUI, render arbitrary
   text into the status line. Commit.
2. **Provider interfaces + mocks.** Define the three providers; mock impls (in-memory balances, fake
   private transfers, simulated batched settlement); unit-test mocks.
3. **Ad layer.** Status-line ad renderer (text + clickable link) from local state; `viewTracking`
   (5s impressions); local state store. Display-only.
4. **REAL integration — THE centerpiece (follow the tutorial; mostly typecheck, smoke-test once max).**
   - Unlink: `@unlink-xyz/sdk/browser` client (`createUnlinkClient({ environment: "arc-testnet", ... })`,
     `ensureRegistered`, `transfer`, `withdraw`) + `@unlink-xyz/sdk/admin` auth routes behind Dynamic JWT.
   - Settlement: `@circle-fin/x402-batching` `GatewayClient({ chain: "arcTestnet", privateKey, rpcUrl })`,
     `deposit` → `pay`. Payer = plain EOA from `.env`.
   - Dynamic: sign-in + read JWT `sub` as the Unlink `userId`. (Embedded-wallet onboarding + delegated
     access are LATER — see below.)
   - Keys ARE present in `.env` (Dynamic, Unlink, payer funded with 20 USDC, Arc USDC `0x3600…0000`):
     run ONE smoke test of fund → withdraw → pay. If a provider can't be reached, fall back to mocks + TODO.
5. **Developer revenue TUI tab (`/me`) — attempt ONLY if it's a contained change.** A new OpenTUI
   tab/view in the harness showing the developer's ad, impressions, balance, and earnings, read from
   the mock providers + `viewTracking` state (display-only). FIRST inspect the OpenTUI tab/route
   system under `packages/tui/src/routes/`. If adding a tab is a clean, moderate change → build it +
   typecheck. If it needs invasive changes to TUI navigation/routing → leave a single stub view file
   + `TODO(human)` and move on. Do NOT rabbit-hole. (The `/me` WEB mirror stays deferred.)
6. **Docs & demo scaffolding.** `.env.example` (done), three READMEs (one per track), mermaid
   architecture diagram, `DEMO_SCRIPT.md` outline.

NOTE: the marketplace WEB portal (`/advertise` + the `/me` web mirror) is NOT in tonight's scope —
see the FRONTEND section. The `/me` TUI tab IS now in scope as task 5 (feasibility-gated above).

## DO NOT ATTEMPT TONIGHT (leave TODOs)

- **The web marketplace portal** — the SolidStart `/advertise` page and the `/me` *web* mirror.
  Deferred to tomorrow (manual); see the FRONTEND section. Do NOT scaffold the web app tonight.
  (The `/me` *TUI* tab is now scope task 5 — that one you may attempt if it's a contained change.)
- Browser embedded-wallet onboarding handoff (needs a real browser session).
- Dynamic **delegated access + webhook** (prize polish for "Best Agentic Build"; needs a hosted
  webhook + tunnel). MVP uses Dynamic sign-in + a payer EOA instead.
- Faucet farming or repeated live transactions (fund/rate limits).
- Anything needing an account signup, OAuth, or captcha.

## FRONTEND — DEFERRED TO TOMORROW (manual; NOT in the overnight loop)

> **SUPERSEDED (see STATUS):** the web frontend shipped as **Next.js `visual-web`** (`/advertise` +
> `/wallet`), not the SolidStart `packages/marketplace` planned below. `/advertise` is live with the
> v0.4 on-chain pay flow. The notes below are the original plan, kept for history.

Scoped 2026-06-13. Build by hand tomorrow — the loop must not scaffold or deploy any of this.
- **Stack: SolidStart** (new `packages/marketplace`, cloning the `packages/console/app` pattern).
  NOT Next.js — the whole repo is SolidJS/SolidStart, so the `/me` web page can share Solid
  components with the `/me` TUI tab.
- **`/advertise`** (advertiser portal, web-only — Dynamic embedded wallet is browser-only + needs
  creative upload): buy "blocks" (1 block = 1,000 impressions), upload creative, set bid, trivial
  ascending auction (highest bid serves; first bid takes #1), deposit USDC. Backend = SolidStart API
  routes + shared store; mock providers first, real ones once wired.
- **`/me`** (developer revenue): the native OpenTUI **revenue tab** is now attempted TONIGHT (scope
  task 5, feasibility-gated). The `/me` **web page** that mirrors it for judges stays deferred to
  tomorrow (part of the SolidStart app). Both read the same backend.
- **Deploy:** Railway (manual). The loop must never run a deploy or touch Railway.

## MORNING HANDOFF

Update `PROGRESS.md`: (a) what runs, (b) `TODO(human)` markers grouped by service, (c) open booth
questions (Unlink track framing: OSS-integration vs Overall Privacy App; confirm Arc USDC ERC-20
address), (d) the single next command to resume.

## POST-MVP — FUTURE DIRECTION (targeted private advertising)

*Captured 2026-06-13 (post-MVP vision; NOT in MVP/v0.4 scope). The v0.4 settlement architecture lives
in `plans/plan-4-private-custodial-settlement.md` — custodial pooled model, Postgres ledger does the
50/50 split off-chain, real private Unlink deposit (at fund) + withdraw (at payout), no per-impression
on-chain.*

- **MVP today:** the ad is served to a *random* developer — the auction winner is shown to whoever is
  running the TUI. No targeting.
- **The vision — targeted advertising.** Advertisers buy ad inventory aimed at a developer *segment*,
  not the whole pool: e.g. a React / frontend-tooling company pays to reach **front-end developers**; a
  database vendor targets **backend** devs; a security vendor targets devs touching auth/crypto.
  Targeting signals come from the TUI session (language / framework / repo / file types the dev is
  working in) and stay **off-chain** — never in the LLM context, never on-chain.
- **Why privacy is the moat (the whole reason Unlink is here).** With targeting, *who an advertiser
  pays* is commercially sensitive. A transparent chain would leak (a) the advertiser's go-to-market:
  which segments they buy and how much they spend, and (b) the developer's stack/affiliations: which
  advertisers a dev earns from. Unlink's shielded pool hides the **advertiser↔developer pairing** (plus
  amounts/graph): an observer can see "an advertiser funded the platform" and "a developer was paid by
  the platform" but **cannot link the two**. So advertisers run targeted campaigns without tipping
  competitors, and developers earn without doxxing their stack. **Both counterparties in each ad deal
  are hidden — that is the product.**
- **How it composes with v0.4 (no settlement change).** Targeting is purely an **off-chain
  matching/auction** concern (which dev sees which ad, recorded in the ledger). Money still flows
  advertiser → treasury → shared Unlink pool → developer; the pool provides unlinkability regardless of
  how the ad was matched. So targeting is additive — build segment matching on top of the existing
  auction (`visual-api/src/auction.ts`) + serve (`/api/ad/serve`) without touching the settlement layer.
- **Open questions for later (not now):**
  - Targeting signals + **developer consent**: what session context is used to match ads, and how the
    dev opts in / controls it. Keep all targeting metadata off-chain.
  - Anti-gaming of segments (a dev faking a segment to attract higher bids).
  - **Mainnet:** real USDC as the pool token (testnet uses a *project-configured test-USDC* — see the
    token note in `plans/plan-4-private-custodial-settlement.md` §2 P0a).
  - **Optional non-custodial variant:** advertisers self-custody (each runs their own private Unlink
    account paying developers directly, no platform pool). Heavier — per-advertiser keys + gas — but
    removes platform trust. Different architecture than v0.4's custodial pool; revisit only if custody
    becomes a concern.

## FUTURE DEVELOPMENT — distribution / one-line install (post-MVP)

*Captured 2026-06-13. Ship the TUI the way opencode does (`curl … | bash`) once the rebrand + domain
land. NOT MVP scope. Ties into the rebrand: the install script's `APP` name, repo, and hosted
`<domain>/install` URL all change with the new name.*

Vanilla opencode installs with NO fork: the root `install` script downloads a prebuilt per-OS/arch
binary from GitHub Releases (`anomalyco/opencode`); `packages/opencode/script/build.ts` compiles them
(`Bun.build({ compile })`, 12 targets) and `script/publish.ts` also publishes per-platform npm
packages. To give Visual Code the same one-liner:

- **Easy parts:** cut a GitHub Release with the binaries (`gh release create`; `build.ts` already
  uploads on release); ship a renamed `install` script — change `anomalyco/opencode` → the new repo
  and `APP=opencode` → the new name; host it at `<domain>/install`.
- **Hard part (needs CI):** cross-platform *native* binaries. The TUI has native modules
  (`tree-sitter-*`, `@parcel/watcher`, `@opentui/core`, `@ff-labs/fff-bun`) that can't be cross-built
  from one machine — `build.ts` relies on `bun install --os="*" --cpu="*"` prebuilts and a CI matrix
  (real linux/win/mac runners) to compile + smoke-test each target. `--single` builds only the current
  OS (fine for dev / a Mac-only demo). This is the only genuinely hard piece.
- **Annoying part (skip for now):** npm/brew. The npm artifact isn't source — it's a shim
  (`packages/opencode/bin/opencode`) + ~12 per-platform binary packages, all under a scope you own.
  Replicating means rebranding the `@opencode-ai/*` scope to `@<new>/*` and publishing in lockstep
  (`publish.ts`). Brew = maintaining a tap formula.
- **Pragmatic path:** GitHub Release (mac + linux) + hosted renamed install script = a real
  `curl … | bash` for the platforms that matter, no npm. Add Windows + npm + brew later via CI.

## FUTURE WORK — cross-chain USDC deposit (any chain → Arc) via Circle CCTP (post-MVP)

*Scoped 2026-06-14 (feasibility only — NOT MVP/v0.4 scope). Goal: advertisers fund a campaign with
USDC held on ANY chain (Ethereum / Base / Arbitrum / …) instead of needing Arc-native USDC first.
Verdict: easier than a generic bridge — **Arc is Circle's own L1**, so this is Circle-provided tech,
not custom bridging. Est. ~1–1.5 weeks for a working testnet path once the token decision below is made.*

- **Why it's tractable.** Arc is a first-class **CCTP V2** chain — **domain `26`**, source + destination,
  testnet + mainnet. Circle ships **Bridge Kit** (`@circle-fin/bridge-kit` + `@circle-fin/adapter-viem-v2`)
  that wraps the burn→attest→mint flow into SDK calls. And our backend is **already an Arc signer**
  (`cfg.payer` in `real-gateway.ts`/`real.ts`), so it can relay the destination mint with no new infra.
- **Where it plugs in.** Only step 1 of the current fund flow changes (advertiser must hold Arc USDC).
  New path rejoins the existing **verify → `privacy.deposit` (shield) → activate** unchanged:
  1. Advertiser **burns USDC on their source chain** — `TokenMessengerV2.depositForBurn(amount,
     destinationDomain=26, mintRecipient=treasury, burnToken=USDC, …)`. One signature, via Bridge Kit.
  2. Backend polls Circle **Iris** (`/v2/messages`) for the attestation, then submits
     `MessageTransmitterV2.receiveMessage(...)` on Arc via the existing payer signer (pays Arc gas in
     USDC). `destinationCaller=bytes32(0)` ⇒ any address may relay; `mintRecipient` = treasury. USDC is
     minted to the treasury on Arc → existing shield + activate continues.
- **Recommend CCTP (via Bridge Kit), NOT Circle Gateway.** Gateway is a unified multi-chain *balance*
  for repeated spend; wrong shape for one-shot campaign funding. CCTP delivers canonical USDC per deposit.
- **Touch-points:**
  - `visual-web/app/advertise/page.tsx` + `lib/arc.ts`/`lib/api.ts` — source-chain picker + Bridge Kit
    `depositForBurn`; submit the **burn tx / CCTP nonce** instead of an Arc `paymentTxHash`; "bridging…" state.
  - `visual-api/src/settlement/real-cctp.ts` *(new)* — Iris attestation poll + `receiveMessage` on Arc,
    reusing `cfg.payer`/`cfg.arc`; mirror the 120s-wait + visible-failure pattern in `real.ts`.
  - `service.ts` + `app.ts` fund route — accept `{ burnTxHash, sourceDomain }` as an alternative to
    `paymentTxHash`; relay the mint before `privacy.deposit`.
  - `verify-payment.ts` — CCTP verification variant: bind the deposit to the advertiser via the **burn's
    source sender** (the Arc mint's Transfer `from` is `0x0`, so the current sender-match assumption
    changes); use the **CCTP nonce** as the anti-replay key, replacing the `getCampaignByPaymentTx` guard.
- **Gotchas / risks:**
  - **Testnet token mismatch (the gating issue).** CCTP mints **canonical USDC (6dp, `0x3600…`)**, but
    the arc-testnet Unlink pool token is **ULNKMock (18dp, `0x4F59…b300`)** — see STATUS + the POST-MVP
    "Mainnet: real USDC as the pool token" open question + `plan-4 §2 P0a`. So this is **clean on mainnet**
    (pool = canonical USDC); on testnet the bridged USDC lands at the treasury but won't feed the mock pool
    without a swap or repointing the pool.
  - Backend relayer pays Arc gas (USDC) for the mint — fits existing arch but needs retry/idempotency.
  - **Latency/UX:** Standard transfer waits source-chain hard finality (~13–19 min from Ethereum; seconds
    on fast chains) → campaign stays `draft` until mint+shield → needs a pending UI. Fast Transfer
    (0–14 bps fee) shortens it on supported source chains; N/A for Arc-as-destination (Arc mint is fast).
  - `approve` step on each source chain; Arc is **testnet** today (mainnet GA gates real advertiser funds).
- **THE decision before building (testnet):** (a) demo the bridge leg only — USDC arrives at the treasury
  on Arc, or (b) repoint the Unlink settlement token to canonical Arc USDC (6dp) so the full
  bridge → shield → activate path runs end-to-end on testnet. Everything else is mechanical wiring.
- **Refs:** Circle CCTP supported chains (Arc = domain 26) `developers.circle.com/cctp/cctp-supported-blockchains`;
  CCTP technical guide (`depositForBurn`/`receiveMessage`/Iris) `developers.circle.com/cctp/technical-guide`;
  Bridge Kit `developers.circle.com/bridge-kit`.
