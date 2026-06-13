// Device tokens — opaque bearer credentials issued by the web app and pasted
// into the TUI (CONTRACT: POST /api/device-tokens). Stored in `device_tokens`
// and validated by lookup, so they can be revoked. The token carries no data;
// it's a random 24-byte value, base64url-encoded with a recognizable prefix.

import { randomBytes, randomUUID } from "node:crypto"

const DEVICE_TOKEN_PREFIX = "vc_dt_"

/** Generate a fresh, unguessable device token. */
export function generateDeviceToken(): string {
  return DEVICE_TOKEN_PREFIX + randomBytes(24).toString("base64url")
}

/** A new opaque primary-key id (accounts, campaigns, impressions, settlements). */
export function newId(): string {
  return randomUUID()
}
