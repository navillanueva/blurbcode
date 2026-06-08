# Kickback AI — ETHGlobal NYC 2026 Build Plan

*Single-file build & scoping doc. Last updated: Sat Jun 13, 2026.*

---

## 0. What we're building (one paragraph)

A forked, open-source AI coding harness (OpenCode) that turns the harness's
wait-state status line into a crypto-native ad marketplace. On first open the
user gets a wallet (Dynamic). Advertisers pay to occupy the status-line ad slot;
the developer whose machine renders the ad earns 50% of the spend. All settlement
runs on **Arc testnet** as batched x402 nanopayments, and every payment
(advertiser spend + developer earnings) is **private via Unlink** — amounts,
counterparties, and the spend graph stay off the public ledger, with a view key
reserved for audit. Think "kickbacks.ai, but crypto-native and built into the
harness instead of bolted onto Claude Code."

---

## 1. Three findings that shape the build (read first)

1. **kickbacks.ai is NOT reusable.** Its repo is *proprietary and
   source-available — not open source*, and it's a **VS Code extension** that
   hooks Claude Code / Codex via the spinner setting — not an OpenCode component.
   We cannot fork or lift its code, and it targets the wrong harness anyway.
   → We build a thin ad layer ourselves; use its module layout only as a
   reference map. Its deliberate "no crypto" stance is exactly our whitespace
   (people are literally asking the author to add x402).

2. **We do NOT deploy Unlink's contracts.** Unlink is *an SDK + a smart contract
   they host*. We `createTenant({ engineUrl, apiKey })`, then
   `tenant.forUser({ account })`, then call `deposit/transfer/withdraw/execute`.
   They document our exact case: a single-process CLI/hackathon pattern (one
   Tenant + one Session in-process). → The real question for step 4 is **"is
   Unlink's engine live on Arc testnet?"** — booth question #1.

3. **There is no single joint bounty.** Three separate sponsor tracks, and they
   line up cleanly (see §2).

---

## 2. Prize strategy (3-slot cap)

We may submit to at most **3 partner prizes**. Target slate:

| Slot | Track | Prize | Why it fits |
|---|---|---|---|
| 1 | **Arc — Best Agentic Economy with Nanopayments** | $3,250 (1st $2,150 / 2nd $1,100) | Ad impressions = gas-free nanopayments. Arc's own examples list "agent marketplaces with gas-free microtransactions" and "automated content monetization (~$0.01/item)." |
| 2 | **Unlink — Best Integration into a Major Open-Source App** | $2,500 | OpenCode is a major OSS app; we route its (new) payment flows through Unlink. See nuance below. |
| 3 | **Dynamic — Best Agentic Build** | $2,000 | Harness uses Dynamic server wallets + delegated access to auto-pay per impression via x402. |

**Max realistic upside if we sweep 1st/best:** ~$7,750.

### Per-track submission requirements (from the prize pages)
- **Arc:** functional frontend + backend, architecture diagram, video demo +
  presentation, GitHub/Replit repo.
- **Unlink (OSS-integration):** start from a real, widely-used OSS app; integrate
  `@unlink-xyz/sdk` *during the event* at the interface/SDK/module layer (no
  protocol redeploy); working demo showing the flow now private + short video;
  public repo + README linking the upstream project and stating exactly what is
  now private.
- **Dynamic (Agentic Build):** AI agent uses Dynamic **server wallets** to sign
  and execute onchain; uses any Dynamic SDK; deployed and usable by judges.
  Bonus: combines delegated access / signing policies / Flow; meaningful agent
  autonomy.

### Unlink track nuance (decide at booth)
The OSS-integration track is framed around privatizing an app's **existing**
money flows (their targets: wallets, Uniswap/Aave/Euler, Safe). OpenCode has no
native money flow — we're *adding* one. Defensible if pitched as "we added a
private payments layer to a major OSS dev tool," but the cleaner-fit alternative
is Unlink's **Best Overall Privacy App** ($1,500, explicitly "fork or no fork").
Same code; just pick the submission box. **Ask the Unlink team which they'd score
higher.**

### Stretch (post-MVP, NOT a 4th slot)
Arc's **Best Smart Contracts on Arc with Advanced Stablecoin Logic** ($3,250)
rewards conditional/escrow/multi-step settlement. Use it to *strengthen the Arc
nanopayments submission* (e.g. an on-chain escrow holding advertiser deposits
until impressions are proven) rather than as a separate track — we're capped at 3.

---

## 3. Architecture

