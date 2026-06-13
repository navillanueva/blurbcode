# Kickback AI — Dynamic & the "Everything in the TUI" Question

*Human-facing scoping doc, written 2026-06-13 (overnight). **NOT part of the loop's build
scope** — this is for your morning planning. Sources are listed at the bottom; verified against
live Dynamic docs (`dynamic.xyz/docs/llms.txt`) and the OpenCode repo.*

---

## TL;DR

1. The **developer revenue dashboard (`/me`)** is fine in the TUI — already a scoped task tonight
   (read-only display of mock/real state). ✅
2. A **human creating/logging into their own Dynamic embedded wallet** (email/social/passkey) is
   **browser-required** — you cannot do it in a bare terminal. This is the one true blocker.
3. But Dynamic has **three headless escape hatches** that need no browser at signing time:
   **server/agent wallets** (Node SDK), **Bring-Your-Own-Auth JWT**, and **delegated access**.
4. The **advertiser portal** (`/advertise`) is inherently web — external users, browser wallet,
   image upload. Don't fight that; keep it as the SolidStart app.
5. **The clever path (recommended): a `kickback-mcp` MCP server** that OpenCode connects to. It
   exposes the marketplace as conversational tools — fetch campaigns, place bids, deposit, see
   earnings, settle — backed by a **headless Dynamic server/agent wallet + Unlink + Arc x402**.
   This pulls "operate the marketplace" *into the harness with no browser*, and it's a textbook
   fit for Dynamic's **Best Agentic Build** prize.

---

## 1. Dynamic feature map (high level)

| Feature | What it does | Browser or headless? |
|---|---|---|
| **Embedded wallets (MPC/WaaS)** | Non-custodial wallet created for a user on login; key shares via TSS-MPC | **Browser** for consumer onboarding; **headless** for *server/agent* wallets (Node SDK) |
| **React SDK** (`@dynamic-labs/sdk-react-core`) | `DynamicContextProvider`, `DynamicWidget`, `DynamicConnectButton`, hooks | **Browser/DOM only** |
| **JavaScript SDK** | Framework-agnostic, `createDynamicClient()`, headless auth screens | Mostly browser; some headless ops |
| **Node.js / Python / Rust / Java SDKs** | Server-side EVM/SVM wallets; **agent wallets (API wallets)** for "automated, programmatic" use; "Machine Payments" pay-per-request | **Fully headless (server)** |
| **Auth — Email/SMS OTP** | One-time-code login | **Browser** (OTP entry modal) — *not possible without a UI* |
| **Auth — Passkeys** | WebAuthn device biometric | **Browser/device only** |
| **Auth — Bring-Your-Own-Auth (BYOA)** | Issue *your own* JWT, exchange it for a Dynamic session | **Headless** ✅ |
| **Auth — External JWT** | Sign users in with a JWT from your own provider | **Headless** ✅ |
| **Delegated access + webhook** | User approves delegation once → Dynamic POSTs credentials to *your* webhook → your server signs on their behalf afterward | One-time consent (browser) → then **headless** |
| **Custom EVM networks** | Add Arc via `mergeNetworks` / `evmNetworks` (Tier 2/3 raw-signing support) | Config (React) |
| **JWT sessions** | Verify Dynamic JWTs on your backend (`sub` = our Unlink `userId`) | **Headless** ✅ |
| **Docs MCP** | `https://www.dynamic.xyz/docs/mcp` — point the build agent at live Dynamic docs | n/a |

**One-line takeaway:** Dynamic cleanly splits **consumer-facing UI** (React/mobile, browser) from
**backend operations** (Node/Python/Rust/Java, headless). The money/agent side can be entirely
headless; only the *human's first wallet onboarding* wants a browser.

---

## 2. Deep dive — why the wallet UX can't be pure-TUI

