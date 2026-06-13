// At-rest encryption for the custodial import fallback (POST /api/auth/import).
// The raw private key is encrypted with AES-256-GCM under a key derived from
// TOKEN_SIGNING_SECRET, so the DB never stores plaintext keys. Format is
// `<iv>.<authTag>.<ciphertext>` (all base64url). Dynamic auth is non-custodial
// and never calls this.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest()
}

/** Encrypt a UTF-8 secret. Returns `<iv>.<tag>.<ciphertext>` (base64url). */
export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".")
}

/** Decrypt a blob produced by `encryptSecret`. Throws if tampered/invalid. */
export function decryptSecret(blob: string, secret: string): string {
  const [ivB64, tagB64, dataB64] = blob.split(".")
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("malformed encrypted secret")
  const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), Buffer.from(ivB64, "base64url"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8")
}
