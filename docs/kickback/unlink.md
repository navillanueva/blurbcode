# Track: Unlink (privacy)

Unlink holds the developer's ad earnings as a **private** USDC balance on Arc testnet. The point is
unlinkability: the developer's payout shouldn't be trivially correlatable to their identity or to the
advertiser's spend. In Kickback AI, Unlink is the `PrivacyProvider`.

## What it does in Kickback AI

- Registers the developer's private Unlink account on `arc-testnet`.
- Reports the settled private USDC balance shown in the `/me` revenue view.
- Receives the developer's 50% share (`transfer`), and can `withdraw` to a public EOA later.
- Offers a private testnet faucet (`requestPrivateTokens`) so the balance is non-zero for demos.

Privacy hygiene (from the reference tutorial): avoid a same-size deposit+withdraw in one flow — keep
a larger private balance and withdraw smaller amounts later, so amount/timing don't correlate.

## Where the code lives

- **Interface:** [`packages/kickback/src/privacy.ts`](../../packages/kickback/src/privacy.ts) —
  `ensureRegistered` / `getBalances` / `requestFaucet` / `transfer` / `withdraw`. Amounts are base
  units (`bigint`).
- **Real impl:** [`packages/kickback/src/real/privacy.ts`](../../packages/kickback/src/real/privacy.ts)
  — adapts `@unlink-xyz/sdk` to the interface.
- **Mock impl:** [`packages/kickback/src/mock/privacy.ts`](../../packages/kickback/src/mock/privacy.ts)
  — in-memory balances, faucet credits 1 USDC (`1_000_000n`) by default, deterministic, offline.
- **Consumed by the `/me` view:** [`packages/tui/src/kickback/revenue.ts`](../../packages/tui/src/kickback/revenue.ts)
  (`getDemoPrivateBalance` seeds a mock account via the faucet — in-memory, never a live call).

## SDK surface (verified against the installed canary types — `@unlink-xyz/sdk@0.3.0-canary.552`)

We import the framework-agnostic `@unlink-xyz/sdk/client` entry (not `/browser`) because the adapter
runs in the TUI's Bun process, not a browser — both entries export the same `createUnlinkClient` +
`account`.

```ts
import { account, createUnlinkClient } from "@unlink-xyz/sdk/client"

const client = createUnlinkClient({ environment | engineUrl, account: account.fromMnemonic({ mnemonic }) })
await client.ensureRegistered()
await client.faucet.requestPrivateTokens({ token })   // private testnet faucet
await client.balanceOf(tokenAddress)                  // base-unit decimal string | null
await client.transfer({ recipientAddress, token, amount })   // amount in base units ("1000000" = 1 USDC)
await client.withdraw({ recipientEvmAddress, token, amount })
```

The backend/admin surface (`@unlink-xyz/sdk/admin` — `createUnlinkAdmin`, `createUnlinkAuthRoutes`
behind a Dynamic JWT) is not used in the headless MVP; it belongs to the deferred web marketplace.

## How the factory degrades to the mock

[`factory.ts`](../../packages/kickback/src/factory.ts) constructs the **real** privacy provider only
when **all** of the following hold; otherwise it uses the mock and pushes a note:

- `UNLINK_MNEMONIC` is set (the private account credential).
- `ARC_USDC_ADDRESS` is set (the token whose balance is reported).
- `UNLINK_ENGINE_URL` is set — because `arc-testnet` is **not** a built-in environment in canary
  `.552`, and `createUnlinkClient` resolves the engine URL eagerly, so an unknown `environment` with
  no `engineUrl` throws at construction.

If real construction still throws, it's caught and reported as a note (`real Unlink client failed to
init …; using mock`) — so a genuine failure is never mistaken for an intentional mock.

## TODO(human) — blockers

- **Unlink Arc environment.** `arc-testnet` is not in canary `.552`'s built-in `ENVIRONMENTS` map.
  Either (a) set `UNLINK_ENGINE_URL` to a **verified** Arc Engine URL (get it from Unlink
  docs/Telegram — do not fabricate one), or (b) re-pin to a build where Arc is registered (the
  reference uses `.598`) once it ages past the repo's 3-day `minimumReleaseAge` policy in
  `bunfig.toml`, then reinstall.
- **Unlink account credential.** No `UNLINK_MNEMONIC` in `.env` — the private account is normally
  derived from the Dynamic embedded wallet (browser, deferred). Add a mnemonic (or wire the browser
  handoff) to take privacy live.

## References

- Docs: `docs.unlink.xyz` · index `docs.unlink.xyz/llms.txt`
- Reference tutorial (our exact stack): `docs.unlink.xyz/partner-integrations`
- Env vars: see [`.env.example`](../../.env.example) (`UNLINK_*`).
