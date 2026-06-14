// World ID 4.0 personhood verification for the verify-human gate (plans/plan-5).
//
// v4 flow (the app is a managed RP — see get_app_config: engine "cloud", rp_id
// rp_2f11…, action a v4 action). Two server responsibilities:
//   1. rp-context signing — the IDKit widget refuses to open without a signed
//      rp_context. We sign {nonce, createdAt, expiresAt, action} with the RP signing
//      key (signRequest), and hand the widget {rp_id, nonce, created_at, expires_at,
//      signature}. The key NEVER leaves the server.
//   2. proof verification — the widget posts its IDKitResult back; we forward it
//      AS-IS to `${base}/api/v4/verify/${rpId}`. A 200 with {success:true} means the
//      proof is valid; the response's top-level `nullifier` is the RP-scoped
//      uniqueness key we bind in the DB (repo.bindWorldId). We never log proof material.
//
// Verification is dependency-injected (`fetchImpl`) so tests stub it with no network.

import { signRequest } from "@worldcoin/idkit-server"

/** The signed rp-context the IDKit widget needs to open (shape = idkit `RpContext`). */
export interface RpContext {
  rp_id: string
  nonce: string
  created_at: number
  expires_at: number
  signature: string
}

export interface WorldIdVerifier {
  /** Forward the IDKit result to the v4 verify endpoint; resolve to the bound nullifier, throw on failure. */
  verify(idkitResponse: unknown): Promise<{ nullifierHash: string }>
}

export interface WorldIdVerifierOptions {
  /** Registered RP id (e.g. rp_2f11…) — the v4 verify path segment. */
  rpId: string
  /** Override the v4 cloud verify base URL. */
  verifyUrl?: string
  /** Injected fetch — tests pass a stub; prod omits it (uses global fetch). */
  fetchImpl?: typeof fetch
}

const DEFAULT_VERIFY_BASE = "https://developer.world.org"

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined
}

/**
 * Carries the World cloud-verify failure REASON — its `code`/`detail` (e.g.
 * "max_verifications_reached", "invalid_proof", "invalid_merkle_root") — which are
 * safe diagnostic fields, never proof material.
 */
export class WorldIdVerifyError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    readonly detail?: string,
  ) {
    super(`World ID verification failed (HTTP ${status}${code ? `: ${code}` : ""})`)
    this.name = "WorldIdVerifyError"
  }
}

/**
 * Sign a fresh rp-context for the IDKit widget. `action` MUST match the widget's
 * `action` (it's hashed into the signed message) and the registered v4 action.
 */
export function signRpContext(opts: { rpId: string; action: string; signingKey: string }): RpContext {
  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex: opts.signingKey, action: opts.action })
  return { rp_id: opts.rpId, nonce, created_at: createdAt, expires_at: expiresAt, signature: sig }
}

/**
 * Build a v4 verifier. `verify(idkitResponse)` forwards the IDKit result to
 * `${base}/api/v4/verify/${rpId}` (with `allow_legacy_proofs` so orbLegacy v3 proofs
 * are accepted during migration). On `{success:true}` it returns the response's
 * top-level `nullifier`; otherwise it throws a WorldIdVerifyError with World's code.
 */
export function createWorldIdVerifier(opts: WorldIdVerifierOptions): WorldIdVerifier {
  const base = opts.verifyUrl ?? DEFAULT_VERIFY_BASE
  const fetchImpl = opts.fetchImpl ?? fetch

  return {
    async verify(idkitResponse: unknown): Promise<{ nullifierHash: string }> {
      const url = `${base}/api/v4/verify/${opts.rpId}`
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Forward the IDKit result as-is + opt into legacy (v3) proofs for orbLegacy.
        body: JSON.stringify({ ...(idkitResponse as Record<string, unknown>), allow_legacy_proofs: true }),
      })

      // Extract ONLY safe fields (success/nullifier/code/detail) — never log the body.
      let body: Record<string, unknown> = {}
      try {
        body = (await res.json()) as Record<string, unknown>
      } catch {
        /* non-JSON body — treat as failure below */
      }
      if (res.status !== 200 || body["success"] !== true) {
        throw new WorldIdVerifyError(res.status, asString(body["code"]), asString(body["detail"]))
      }
      const nullifierHash = asString(body["nullifier"])
      if (!nullifierHash) throw new WorldIdVerifyError(res.status, "missing_nullifier")
      return { nullifierHash }
    },
  }
}