A TUI (OpenTUI / OpenCode's terminal renderer) is a **terminal**: it draws cells of text. It has
**no DOM, no browser engine, no WebAuthn, no OAuth redirect handling, no iframe sandbox, no
`localStorage`, no `window.crypto` subtle-crypto UI**. Dynamic's embedded-wallet onboarding needs
several of exactly those:

- **`DynamicWidget` renders DOM** — it's a React component tree. Nothing renders it in a terminal.
- **Email/SMS OTP** needs a modal for the user to *enter the code* — confirmed unsupported headless
  ("Email OTP login without any browser = No").
- **Passkeys** trigger a **device biometric / WebAuthn** prompt — OS/browser only.
- **Social login** (Google/Apple/etc.) is an **OAuth redirect** round-trip through a browser.
- **MPC embedded wallet**: the *user's* key share is generated and held **client-side in browser
  crypto / an isolated iframe**. There's no terminal equivalent for that custody model.

So: **a human cannot create or log into their own non-custodial Dynamic embedded wallet from a bare
terminal.** That's a hard constraint of the embedded-wallet model, not a gap we can code around in
the TUI.

**What is NOT blocked (headless-capable):**
- **Server/agent wallets** — the *server* (or our MCP) holds MPC shares and signs autonomously via
  the Node SDK. No browser. (Dynamic literally markets these for "automated programmatic trading"
  and "machine payments.")
- **BYOA / external JWT** — we mint our own JWT and exchange it for a Dynamic session; no Dynamic UI.
- **Delegated access** — the user consents once (browser), then our server signs on their behalf
  indefinitely, headless.
- **JWT verification** — backend-only; this is what tonight's task 4 uses (Dynamic `sub` → Unlink
  `userId`).

---

## 3. "Everything in the TUI" — what it would take for the hackathon

Three ways to push more of the experience into the harness, with honest effort + tradeoffs:

### A. Browser-handoff onboarding (the kickbacks.ai pattern)
The TUI spins up a `localhost` page that runs `DynamicWidget`; the user logs in **once** in their
browser; the resulting JWT/session is handed back to the TUI and stored in the OS keychain. After
that, everything (dashboard, signing via the session) is TUI/headless.
- **Effort:** Moderate. **Custody:** non-custodial (user's own embedded wallet). **Cost:** one
  browser moment at first run. Already anticipated in `kickback-ai-build-plan.md` (Step 3).

### B. Headless server/agent wallet + delegated access
The agent signs autonomously via the Node SDK. Either (i) the user delegates once in a browser
(non-custodial), or (ii) you run a pure server/agent wallet (custodial-ish, simplest).
- **Effort:** Medium–high (delegation needs the hosted webhook + tunnel). **Payoff:** the strongest
  **Best Agentic Build** story — "the agent has its own wallet and pays per impression with no
  popups."

### C. Payer-EOA only (tonight's MVP)
Skip Dynamic's embedded UX for the money path entirely; a plain funded EOA signs (we have it: payer
`0x3AbE…`, 20 USDC). Dynamic is then used only for **identity** (sign-in → `userId`).
- **Effort:** Lowest, fully headless, **zero browser**. **Tradeoff:** the money movement isn't
  "Dynamic-powered" — weakens the Dynamic-prize narrative, but it's a guaranteed-working demo.

**Honest verdict:** You can't delete the human's *first-time* wallet onboarding from the browser
without **A (handoff)** or **BYOA**. But every *subsequent* action — bids, deposits, dashboard,
signing, settlement — **can be fully headless** via server/agent wallets. So "everything in the TUI"
is achievable for the **operate** phase; the only browser touch is an optional one-time login that
handoff (A) reduces to a single redirect.

---

## 4. The clever workaround — a Kickback MCP server (RECOMMENDED)

**OpenCode supports MCP servers** (confirmed in repo: `packages/app/src/context/mcp.ts`,
`dialog-select-mcp.tsx`; config key `mcp` with `type: "local" | "remote" | "http"`). So we can ship
a small MCP server that the harness — and the user *inside* the harness — calls by name.

### Shape
A `kickback-mcp` process (stdio/`local` MCP) that holds, **server-side and headless**:
- a **Dynamic Node.js agent/server wallet** (or, for the MVP, the payer EOA),
- the **Unlink** client (`@unlink-xyz/sdk/admin`),
- the **Circle Gateway x402** client.