```
   ┌─────────────────────────────────────────────────────────┐
   │  Terminal emulator (Ghostty / iTerm / any) — just a window │
   └─────────────────────────────────────────────────────────┘
                              │ renders
   ┌─────────────────────────────────────────────────────────┐
   │  Kickback AI = FORKED OpenCode (SolidJS TUI)              │
   │   • status-line ad slot (patched SolidJS component)       │
   │   • marketplace tab (new TUI surface)                     │
   │   • wallet onboarding on first open                       │
   │   • impression tracker (local)                            │
   │   • model: BYO (Claude / GPT / Gemini / local)            │
   └─────────────────────────────────────────────────────────┘
        │ wallet/sign            │ settle              │ privacy
   ┌──────────────┐      ┌─────────────────┐    ┌──────────────┐
   │ Dynamic      │      │ Arc testnet     │    │ Unlink        │
   │ embedded +   │      │ x402 batched    │    │ deposit/      │
   │ server wallet│      │ USDC micro-pay  │    │ transfer/     │
   │ + delegation │      │ (gas-free)      │    │ withdraw      │
   └──────────────┘      └─────────────────┘    └──────────────┘
```

**Money + privacy loop:** advertiser funds campaign (Dynamic wallet, Unlink
deposit) → marketplace picks top bid → harness shows ad + counts impressions →
Arc settles batched x402 micro-payments → 50% to developer's Dynamic wallet,
Unlink-encrypted → public explorer sees nothing; view key for audit.

---

## 4. The 6-step build plan (deep)

> Format per step: **Goal · What exists · What we build · Tasks · Key APIs ·
> Risks · Acceptance · Estimate**

### Step 1 — Fork OpenCode

- **Goal:** A locally-buildable fork we can add custom UI to (status-line ad slot
  + marketplace tab).
