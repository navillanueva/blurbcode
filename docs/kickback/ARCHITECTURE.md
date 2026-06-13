# Kickback AI — architecture

End-to-end: an advertiser buys the status-line slot; the developer's harness renders the ad and
counts impressions; earnings accrue from local counters; settlement moves USDC via Circle Gateway
x402; the developer's share lands in a private Unlink balance; the `/me` view shows it all.

```mermaid
flowchart TD
    subgraph web["Web marketplace (DEFERRED — built manually tomorrow)"]
        ADV["Advertiser"] -->|"buy blocks (1 block = 1,000 impressions),<br/>upload creative, set bid"| AUCTION["Ascending auction<br/>(highest bid serves)"]
    end

    AUCTION -->|"winning Ad<br/>(text, url, blockBidBaseUnits)"| STORE["adStore<br/>(packages/tui/src/kickback/ad-store.ts)<br/>local state — DISPLAY ONLY,<br/>never enters LLM context"]

    subgraph tui["TUI display layer (packages/tui/src/kickback)"]
        STORE --> SLOT["AdSlot (ad-slot.tsx)<br/>status-line ad + clickable ↗"]
        SLOT -->|"5s interval"| VT["viewTracking (view-tracking.ts)<br/>≤1 impression / 5s window"]
        VT -->|"recordImpression()"| STORE
        SLOT -->|"click → recordClick() + open(url)"| STORE
        STORE -->|"developerEarnings()<br/>impressions + clicks×50,<br/>scaled by bid, 50% share"| EARN["accrued earnings<br/>(USDC base units)"]
    end

    EARN --> ME["/me revenue dialog<br/>(component/dialog-me.tsx + revenue.ts)<br/>ad · impressions · clicks · earnings · private balance"]

    subgraph providers["@kickback-ai/providers (real OR mock per factory.ts)"]
        SETTLE["SettlementProvider<br/>Circle Gateway x402<br/>real/settlement.ts"]
        PRIV["PrivacyProvider<br/>Unlink (arc-testnet)<br/>real/privacy.ts"]
        WALLET["WalletProvider<br/>Dynamic identity / payer EOA<br/>real/wallet.ts"]
    end

    EARN -.->|"settle 50% share"| SETTLE
    SETTLE -->|"deposit(decimal) → pay(x402 url)<br/>on Arc testnet (5042002)"| ARC["Arc testnet<br/>USDC settlement"]
    ARC -->|"developer share"| PRIV
    PRIV -->|"getBalances()<br/>private USDC balance"| ME
    WALLET -->|"JWT sub = Unlink userId,<br/>payer EOA = Gateway payer"| PRIV
    WALLET --> SETTLE

    classDef deferred stroke-dasharray: 5 5;
    class web deferred;
```

## Reading the diagram

- **Solid arrows** are wired tonight (mock-backed, offline-deterministic). **Dashed** = deferred
  (the web marketplace, and the live on-chain settlement edge gated behind the single smoke test).
- **`adStore` is the seam.** The TUI subscribes for display; the settlement provider reads the same
  snapshot to settle the 50% payout. Ad text is display-only and never enters the LLM context
  (CLAUDE.md golden rule #4).
- **Real-vs-mock is decided per provider** by [`factory.ts`](../../packages/kickback/src/factory.ts)
  from `.env`; every fallback is surfaced as a note (see each track doc).
- **The decimal boundary** is [`money.ts`](../../packages/kickback/src/money.ts): Gateway deposits
  are decimal strings, Unlink amounts are base units, conversions go through `toBaseUnits` /
  `fromBaseUnits`.

## Economic model (values from the kickbacks.ai reference — `ad-store.ts`)

- `IMPRESSIONS_PER_BLOCK = 1000` — one purchased block = 1,000 counted 5-second impressions.
- `CLICK_MULTIPLIER = 50` — a click is worth 50 impression-equivalents.
- **Developer share = 50%** (`DEV_SHARE_NUMERATOR/DENOMINATOR = 1/2`).
- `developerEarnings = ((impressions + clicks × 50) × blockBid / 1000) × 1/2`, integer division
  (floors visibly — never silently rounds money up).
