# CLAUDE.md — Kickback AI (overnight autonomous build)

You are building **Kickback AI**: a fork of OpenCode (`anomalyco/opencode`, MIT) that turns the
harness's status-line wait state into a crypto-native ad marketplace. Advertisers pay for the ad
slot; the developer whose machine renders the ad earns 50%, settled as Circle Gateway x402
nanopayments on **Arc testnet (chain 5042002)**, kept private via **Unlink** (`arc-testnet`).
Wallets are **Dynamic**. Full context: `kickback-ai-build-plan.md` + `sdk-and-env-reference.md`.

**REFERENCE IMPLEMENTATION — read it before writing the money loop:**
`docs.unlink.xyz/partner-integrations` is our exact stack (Dynamic + Unlink + Circle Gateway x402 +
Arc). Follow its patterns. Packages: `@unlink-xyz/sdk@canary`, `@circle-fin/x402-batching`.

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