- **What exists:** OpenCode is open source and forking is an intended use
  (Xiaomi's MiMo Code is an MIT fork of it). Current build = TypeScript with a
  **SolidJS TUI**. Status bar is SolidJS-rendered with **no plugin status-line
  hook** (open feature requests confirm this) — which is exactly why we fork
  rather than plugin.
- **What we build:** nothing new yet — get the harness running from source so we
  own the two UI surfaces.
- **Tasks:**
  - [ ] Fork the current TS/SolidJS OpenCode repo; confirm exact license on the
        repo (permissive expected).
  - [ ] `bun install` / build; run our build instead of the published binary.
  - [ ] Locate the SolidJS status-bar / spinner component (where the ad will go).
  - [ ] Locate the TUI tab/pane system (where the marketplace tab will go).
  - [ ] Wire up a BYO model so the harness is usable end-to-end for the demo.
- **Risks:** unfamiliar codebase = debug surface is now ours. Mitigation: touch
  as few files as possible — one status-line component + one new tab.
- **Acceptance:** our forked binary runs, completes a coding task, and we can
  render arbitrary text into the status line from our own code.
- **Estimate:** 2–4 h (mostly orientation).

### Step 2 — Ad-viewership layer

- **Goal:** Render the auction-winning ad in the status line; count impressions.
- **What exists:** kickbacks.ai (reference only, not reusable). Its model:
  1 block = 1,000 five-second impressions; clicks worth 50× an impression;
  English ascending auction; 50% rev share; local HTTP server for impression
  tracking; auth token in OS keychain. Its module map (reference):
  `activation, activity, adapters, auth, consent, earnings, killswitch, metrics,
  portfolio, viewTracking, banner, extension`.
- **What we build:**
  - [ ] `banner` renderer in the SolidJS status line (text + clickable link).
  - [ ] `viewTracking`: count 5-second impressions locally; debounce; persist.
  - [ ] local state store the marketplace/settlement code can read (winning ad,
        accrued impressions, balance).
  - [ ] kill-switch / consent toggle (be a good citizen; lets judges turn it on).
- **Key APIs:** none external — pure harness code + local file/HTTP state.
- **Risks:** ad must not pollute the LLM context (keep it display-only, not in
  the prompt). Mitigation: render in the TUI layer, never inject into messages.
- **Acceptance:** a hard-coded ad shows in the spinner; impressions tick up and
  are queryable by other modules.
- **Estimate:** 3–5 h.

### Step 3 — Dynamic wallet (two wallet types, two jobs)

- **Goal:** (a) developer gets a wallet on first open; (b) per-impression
  payments sign autonomously with no popups.
- **What exists / verified:**
  - **Embedded wallet** (human onboarding): React/browser —
    `@dynamic-labs/sdk-react-core` (`DynamicContextProvider`, `DynamicWidget`) +
    `@dynamic-labs/ethereum` (`EthereumWalletConnectors`). Browser-based, so a TUI
    needs a **browser-handoff** (local server → onboarding page → token back →
    store in keychain).
  - **Server wallets + delegated access** (autonomous payments): headless,
    `@dynamic-labs-wallet/node-evm`. "Trigger transactions with no user prompts
    or front-end dependencies, on every EVM/SVM network." TSS-MPC keys.
  - **Custom EVM network:** add Arc testnet by passing an `evmNetworks` array via
    `overrides.evmNetworks` (use `mergeNetworks` from `@dynamic-labs/sdk-react-core`)
    with Arc's `chainId` + `rpcUrls` + `nativeCurrency`, or add it in the
    dashboard. Enable the chain in the dashboard first, then attach the wallet
    connector.
  - Docs MCP available at `https://www.dynamic.xyz/docs/mcp` (point Claude Code at
    it for live docs).
- **What we build:**
  - [ ] Onboarding: local HTTP route + browser page running the embedded-wallet
        SDK; on success, store session/token in OS keychain.
  - [ ] Server-wallet client for autonomous signing:
        `createDelegatedEvmWalletClient({ environmentId, apiKey })`.
  - [ ] Delegation flow: user approves delegation client-side once → Dynamic
        posts credentials to our webhook → server signs via
        `delegatedSignTransaction(client, { walletId, walletApiKey, keyShare, transaction })`
        (transaction = Viem `TransactionSerializable`).
  - [ ] Register Arc testnet as a custom EVM network.
- **Key APIs:** `createDelegatedEvmWalletClient`, `delegatedSignMessage`,
  `delegatedSignTransaction`, `DynamicContextProvider`, `mergeNetworks`.
- **Risks:** embedded SDK is browser-only (no DOM in TUI). Mitigation: the
  browser-handoff above (same pattern kickbacks uses). Need a webhook endpoint
  reachable during the demo for delegation.
- **Acceptance:** open the harness → wallet created in browser handoff → server
  can sign an Arc testnet tx on the user's behalf with no popup.
- **Estimate:** 5–7 h (delegation + handoff are the fiddly bits). **Satisfies the
  Dynamic Agentic Build track.**

### Step 4 — Integrate Unlink (NOT "deploy")

- **Goal:** Every payment moves privately through Unlink on Arc testnet.
- **What exists / verified:** `@unlink-xyz/sdk`. Tenant/Session model:
  `createTenant({ engineUrl, apiKey })` (process-wide) →
  `tenant.forUser({ account })` (per user) → `session.transfer({...})` /
  `deposit` / `withdraw` / `execute`. Documented **CLI / hackathon pattern**:
  single process, one Tenant + one Session holding both the tenant API key and
  the user's keys. Non-custodial option: `account.fromPublicIdentity({ address })`
  + a `signSigningRequest` callback. Hides counterparties, amounts, balances,
  token flows; view keys for compliance. Docs index: `docs.unlink.xyz/llms.txt`.
- **What we build:**
  - [ ] Stand up one Tenant + Session in the harness process.
  - [ ] Wrap advertiser deposits and developer payouts in `deposit`/`transfer`.
  - [ ] Generate a **view key** for the audit/compliance demo moment.
  - [ ] (Optional, later) `execute()` to touch public contracts privately.
- **Key APIs:** `createTenant`, `tenant.forUser`, `session.deposit/transfer/withdraw`.
- **Risks (BIGGEST IN THE BUILD):** Unlink engine may not be live on Arc testnet.
  Mitigation: **confirm at the booth first**; if not on Arc, ask them to deploy
  for the event, or fall back to a chain they support (Fuji is our day-job ask).
  Do NOT build on this until confirmed.
- **Acceptance:** one provably-private transfer on Arc (or fallback) visible in
  the app's private view but blank/meaningless on the public explorer.
- **Estimate:** 4–6 h *after* Arc support is confirmed. **Satisfies the Unlink
  OSS-integration track.**

### Step 5 — The marketplace (advertiser portal)

> SCOPING UPDATE (2026-06-13): DEFERRED to tomorrow (manual) — NOT in the overnight loop. Stack is
> **SolidStart** (new `packages/marketplace`), not Next.js. `/me` ships as a TUI tab + web mirror.
> Deploy target: Railway. See CLAUDE.md → FRONTEND section.

- **Goal:** Advertisers post/pay for ads; an auction decides who serves.
- **What exists:** nothing turnkey to reuse. kickbacks' economic model is the
  reference (blocks, ascending auction, 50% split).
- **What we build:**
  - [ ] Thin web app (**SolidStart**, new `packages/marketplace` — matches `packages/console/app`) = advertiser portal.
  - [ ] Advertiser login via Dynamic embedded wallet; deposit USDC via Unlink.
  - [ ] Buy "blocks" (1 block = 1,000 impressions), upload creative, set bid.
  - [ ] Ascending auction picks who serves the slot, when.
  - [ ] Marketplace **tab inside the forked harness** (your custom-UI win) mirrors
        portal state for the developer view.
- **Key APIs:** Dynamic (login/deposit), Unlink (private deposit), Arc (USDC).
  USDC testnet address from Circle docs.
- **Risks:** scope creep — keep the auction trivial (highest bid serves; first
  bid takes #1 instantly, like kickbacks). Mitigation: hard-code block size.
- **Acceptance:** an advertiser can deposit, post a creative, win the slot, and
  see it render in the harness. This is also the Arc track's required "functional
  frontend + backend + architecture diagram."
- **Estimate:** 6–9 h.

### Step 6 — Settlement & payouts ("money into their account")

- **Goal:** Impressions become real, private, gas-free payments to developers.
- **What exists:** Arc (USDC gas, sub-second finality, x402, Gateway, CCTP);
  Dynamic server wallets (autonomous signing); Unlink (private transfer).
- **What we build:**
  - [ ] Accrue impressions locally → batch them (don't settle one-by-one).
  - [ ] Settle batches on Arc via **x402** (gas-free USDC micro-settlement) —
        visibly many small payments, per the Arc rubric.
  - [ ] Route 50% to the developer's Dynamic wallet.
  - [ ] Wrap the payout in an **Unlink transfer** so amount/parties/graph stay
        private; expose the view key for the audit demo.
  - [ ] Show the side-by-side: public explorer (nothing leaks) vs in-app private
        view (real balances). This is what wins privacy tracks.
- **Key APIs:** x402 settlement on Arc, Dynamic delegated signing, Unlink transfer.
- **Risks:** x402 wiring + Arc testnet quirks. Mitigation: get a single
  end-to-end payment working before batching.
- **Acceptance:** N impressions → one batched Arc settlement → developer balance
  rises → public explorer shows nothing meaningful.
- **Estimate:** 6–8 h.

---

## 5. Critical path & suggested order

**Dependency order (do NOT parallelize blindly):**

1. **Booth: confirm Unlink on Arc testnet** (gates Step 4 & 6). Do this first.
2. Step 1 (fork) → unblocks everything UI.
3. Step 3 (Dynamic wallet, server-side first) → unblocks payments.
4. Step 6 (single end-to-end Arc payment) BEFORE Step 2/5 polish — prove the
   money moves before dressing it up.
5. Step 4 (wrap that payment in Unlink) once Arc-support confirmed.
6. Step 2 (ad render) + Step 5 (marketplace) — the visible surfaces.
7. Batching, view-key demo, architecture diagram, 2-min video.

**Rough 36h shape (2 devs):**
- H0–4: fork + orient + booth confirmations.
- H4–12: Dynamic server wallet + one raw Arc payment working.
- H12–20: Unlink wrap + ad render in status line.
- H20–30: marketplace portal + harness tab + batching.
- H30–36: privacy side-by-side demo, diagram, video, 3× READMEs, submit.

---

## 6. Friday/Saturday booth verification questions (TOP PRIORITY)

1. **Unlink:** Is your engine/contract live on **Arc testnet**? If not, can you
   deploy for the event, or which testnet should we target? *(Gates the whole
   privacy layer.)*
2. **Unlink:** For a dev tool like OpenCode, would you score the
   **OSS-integration** framing or the **Overall Privacy App** framing higher?
3. **OpenCode/general:** Confirm the status bar is still SolidJS-only with no
   plugin status-line hook (confirms the fork is necessary, scopes our edits).
4. **Arc:** Arc testnet `chainId`, RPC URL, and testnet USDC address; is x402 /
   Gateway live on the testnet judges will use?
5. **Dynamic:** Any gotchas adding Arc as a custom EVM network + sponsoring gas
   for server-wallet txns during the event?

---

## 7. Open risks register

| Risk | Severity | Mitigation |
|---|---|---|
| Unlink not on Arc testnet | **High** | Confirm at booth before building Step 4/6; fallback chain ready. |
| x402 / Arc testnet wiring quirks | Med | Get one raw payment working before batching. |
| Embedded wallet is browser-only in a TUI | Med | Browser-handoff onboarding; keychain token. |
| Scope creep on marketplace/auction | Med | Trivial auction (highest bid serves); hard-code block size. |
| Ad text leaking into LLM context | Low | Render display-only in TUI; never inject into prompts. |
| 3-slot cap | Low | Lock slate: Arc Nanopayments + Unlink OSS + Dynamic Agentic. Smart-contract escrow is a stretch that *strengthens* Arc, not a 4th slot. |

---

## 8. Key links

- Arc prize: ethglobal.com/events/newyork2026/prizes/arc
- Unlink prize: ethglobal.com/events/newyork2026/prizes/unlink · docs.unlink.xyz
- Dynamic prize: ethglobal.com/events/newyork2026/prizes/dynamic · dynamic.xyz/docs · docs MCP: dynamic.xyz/docs/mcp
- OpenCode: opencode.ai · opencode.ai/docs
- kickbacks.ai (reference only, proprietary): github.com/andrewmccalip/kickbacks.ai
- Circle/USDC contract addresses: developers.circle.com/stablecoins
