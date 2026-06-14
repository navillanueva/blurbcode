<p align="center">
  <a href="https://blurbcode.xyz">
    <img src="brand/cover.png" alt="BlurbCode — get paid while your agent works, you keep half" width="640">
  </a>
</p>

<p align="center"><b>Get paid while your agent works — you keep half.</b></p>

<p align="center">
  A privacy-preserving, crypto-native ad marketplace built into an AI coding agent.
  <br>
  <a href="https://blurbcode.xyz">blurbcode.xyz</a>
</p>

---

## What is BlurbCode?

While your AI coding agent is thinking, its terminal status line is dead space. **BlurbCode turns that wait-state line into an ad slot — and pays you for it.**

Advertisers fund campaigns, the ad renders on the agent's throbber line while it works, and you — the developer running the agent — earn **50% of every impression**. Payments settle on-chain but stay **private**: no observer can link who paid whom.

BlurbCode is a fork of [OpenCode](https://github.com/anomalyco/opencode) with a money loop bolted onto the wait state. The ad is purely a display-layer artifact — **its text never enters the LLM context** — so it never influences your agent.

## How it works

1. **Advertiser funds a campaign** on `/advertise`, paying a budget in USDC from a [Dynamic](https://dynamic.xyz) wallet.
2. **The ad renders in the TUI** status/throbber line while your agent runs.
3. **Impressions accrue** (5-second view tracking) and the backend ledger does the **50/50 split** off-chain.
4. **You withdraw your earnings** from the `/me` dashboard.

The whole loop is gated by **World ID** personhood — one human, one payout account — so it can't be Sybil-farmed across a hundred terminals.

## Privacy: why Unlink

With targeted advertising, *who an advertiser pays* is commercially sensitive — a transparent chain would leak both the advertiser's go-to-market (which developer segments they buy) and the developer's stack (which advertisers they earn from).

Money flows **advertiser → treasury → shared [Unlink](https://unlink.xyz) shielded pool → developer**. An observer can see that *an* advertiser funded the platform and that *a* developer was paid by it, but **cannot link the two**. Both counterparties in each ad deal stay hidden — that's the product.

## Tech stack

| Layer | Tech |
| --- | --- |
| Agent / TUI | [OpenCode](https://github.com/anomalyco/opencode) (MIT fork) |
| Wallets & auth | [Dynamic](https://dynamic.xyz) |
| Personhood / anti-Sybil | [World ID](https://world.org) |
| Settlement | [Circle Gateway](https://www.circle.com) x402 nanopayments on **Arc** |
| Privacy | [Unlink](https://unlink.xyz) shielded pool |
| Backend | Hono + Postgres (Drizzle) |
| Frontend | Next.js |

## Repo layout

| Path | What it is |
| --- | --- |
| `packages/` | The agent — a forked OpenCode TUI + server that renders the ad slot |
| `visual-web/` | Next.js frontend: `/advertise`, `/wallet`, and the `/me` earnings dashboard |
| `visual-api/` | Hono + Postgres backend: auction, ad serving, ledger, and private settlement |
| `brand/` | BlurbCode brand assets (logo, cover) |
| `ETH Global AI Plans/` | The planning + AI-orchestration docs used to build the project |

## Installation

```bash
# Get the BlurbCode agent
curl -fsSL https://blurbcode.xyz/install | bash
```

This installs the `blurbcode` command. Once it's on your `PATH`, run `blurbcode` in any project to start the agent — and start earning while it works.

### Agents

BlurbCode keeps OpenCode's two built-in agents, switchable with the `Tab` key:

- **build** — default, full-access agent for development work
- **plan** — read-only agent for analysis and code exploration

A **general** subagent is also available for complex searches and multistep tasks, invoked with `@general` in messages.

## Built on OpenCode

BlurbCode is an independent fork of [OpenCode](https://github.com/anomalyco/opencode) (MIT) and is **not built by or affiliated with the OpenCode team**. All of OpenCode's agent, TUI, and server functionality is preserved; BlurbCode adds the ad slot, the marketplace, and the private settlement layer on top. The original MIT license is retained in [`LICENSE`](./LICENSE).

Built at ETHGlobal. 💙
