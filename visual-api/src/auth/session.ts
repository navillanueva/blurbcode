// Signed session cookies for the web routes. The cookie value is
// `<accountId>.<hmac>`, HMAC-SHA256 over the accountId with TOKEN_SIGNING_SECRET.
// Stateless: no server-side session store. Verification is constant-time.

import { createHmac, timingSafeEqual } from "node:crypto"

export const SESSION_COOKIE = "vc_session"

function sign(accountId: string, secret: string): string {
  return createHmac("sha256", secret).update(accountId).digest("base64url")
}

/** Produce a signed session cookie value for an account. */
export function signSession(accountId: string, secret: string): string {
  return `${accountId}.${sign(accountId, secret)}`
}

/** Verify a session cookie value, returning the accountId or null if invalid. */
export function verifySession(value: string | undefined, secret: string): string | null {
  if (!value) return null
  const dot = value.lastIndexOf(".")
  if (dot <= 0) return null
  const accountId = value.slice(0, dot)
  const provided = value.slice(dot + 1)
  const expected = sign(accountId, secret)
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? accountId : null
}
