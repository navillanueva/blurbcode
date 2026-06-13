// Dynamic JWT verification for POST /api/auth/dynamic (the MVP-primary,
// non-custodial auth per CONTRACT.md).
//
// The frontend signs in with Dynamic's embedded wallet and posts the resulting
// JWT. We verify its signature against the Dynamic environment's JWKS and pull
// the wallet address out of `verified_credentials`. The backend never sees a
// private key — it just links the account to that address. The Dynamic server
// API key gates the integration (it must be configured to use the live JWKS
// path); the cryptographic check itself is the standard JWKS signature verify.
//
// Verification is dependency-injected (`key`) so tests can verify a locally
// signed JWT with no network — see test/helpers.ts.

import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey, type KeyLike } from "jose"

export interface DynamicIdentity {
  /** Dynamic JWT `sub` — the stable Dynamic user id. */
  sub: string
  /** Lower-cased EVM wallet address from the JWT's verified credentials. */
  address: string
  email?: string
}

export interface DynamicVerifier {
  verify(jwt: string): Promise<DynamicIdentity>
}

export interface DynamicVerifierOptions {
  environmentId?: string
  serverApiKey?: string
  /** Override the JWKS URL (rarely needed). */
  jwksUrl?: string
  /** Injected verification key — tests pass a local public key; prod omits it. */
  key?: KeyLike | Uint8Array | JWTVerifyGetKey
}

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i

/** Dynamic's per-environment JWKS endpoint. */
export function dynamicJwksUrl(environmentId: string): string {
  return `https://app.dynamic.xyz/api/v0/sdk/${environmentId}/.well-known/jwks`
}

/** Find the first valid EVM wallet address in a Dynamic JWT's verified credentials. */
export function extractWalletAddress(payload: JWTPayload): string | undefined {
  const creds = (payload as Record<string, unknown>)["verified_credentials"]
  if (!Array.isArray(creds)) return undefined
  for (const cred of creds) {
    if (cred && typeof cred === "object") {
      const addr = (cred as Record<string, unknown>)["address"]
      if (typeof addr === "string" && EVM_ADDRESS_RE.test(addr)) return addr.toLowerCase()
    }
  }
  return undefined
}

/**
 * Build a verifier from options. With an injected `key` it verifies offline
 * (tests). Otherwise it requires `environmentId` + `serverApiKey` and verifies
 * against Dynamic's remote JWKS. Construction is lazy/cheap; the remote JWKS is
 * fetched + cached by jose on first verify.
 */
export function createDynamicVerifier(opts: DynamicVerifierOptions): DynamicVerifier {
  // Resolve the key lazily so the server can boot (and the import-key fallback can
  // work) even when Dynamic isn't configured — the error surfaces only if someone
  // actually calls POST /api/auth/dynamic.
  let getKey: KeyLike | Uint8Array | JWTVerifyGetKey | undefined = opts.key
  function resolveKey(): KeyLike | Uint8Array | JWTVerifyGetKey {
    if (getKey) return getKey
    if (!opts.environmentId) throw new Error("DYNAMIC_ENVIRONMENT_ID is required to verify Dynamic JWTs")
    if (!opts.serverApiKey) throw new Error("DYNAMIC_SERVER_API_KEY is required to enable Dynamic auth")
    getKey = createRemoteJWKSet(new URL(opts.jwksUrl ?? dynamicJwksUrl(opts.environmentId)))
    return getKey
  }

  return {
    async verify(jwt: string): Promise<DynamicIdentity> {
      const key = resolveKey()
      // jose accepts a key, a Uint8Array, or a getter function as the 2nd arg.
      const { payload } = await jwtVerify(jwt, key as Parameters<typeof jwtVerify>[1])
      const sub = typeof payload.sub === "string" ? payload.sub : undefined
      if (!sub) throw new Error("Dynamic JWT is missing `sub`")
      const address = extractWalletAddress(payload)
      if (!address) throw new Error("Dynamic JWT has no verified EVM wallet address")
      const email = typeof payload["email"] === "string" ? (payload["email"] as string) : undefined
      return { sub, address, email }
    },
  }
}
