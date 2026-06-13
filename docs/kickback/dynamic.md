# Track: Dynamic (wallet identity)

Dynamic provides wallet-based identity. In the full flow, the developer signs in with Dynamic, and
the Dynamic JWT's `sub` claim becomes the **Unlink `userId`** — tying the private earnings account to
a verifiable identity without exposing a raw key. In Kickback AI, Dynamic is the `WalletProvider`.

## What it does in Kickback AI

- Produces the `WalletSession` (`{ userId, address, jwt? }`) consumed by the rest of the stack.
- `userId` (the Dynamic JWT `sub`) is reused verbatim as the Unlink `userId` once browser sign-in
  lands.
- `address` is the plain payer EOA used by the Circle Gateway settlement track.

## Headless MVP status (honest about what's real)

Interactive Dynamic browser sign-in + server-side JWT verification are **deferred** — embedded-wallet
onboarding needs a real browser session (see CLAUDE.md "Do not attempt tonight"). So the MVP's
`RealWalletProvider`:

- performs **no** interactive auth and imports **no** Dynamic SDK;
- surfaces the real payer EOA address plus whatever Dynamic identity env already provides;
- falls back to the **payer address as the `userId`** when `DYNAMIC_USER_ID` is unset (the factory
  records a note: `no DYNAMIC_USER_ID; using payer address as userId until Dynamic sign-in lands`).

When the browser sign-in is built, it populates the exact same `WalletSession` shape — no downstream
changes needed.

## Where the code lives

- **Interface:** [`packages/kickback/src/wallet.ts`](../../packages/kickback/src/wallet.ts) —
  `signIn` / `getSession` / `signOut`; session = `{ userId, address, jwt? }`.
- **Real impl:** [`packages/kickback/src/real/wallet.ts`](../../packages/kickback/src/real/wallet.ts)
  — EOA-backed; carries the `TODO(human)` for real sign-in.
- **Mock impl:** [`packages/kickback/src/mock/wallet.ts`](../../packages/kickback/src/mock/wallet.ts)
  — a fixed deterministic session, offline.

## SDK surface (deferred — for reference only)

The real browser onboarding (not wired tonight) uses:

- `@dynamic-labs/sdk-react-core` (`DynamicContextProvider`, `DynamicWidget`, `mergeNetworks`) +
  `@dynamic-labs/ethereum` (`EthereumWalletConnectors`) — browser-only, so a TUI needs a
  local-server handoff.
- Autonomous signing (`@dynamic-labs-wallet/node-evm`, delegated access) is **prize polish, not
  MVP** — it needs a hosted delegation webhook + tunnel.

These signatures are **not** verified against installed types (the packages aren't installed); treat
the above as a pointer to `dynamic.xyz/docs`, not as a contract.

## How the factory degrades to the mock

[`factory.ts`](../../packages/kickback/src/factory.ts) uses the **real** wallet whenever a valid
`PAYER_ADDRESS` (+ `PAYER_PRIVATE_KEY`) is present; otherwise it logs `no valid PAYER_ADDRESS/
PAYER_PRIVATE_KEY; using mock wallet`. The `userId` is `DYNAMIC_USER_ID` when set, else the payer
address (with a note).

## TODO(human) — blockers

- **Dynamic sign-in.** Wire real `@dynamic-labs/sdk-react-core` browser sign-in + server-side JWT
  verification (uses `DYNAMIC_SERVER_API_KEY`) so the JWT `sub` becomes the Unlink `userId`.
- **Browser embedded-wallet handoff.** Needs a real browser session + a local-server bridge from the
  TUI — deferred.
- **Delegated access + webhook.** Prize polish for "Best Agentic Build"; needs a hosted webhook +
  tunnel. MVP uses Dynamic sign-in + a payer EOA instead.

## References

- Docs: `dynamic.xyz/docs` · Docs MCP: `https://www.dynamic.xyz/docs/mcp`
- Keys: `app.dynamic.xyz` → Developer tab (Environment ID = public; Server API token = `dyn_…`,
  shown once). Enable Arc under `app.dynamic.xyz/dashboard/chains-and-networks#evm`.
- Env vars: see [`.env.example`](../../.env.example) (`DYNAMIC_*`).
