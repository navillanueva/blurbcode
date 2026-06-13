# Kickback AI — Overnight Build Progress

Autonomous loop status. One task per iteration. See `CLAUDE.md` → "Scope for tonight".

## Tonight scope

- [x] **1. Fork & build** — clone OpenCode, `bun install`, run dev TUI, render arbitrary
      text into the status line. *(fork already present; install + status-line render done)*
- [x] **2. Provider interfaces + mocks** — `WalletProvider`, `SettlementProvider`,
      `PrivacyProvider`, each with a mock impl; unit-test the mocks. *(new package
      `@kickback-ai/providers`; 25 tests pass, typecheck clean)*
- [x] **3. Ad layer** — status-line ad renderer (text + clickable link) from local state;
      `viewTracking` (5s impressions); local state store. Display-only. *(new `src/kickback`
      modules; 17 tests pass, TUI typecheck clean; mounted in the real `home_footer` slot)*
- [x] **4. REAL integration** — Unlink (`@unlink-xyz/sdk`) + Circle Gateway x402
      (`@circle-fin/x402-batching`) + Dynamic sign-in. *(real impls of all 3 providers
      against VERIFIED SDK signatures + env config + real/mock factory; 37 tests pass,
      typecheck clean. Live smoke deferred — blocked on a seller x402 URL + Unlink Arc
      env; read-only smoke harness shipped. See Task-4 section + TODO(human).)*
- [x] **5. Developer revenue TUI tab (`/me`)** — built as a `/me` overlay **dialog**
      (mirrors `DialogStatus`) so it needs ZERO routing/navigation surgery — the
      feasibility gate's actual concern. Shows served ad, impressions, clicks, accrued
      earnings, and a settled private balance, read from `adStore` + the mock
      `PrivacyProvider`. Display-only. *(7 new tests; 24 `test/kickback/` pass, TUI
      typecheck clean.)*
- [x] **6. Docs & demo scaffolding** — `.env.example` (done) + new `docs/kickback/`:
      index, three per-track READMEs (Unlink / Circle Gateway / Dynamic), mermaid
      `ARCHITECTURE.md`, `DEMO_SCRIPT.md`. Every claim grounded in code + `.env.example`;
      no fabricated values. *(prose only — no build/typecheck needed.)*

**✅ ALL TONIGHT-SCOPE TASKS COMPLETE.**

## Done

### Task 1 — Fork & build ✅ (iteration 1)
- **Fork:** the repo at this path IS the `anomalyco/opencode` fork (git remote + commit
  history confirm). No re-clone needed.
- **Install:** populated `node_modules` (4588 packages, clean). `bun.lock` / `package.json`
  left untouched (verified `git status`).
- **Status-line surface located:** `packages/tui/src/routes/session/footer.tsx` is the
  SolidJS footer/status bar (OpenTUI). The spinner lives at
  `packages/tui/src/component/spinner.tsx`. This footer is where the ad slot goes.
- **Arbitrary-text render:** added `KICKBACK_AD_SLOT` constant + a `<text>` element in the
  footer between `directory()` and the status box. Renders text we control, display-only,
  never enters the LLM context. This is the Task-3 anchor for the real ad renderer.
- **Verified:** `bun turbo typecheck --filter=@opencode-ai/tui` → 1 successful, exit 0.
  (Interactive TUI not launched — headless loop env; typecheck confirms the SolidJS
  component compiles. Visual confirmation deferred to a human run.)

### Task 2 — Provider interfaces + mocks ✅ (iteration 2)
- **New package:** `packages/kickback` (`@kickback-ai/providers`, private). Pure TS,
  no Effect — plain promise-based interfaces so both the TUI display layer and the
  future backend can consume them. Picked up by the `packages/*` workspace glob.
- **Interfaces** (`src/`): `WalletProvider` (Dynamic: `signIn`/`getSession`/`signOut`,
  session = `{ userId=JWT sub, address=payer EOA, jwt? }`), `PrivacyProvider` (Unlink:
  `ensureRegistered`/`getBalances`/`requestFaucet`/`transfer`/`withdraw`, amounts in
  base units), `SettlementProvider` (Circle Gateway x402: `deposit(decimal)`/
  `getDepositedBalance`/`pay(url)→receipt`). Shared `money.ts` = the single
  decimal↔base-unit boundary (`toBaseUnits`/`fromBaseUnits`, `USDC_DECIMALS=6`,
  `Token` type). Interfaces are OUR abstraction — real SDK signatures NOT fabricated;
  the real impls (Task 4) adapt the SDKs to these.
