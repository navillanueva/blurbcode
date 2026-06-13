"use client"

import { useState } from "react"
import { DynamicWidget, useDynamicContext } from "@dynamic-labs/sdk-react-core"
import { privateKeyToAccount } from "viem/accounts"
import { authImport, createDeviceToken, withdraw } from "@/lib/api"
import { fromBaseUnits } from "@/lib/money"
import { useMe } from "@/lib/useMe"
import { CopyButton } from "@/components/CopyButton"

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/

export default function WalletPage() {
  const { me, error: meError, refresh, isLoggedIn } = useMe()
  const { primaryWallet } = useDynamicContext()
  const authed = isLoggedIn || me !== null
  const address = me?.address ?? primaryWallet?.address ?? null

  return (
    <>
      <h1 className="page-title">Your wallet</h1>
      <p className="page-sub">Create or connect a wallet, link the TUI, and withdraw your earnings.</p>

      {/* 1. Connect / create */}
      <section className="section" style={{ marginTop: 28 }}>
        <h2>Connect or create</h2>
        <div className="card stack" style={{ maxWidth: 560 }}>
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            Sign in with social or email — Dynamic creates a non-custodial embedded wallet. Your key never leaves your
            control; we only learn the address.
          </p>
          <DynamicWidget />
          <ImportKeyFallback onLinked={refresh} />
        </div>
      </section>

      {/* 2. Account */}
      <section className="section">
        <h2>Account</h2>
        {meError ? <div className="banner error">Couldn’t load your account: {meError}</div> : null}
        {address ? (
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Wallet address</div>
              <div className="stat-value" style={{ fontSize: 14 }}>
                {address}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Balance</div>
              <div className="stat-value">
                {me ? `${fromBaseUnits(BigInt(me.balanceBaseUnits))} USDC` : "—"}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Role</div>
              <div className="stat-value" style={{ fontSize: 16 }}>
                {me?.role ?? "—"}
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">Connect a wallet above to see your address, balance, and earnings.</p>
        )}
      </section>

      {/* 3. Device token */}
      <section className="section">
        <h2>Link the TUI</h2>
        <div className="card stack">
          {authed ? (
            <DeviceTokenPanel />
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Connect a wallet first to generate a device token.
            </p>
          )}
        </div>
      </section>

      {/* 4. Withdraw */}
      <section className="section">
        <h2>Withdraw earnings</h2>
        <div className="card stack" style={{ maxWidth: 560 }}>
          {authed ? (
            <WithdrawPanel onDone={refresh} />
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Connect a wallet first to withdraw.
            </p>
          )}
        </div>
      </section>
    </>
  )
}

function ImportKeyFallback({ onLinked }: { onLinked: () => void }) {
  const [key, setKey] = useState("")
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  let derived: string | null = null
  if (PRIVATE_KEY_RE.test(key.trim())) {
    try {
      derived = privateKeyToAccount(key.trim() as `0x${string}`).address
    } catch {
      derived = null
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    const trimmed = key.trim()
    if (!PRIVATE_KEY_RE.test(trimmed)) {
      setError("That doesn’t look like a 0x-prefixed 64-char private key.")
      return
    }
    setImporting(true)
    try {
      const res = await authImport(trimmed)
      setOk(`Imported and linked ${res.address}.`)
      setKey("")
      onLinked()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <details className="fallback">
      <summary>Advanced: import a private key instead (custodial fallback)</summary>
      <form className="stack" onSubmit={submit}>
        <div className="banner warn" style={{ fontSize: 13 }}>
          Importing a key is <strong>custodial</strong> — the backend stores it encrypted to sign on your behalf. Prefer
          the non-custodial Dynamic flow above when you can.
        </div>
        <div className="field">
          <label htmlFor="pk">Private key</label>
          <input
            id="pk"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="0x…"
            autoComplete="off"
          />
          {derived ? (
            <span className="hint mono">→ {derived}</span>
          ) : (
            <span className="hint">0x-prefixed, 64 hex characters.</span>
          )}
        </div>
        {error ? <div className="banner error">{error}</div> : null}
        {ok ? <div className="banner ok">{ok}</div> : null}
        <div>
          <button type="submit" className="btn btn-sm" disabled={importing}>
            {importing ? "Importing…" : "Import key"}
          </button>
        </div>
      </form>
    </details>
  )
}

function DeviceTokenPanel() {
  const [token, setToken] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setError(null)
    setGenerating(true)
    try {
      const res = await createDeviceToken()
      setToken(res.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Generate a one-time device token, then paste it into the OpenCode TUI to link this account to your machine.
      </p>

      {token ? (
        <>
          <div className="token-box">
            <input readOnly value={token} onFocus={(e) => e.currentTarget.select()} />
            <CopyButton value={token} label="Copy token" />
          </div>
          <div>
            <p className="muted" style={{ fontSize: 13, margin: "4px 0 8px" }}>
              In the OpenCode TUI, run:
            </p>
            <div className="codeblock">
              <span className="prompt">/wallet</span>
              {"\n"}# paste the token above when prompted
            </div>
          </div>
          <div>
            <button className="btn btn-sm btn-ghost" onClick={generate} disabled={generating}>
              {generating ? "Generating…" : "Generate a new token"}
            </button>
          </div>
        </>
      ) : (
        <div>
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            {generating ? "Generating…" : "Generate device token"}
          </button>
        </div>
      )}

      {error ? <div className="banner error">{error}</div> : null}
    </>
  )
}

function WithdrawPanel({ onDone }: { onDone: () => void }) {
  const [withdrawing, setWithdrawing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setError(null)
    setMsg(null)
    setWithdrawing(true)
    try {
      const res = await withdraw()
      setMsg(res.tx_ref ? `Withdrawal submitted (ref ${res.tx_ref}).` : "Withdrawal submitted.")
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Settle accrued earnings to your wallet via Circle Gateway + a private Unlink transfer on Arc.
      </p>
      {error ? <div className="banner error">{error}</div> : null}
      {msg ? <div className="banner ok">{msg}</div> : null}
      <div>
        <button className="btn btn-primary" onClick={go} disabled={withdrawing}>
          {withdrawing ? "Withdrawing…" : "Withdraw"}
        </button>
      </div>
    </>
  )
}
