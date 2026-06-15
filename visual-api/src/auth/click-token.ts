// Click attribution tokens. GET /api/click/:campaignId is unauthenticated (it's a
// browser navigation opened from the TUI, not a bearer fetch), so the dev it should
// credit travels in a signed token minted at /api/ad/serve time. The token binds
// (accountId, campaignId) under TOKEN_SIGNING_SECRET — HMAC-SHA256, the same
// stateless pattern as session.ts. It carries no secret and grants nothing beyond
// "attribute a click for this campaign to this dev", so leaking it only lets someone
// attribute clicks (bounded by the per-window click cap), never move money.

import { createHmac, timingSafeEqual } from "node:crypto"

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url")
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

/** Mint a click token binding `accountId` (the dev) to `campaignId`. */
export function signClickToken(accountId: string, campaignId: string, secret: string): string {
  const payload = `${accountId}:${campaignId}`
  return `${b64url(payload)}.${sign(payload, secret)}`
}

export interface ClickClaim {
  accountId: string
  campaignId: string
}

/** Verify a click token (constant-time). Returns the bound claim, or null if the
 *  token is missing, malformed, or its signature doesn't match. */
export function verifyClickToken(token: string | undefined, secret: string): ClickClaim | null {
  if (!token) return null
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return null
  const encoded = token.slice(0, dot)
  const provided = token.slice(dot + 1)
  let payload: string
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8")
  } catch {
    return null
  }
  const expected = sign(payload, secret)
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const sep = payload.indexOf(":")
  if (sep <= 0 || sep === payload.length - 1) return null
  return { accountId: payload.slice(0, sep), campaignId: payload.slice(sep + 1) }
}