- **Mocks** (`src/mock/`): in-memory, deterministic, offline. `MockWalletProvider`
  (fixed session), `MockPrivacyProvider` (Map balances, faucet credits, transfer/
  withdraw debit + log, throws on unregistered/insufficient), `MockSettlementProvider`
  (decimal deposit→base units, per-resource prices, deterministic `mock-x402-N`
  references, throws on insufficient deposit). `MOCK_USDC` token uses an obvious
  placeholder address — real Arc USDC address still loaded from `.env` later.
- **Verified:** `cd packages/kickback && bun test` → **25 pass, 0 fail**;
  `bun turbo typecheck --filter=@kickback-ai/providers` → **1 successful, exit 0**
  (also `tsgo --noEmit` exit 0). Tests use relative `../src` imports so no workspace
  link/reinstall is needed.

### Task 3 — Ad layer ✅ (iteration 3)
- **New TUI modules** (`packages/tui/src/kickback/`), framework-agnostic so the future
  SolidStart marketplace can subscribe to the same instance:
  - `ad-store.ts` — pure, fs-free, SolidJS-free local state store (the "store the
    marketplace/settlement code reads"): `Ad` type, `createAdStore()` + `adStore`
    singleton seeded with a clearly-placeholder `SAMPLE_AD` (`example.com`, no fabricated
    campaign). Holds the served ad, impression/click counters, consent kill-switch, and a
    DERIVED `developerEarningsBaseUnits` (bigint, USDC base units). Economic model from the
    kickbacks.ai reference (values only, no code): `IMPRESSIONS_PER_BLOCK=1000`,
    `CLICK_MULTIPLIER=50`, 50% dev share — `developerEarnings()` floors visibly.
  - `view-tracking.ts` — `startViewTracking(store, {intervalMs, timers})`; the fixed 5s
    interval IS the debounce (≤1 impression/window). Timers injectable for deterministic tests.
  - `ad-slot.tsx` — SolidJS `<AdSlot/>`: subscribes to `adStore`, starts/stops tracking on
    mount/cleanup, renders marker + ad text + a clickable `↗` (inlined click handler records
    the click for earnings AND opens the URL via `open`). Consent off / empty slot → renders
    nothing. **Display-only — never enters the LLM context.**
- **⚠️ Task-1 anchor was DEAD CODE.** `routes/session/footer.tsx` (`Footer`) is not imported
  or rendered anywhere — the LIVE status line is the `home_footer` plugin slot
  (`feature-plugins/home/footer.tsx`, rendered at `routes/home.tsx:91`). Fixed by mounting
  `<AdSlot/>` in the real `home_footer` slot (centered, between two spacers). Also replaced the
  orphan `KICKBACK_AD_SLOT` placeholder in the dead `footer.tsx` with `<AdSlot/>` (+ a comment
  noting it is unrendered) so the component stays correct if ever revived.
- **Verified:** `cd packages/tui && bun test test/kickback/` → **17 pass, 0 fail**;
  `bun turbo typecheck --filter=@opencode-ai/tui` → **1 successful, exit 0**. Interactive TUI
  NOT launched (headless loop) — visual confirmation of the rendered slot deferred to a human run.
- **Easy follow-up (not done, ~1 line):** drop the same `<AdSlot/>` into the `sidebar_footer`
  slot (`feature-plugins/sidebar/footer.tsx`, session view) so the ad shows during sessions too.
  Routes are exclusive (home XOR session) so the single `adStore` won't double-count.

### Task 4 — REAL integration ✅ (iteration 4)
- **Approach:** verified every SDK signature against the **installed `.d.ts`** (golden
  rule 1) before writing a line — the reference summary was slightly off (e.g.
  `createUnlinkClient` takes `{ environment, account }`, NOT a `userId` field). Deps
  added to `packages/kickback` and installed via `bun x bun@1.3.14 install`:
  `@unlink-xyz/sdk@0.3.0-canary.552`, `@circle-fin/x402-batching@3.0.4`, `viem@^2.21.0`.
  (`.598` from the reference is blocked by the repo's 3-day `minimumReleaseAge` policy in
  `bunfig.toml`; `.552` is the newest eligible build in the same `0.3.0-canary` line.)
- **`src/config.ts`** — the single `process.env` boundary. `readKickbackEnv(env)` →
  `{ arc?, payer?, dynamic, unlink }`, validating hex address / 32-byte key shapes and
  building the Arc USDC `Token` from `ARC_USDC_ADDRESS` (never hardcoded). Secrets never logged.
- **`src/real/`** — real impls, each adapting a vendor SDK to a Task-2 interface, config
  injected (no env reads inside):
  - `RealSettlementProvider` → `@circle-fin/x402-batching` `GatewayClient({ chain:"arcTestnet",
    privateKey, rpcUrl })`; `deposit(decimal)` / `getDepositedBalance()` = `getBalances().gateway.available`
    / `pay(url)` → `{ amount (bigint base units), reference: tx }`.
  - `RealPrivacyProvider` → `@unlink-xyz/sdk/client` (the framework-agnostic entry, not
    `/browser` — we run in Bun, not a browser; both export the same `createUnlinkClient`+`account`).
    `ensureRegistered` / `balanceOf` / `faucet.requestPrivateTokens` / `transfer` / `withdraw`,
    amounts as base-unit strings. `unlinkAccountFromMnemonic()` helper.
  - `RealWalletProvider` → EOA-backed session (payer address + Dynamic `userId`/`jwt` from
    env). No Dynamic SDK import; interactive browser sign-in + JWT verify are deferred (TODO).
- **`src/factory.ts`** — `createProviders(env)` picks REAL or MOCK per provider and returns
  `{ providers, live:{wallet,privacy,settlement}, notes[] }`. Missing/unreachable config NEVER
  throws — it degrades to the mock and pushes a human-readable note, so degraded state is
  observable (golden rule: never fake a working integration; mock + surface why).
- **Verified:** `bun test` in `packages/kickback` → **37 pass, 0 fail** (12 new: config
  parsing + factory real/mock selection; the factory test constructs a REAL `GatewayClient`
  offline). `bun turbo typecheck --filter=@kickback-ai/providers` → **1 successful** (now
  also covers `scripts/` + `test/`; dropped vestigial `rootDir`/`outDir` since the package is
  consumed as source). TUI typecheck still green. `@kickback-ai/providers` now registered in
  `bun.lock` (turbo "workspace not found" warning cleared).
- **Live smoke NOT run (correct, not skipped):** an end-to-end `fund→pay` needs a real Arc
  x402 **seller URL**, which we don't have — so the test isn't reachable regardless. Shipped
  `packages/kickback/scripts/smoke.ts`: READ-ONLY by default (prints live/mock + notes +
  Gateway balance); fund movement is hard-gated behind `KICKBACK_SMOKE_CONFIRM=1` + an explicit
  `--pay <url>`. This is the harness for the single allowed live test (golden rule 5).

### Task 5 — Developer revenue TUI tab (`/me`) ✅ (iteration 5)
- **Feasibility decision (the gate):** the OpenTUI route system (`context/route.tsx`) is a
  3-variant union (`home`/`session`/`plugin`) switched in `app.tsx`. Adding a real route
  `type` would touch the union, `initialRoute()`, AND the `Switch`/`Match` — i.e. navigation
  surgery, which the task says to AVOID. The established contained-view pattern is a
  full-screen overlay **dialog** (`DialogStatus`, `DialogHelp`), registered as ONE entry in
  `app.tsx`'s `appCommands`. Chose that → clean/moderate, no routing changes.
- **New files (TUI package):**
  - `src/kickback/revenue.ts` — pure view-model adapter. `buildRevenueView(adState,
    privateBalanceBaseUnits)` → render-ready strings (earnings/balance formatted via the
    shared `fromBaseUnits`, the single decimal boundary — not re-implemented). `readPrivateBalance`
    pulls a token balance off any `PrivacyProvider`; `getDemoPrivateBalance()` lazily seeds a
    process-wide mock Unlink account via the faucet (in-memory, NOT a live call) so the view
    shows a non-zero *settled* balance offline. Exercises `@kickback-ai/providers/mock` exactly
    as the build plan asks.
  - `src/component/dialog-me.tsx` — `DialogMe`: subscribes to `adStore`, fetches the demo
    private balance on mount, renders served ad (clickable `↗` records a click + opens the URL),
    impressions/clicks, accrued earnings (50% share), private balance, and a consent/provenance
    line. Mirrors `DialogStatus` layout. **Display-only — never enters the LLM context.**
- **Wiring (2 lines in `app.tsx`):** import `DialogMe` + one `appCommands` entry
  `{ name:"kickback.me", slashName:"me", run: () => dialog.replace(() => <DialogMe/>) }`.
  Reachable via `/me` and the command palette; no default keybind added (kept minimal — not in
  `appBindingCommands`).
- **Dependency:** added `@kickback-ai/providers: workspace:*` to `packages/tui/package.json`
  (normal monorepo wiring — the TUI display layer now consumes the providers). Linked via
  `bun x bun@1.3.14 install` → symlink at `packages/tui/node_modules/@kickback-ai/providers`;
  lockfile updated (the tui→kickback workspace edge), no other install changes.
- **Verified:** `cd packages/tui && bun test test/kickback/` → **24 pass, 0 fail** (7 new in
  `revenue.test.ts`); `bun turbo typecheck --filter=@opencode-ai/tui` → **1 successful, exit 0**
  (transitively validates the cross-package import). Interactive TUI not launched (headless loop)
  — visual confirmation of the rendered `/me` dialog deferred to a human run.
- **Easy follow-up (not done):** the `/me` *web* mirror stays deferred to tomorrow's SolidStart
  app (per CLAUDE.md FRONTEND); it can reuse `buildRevenueView` since both read the same model.

### Task 6 — Docs & demo scaffolding ✅ (iteration 6)
- **New directory `docs/kickback/`** (kept out of the repo root so it doesn't collide with the
  `README.*.md` translation files):
  - `README.md` — index: the three tracks table, where the code lives, decimal discipline, config.
  - `unlink.md` / `circle-gateway.md` / `dynamic.md` — one per integration track. Each covers: what
    the integration does in Kickback AI, exact code paths (`src/real/*`, `src/mock/*`, interfaces),
    the VERIFIED SDK surface (Unlink canary `.552`, x402-batching `3.0.4`; Dynamic flagged as
    deferred/unverified since its packages aren't installed), how `factory.ts` degrades to the mock
    (quoting the real fallback-note strings), and the per-track `TODO(human)` blockers from this file.
  - `ARCHITECTURE.md` — fenced ```mermaid flowchart: advertiser → auction → `adStore` → `AdSlot` →
    `viewTracking` impressions → earnings → settlement (Circle Gateway x402 on Arc) → private Unlink
    balance → `/me`. Deferred edges dashed. Plus the economic-model formula from `ad-store.ts`.
  - `DEMO_SCRIPT.md` — judge walkthrough: `bun dev .`, status-line ad, `/me` dialog, the three tracks,
    `scripts/smoke.ts` (read-only) for real-vs-mock honesty, and the single gated live test + what it
    still needs (TODO(human)).
- **No fabricated values:** chain `5042002`, RPC, explorer, decimals, package versions, SDK method
  signatures, `factory.ts` note strings, the `/me` slash command, `bun dev` launch — all cross-checked
  against the actual source files + `.env.example` + `sdk-and-env-reference.md` this iteration.
- **Verified:** prose only — no build/typecheck required (per the resume note). Mermaid uses `<br/>`
  line breaks (GitHub-renderer-safe) and standard `flowchart`/`subgraph` syntax.

## Skipped / deferred (per CLAUDE.md)

- All frontend surfaces (SolidStart `/advertise`, `/me` web + TUI revenue tab) — tomorrow, manual.
- Dynamic embedded-wallet browser onboarding + delegated-access webhook — needs a browser/tunnel.
- Faucet farming / repeated live txns.

## TODO(human) — REAL integration (Task 4) blockers

- **Unlink Arc environment.** `arc-testnet` is NOT in `@unlink-xyz/sdk@0.3.0-canary.552`'s
  built-in `ENVIRONMENTS` map (only base/monad/ethereum). `createUnlinkClient` resolves the
  engine URL eagerly, so passing `environment:"arc-testnet"` with no `engineUrl` THROWS at
  construction. Two fixes: (a) set `UNLINK_ENGINE_URL` to a **verified** Arc Engine URL — I
  must not fabricate one; get it from Unlink docs/Telegram; or (b) re-pin to `.598`+ (the
  reference's build, which presumably registers Arc) once it ages past the 3-day
  `minimumReleaseAge` (≈2026-06-13/14) and reinstall. Until then `RealPrivacyProvider` is
  constructed only when `UNLINK_ENGINE_URL` is set; otherwise the factory uses mock + notes why.
- **Unlink account credential.** No `UNLINK_MNEMONIC` in `.env` — the user's private Unlink
  account is normally derived from the Dynamic embedded wallet (browser, deferred). Add a
  mnemonic (or wire the browser handoff) to take privacy live.
- **Dynamic sign-in.** `RealWalletProvider` is EOA-backed (payer address + optional
  `DYNAMIC_USER_ID`). Wire real `@dynamic-labs/sdk-react-core` browser sign-in + server-side
  JWT verification (uses `DYNAMIC_SERVER_API_KEY`) so the JWT `sub` becomes the Unlink userId.
- **x402 seller URL.** The single allowed live smoke (`scripts/smoke.ts --deposit … --pay …`)
  needs a real Arc x402-protected seller resource URL. None known yet.
- **x402 runtime peer.** `@x402/core@2.14.0` resolved into the bun store; confirm `@x402/evm`
  is present (peer of `@circle-fin/x402-batching`) before the live `pay()` smoke — `GatewayClient`
  constructs fine offline, but `pay()` may load it lazily.

## TODO(human) — earlier blockers & infra

- **⚠️ TOOLCHAIN: bun version.** The repo pins `bun@1.3.14` (`package.json` →
  `packageManager`) and uses object-form `workspaces.catalog`. The machine's global bun is
  **1.2.7**, which CANNOT resolve the `catalog:` protocol — a plain `bun install` fails with
  `<pkg>@catalog: failed to resolve` for every catalog dep. **Workaround used:**
  `bun x bun@1.3.14 install --frozen-lockfile` (ephemeral, does not touch global bun). For a
  permanent fix, run `bun upgrade --to 1.3.14` (global) — left to human since it changes the
  global toolchain. `node_modules` is now populated, so most iterations won't need to reinstall.
- ✅ RESOLVED — Arc USDC ERC-20 address: `.env` + `.env.example` both carry
  `0x3600000000000000000000000000000000000000` (matches CLAUDE.md golden rule 7). The real
  `Token.address` is loaded from `ARC_USDC_ADDRESS` (never hardcoded); the mock still uses
  `0xMOCKUSDC`. (Still worth a final human glance on `testnet.arcscan.app`.)
- ✅ RESOLVED — `@kickback-ai/providers` is now registered in `bun.lock` (Task-4 install via
  `bun x bun@1.3.14 install`); the turbo `Workspace not found in lockfile` warning is gone.

## Next command to resume

**Tonight scope is COMPLETE (all 6 tasks).** Nothing left for the overnight loop to build. The
remaining work is the human-only items already catalogued above:

- **Unblock the live integration** (TODO(human) — Task 4): verified Unlink Arc engine URL (or an
  Arc-registered SDK build), `UNLINK_MNEMONIC`, real Dynamic browser sign-in, a real x402 seller URL.
- **Run the single allowed live smoke** once those land:
  `KICKBACK_SMOKE_CONFIRM=1 bun packages/kickback/scripts/smoke.ts --deposit 0.10 --pay <real-x402-url>`.
- **Build the deferred frontend tomorrow** (manual, NOT the loop): SolidStart `packages/marketplace`
  with `/advertise` + the `/me` web mirror (can reuse `buildRevenueView`). See CLAUDE.md FRONTEND.

Demo + per-track docs now live in `docs/kickback/` (start at `docs/kickback/README.md`).
