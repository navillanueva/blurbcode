"use client"

import { useState } from "react"
import { IDKitRequestWidget, orbLegacy, type IDKitResult, type RpContext } from "@worldcoin/idkit"
import { getWorldRpContext, verifyHuman } from "@/lib/api"
import { Check, Shield, WarningTriangle } from "@/components/Icons"

// World ID 4.0. The app is a managed RP, so the widget can't open without a signed
// rp_context — we fetch one from our backend (POST /api/me/world-rp-context, which
// signs with the RP key server-side), then open IDKitRequestWidget. orbLegacy +
// allow_legacy_proofs accept Orb (v3) proofs during migration. On success the IDKit
// result is forwarded to the backend, which verifies it against /api/v4/verify and
// binds the nullifier. app_id is public (ships to the browser).
const APP_ID = process.env.NEXT_PUBLIC_WORLD_ID_APP_ID ?? ""
// Must match the registered v4 action AND the backend's WORLD_ID_ACTION (it's hashed
// into the rp-context signature, so a mismatch fails verification).
const ACTION = process.env.NEXT_PUBLIC_WORLD_ID_ACTION ?? "blurbcode-account"

function messageFor(error: string | undefined): string {
  switch (error) {
    case "already_linked":
      return "This World ID is already linked to another account."
    case "worldid_not_configured":
      return "World ID isn't configured on the server yet. Try again later."
    case "verification_failed":
      return "We couldn't verify that proof. Please try again."
    default:
      return "Verification failed. Please try again."
  }
}

/**
 * World ID 4.0 verification button. Clicking fetches a signed rp_context, then opens
 * the IDKit widget; the proof is verified server-side and the nullifier bound to the
 * account. Backend rejections (esp. 409 already_linked) surface as friendly copy. If
 * the app id is unset we render a disabled note rather than crash.
 */
export function VerifyHuman({ copy, onVerified }: { copy: string; onVerified: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [rpContext, setRpContext] = useState<RpContext | null>(null)
  const [loading, setLoading] = useState(false)
  const configured = APP_ID.length > 0

  if (!configured) {
    return (
      <div className="banner" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-flex", flexShrink: 0, color: "var(--g-600)" }}>
          <WarningTriangle size={15} />
        </span>
        <span>Human verification is unavailable — World ID isn&apos;t configured for this site yet.</span>
      </div>
    )
  }

  // Fetch a fresh signed rp_context, then open the widget. The widget can't render
  // without rp_context, so we only mount it once we have one.
  async function start() {
    setError(null)
    setLoading(true)
    try {
      const ctx = await getWorldRpContext()
      setRpContext(ctx)
      setOpen(true)
    } catch {
      setError("Couldn't start verification. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Runs after the World App returns a proof. Forward it to the backend; throwing
  // makes IDKit show an error instead of success, and we mirror the reason.
  async function handleVerify(result: IDKitResult) {
    setError(null)
    const res = await verifyHuman({ rp_id: rpContext!.rp_id, idkitResponse: result })
    if (!res.ok) {
      const msg = messageFor(res.error)
      setError(msg)
      throw new Error(msg) // stop IDKit's success screen
    }
  }

  return (
    <div className="card card--18" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ color: "var(--indigo)", display: "inline-flex" }}>
          <Shield size={18} strokeWidth={1.5} />
        </span>
        <h3 className="display" style={{ fontSize: 16, margin: 0 }}>
          Verify you&apos;re human
        </h3>
      </div>
      <p style={{ fontSize: 13.5, color: "var(--g-650)", margin: "0 0 16px", lineHeight: 1.5 }}>
        {copy} One human, one account — proven privately with World ID.
      </p>

      {error ? (
        <div className="banner banner--error" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ display: "inline-flex", flexShrink: 0 }}>
            <WarningTriangle size={15} />
          </span>
          <span>{error}</span>
        </div>
      ) : null}

      <button type="button" className="btn btn--ink btn--block btn--48" onClick={start} disabled={loading}>
        <Check size={16} strokeWidth={2.4} /> {loading ? "Starting…" : "Verify with World ID"}
      </button>

      {rpContext ? (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={APP_ID as `app_${string}`}
          action={ACTION}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          preset={orbLegacy()}
          handleVerify={handleVerify}
          onSuccess={() => onVerified()}
          onError={() => setError("Verification was cancelled or failed.")}
        />
      ) : null}
    </div>
  )
}