It wraps the provider interfaces the loop already built tonight (`packages/kickback`) — mocks first,
real impls once wired.

### Tools it exposes (the conversational UI that replaces the browser)
- `kickback_status` → current ad, impressions today, balance, accrued earnings
- `list_campaigns` / `get_top_bid` → marketplace state
- `place_bid({ amountUsdc, creativeUrl, blocks })` → advertiser action
- `deposit({ amountUsdc })` / `withdraw({ amountUsdc })` → fund movement (Unlink/Gateway, private)
- `get_earnings` / `claim` → developer payout

### Flow
User types in OpenCode: *"show me the current ad bids"* or *"bid 2 USDC on the top slot with this
creative."* → the model calls the MCP tool → the MCP hits the backend and **signs via the Dynamic
server wallet** (headless) → returns a text table the TUI renders. **No browser, no
context-switch** — you operate the whole marketplace from inside the harness by talking to it.

### Why it's the right move
- **Sidesteps the browser-wallet blocker** for bids/deposits by using server-held keys (or delegated
  access for non-custodial).
- **Triple prize alignment:** Dynamic *Best Agentic Build* (an agent with its own wallet signing/
  executing onchain — exactly their rubric), Arc *nanopayments* (MCP triggers x402), Unlink (routes
  the payment privately).
- **Cheap to build:** an MCP server is a tiny Node process; the tools are thin wrappers over
  `packages/kickback`. Can demo against mocks immediately, then flip to real providers.

### Tradeoffs
- Server-held keys are **custodial** unless you add **Dynamic delegated access** (user delegates →
  server signs on their behalf = non-custodial). For the hackathon: ship custodial (payer EOA /
  server wallet) for a reliable demo; mention delegation as the non-custodial upgrade.
- The MCP is *not* a replacement for the web portal — it's complementary:
  - **MCP** = in-harness, agent/power-user UX + the agentic-prize centerpiece.
  - **SolidStart web portal** = external advertisers and judges who aren't in a terminal.
  - Both read the **same backend**.

---

## 5. Recommendation for tomorrow

1. Keep tonight's **payer-EOA money path** (task 4) as the proven, demo-safe core.
2. Build **`kickback-mcp`** wrapping `packages/kickback`, register it in OpenCode's `mcp` config, and
   demo *"operate the marketplace from inside the harness via chat."* ← strongest agentic story,
   pulls advertising + dashboard into the harness with **no browser**.
3. Keep the **SolidStart `/advertise` + `/me` web mirror** for external advertisers/judges (deferred).
4. **Stretch:** Dynamic **delegated access** to make the MCP signing non-custodial — the *Best
   Agentic Build* bonus. (Needs the hosted webhook + tunnel; see `sdk-and-env-reference.md`.)

---

## Sources

- Dynamic docs index — `https://www.dynamic.xyz/docs/llms.txt`
- Bring-Your-Own-Auth — `https://www.dynamic.xyz/docs/overview/authentication/bring-your-own-auth`
- JWT / tokens — `https://www.dynamic.xyz/docs/overview/authentication/tokens`
- Delegated access — `https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/delegated-access/overview`
- Webhooks setup — `https://www.dynamic.xyz/docs/overview/developer-dashboard/webhooks/setup`
- Custom networks — `https://www.dynamic.xyz/docs/react/chains/adding-custom-networks`
- Agent wallets recipe (headless) — `https://www.dynamic.xyz/docs/recipes/integrations/hyperliquid-agent-wallets`
- Node.js SDK — `https://www.dynamic.xyz/docs/javascript/reference/quickstart`
- Dynamic docs MCP (point the build agent here) — `https://www.dynamic.xyz/docs/mcp`
- OpenCode MCP support — `packages/app/src/context/mcp.ts`, `packages/app/src/components/dialog-select-mcp.tsx`, config `mcp` (`type: local | remote | http`)
