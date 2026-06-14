"use client"

import { useCallback, useEffect, useState } from "react"
import { DynamicWidget, useDynamicContext } from "@dynamic-labs/sdk-react-core"
import { isEthereumWallet } from "@dynamic-labs/ethereum"
import Link from "next/link"
import { createPublicClient, erc20Abi, http } from "viem"
import {
  createCampaign,
  fundCampaign,
  getTreasury,
  listCampaigns,
  type Campaign,
  type Treasury,
} from "@/lib/api"
import { ARC_RPC_URL, arcTestnet } from "@/lib/arc"
import { fromBaseUnits, toBaseUnits } from "@/lib/money"
import { useMe } from "@/lib/useMe"

const EMPTY = { advertiser: "", text: "", url: "", bid: "", budget: "" }

export default function AdvertisePage() {
  const { me, isLoggedIn } = useMe()
  const { primaryWallet } = useDynamicContext()
  const authed = isLoggedIn || me !== null

  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [fundingId, setFundingId] = useState<string | null>(null)

  // Treasury (where + how to pay) is authoritative for token + decimals — never
  // hardcode them. Until loaded, fall back to 6dp (mock/dev); the real backend
  // returns 18 for the arc-testnet pool token.
  const [treasury, setTreasury] = useState<Treasury | null>(null)
  const decimals = treasury?.decimals ?? 6

  const loadCampaigns = useCallback(async () => {
    try {
      setListError(null)
      setCampaigns(await listCampaigns())
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    getTreasury()
      .then(setTreasury)
      .catch(() => setTreasury(null))
  }, [])

  useEffect(() => {
    if (authed) void loadCampaigns()
  }, [authed, loadCampaigns])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setNotice(null)

    let bidBaseUnits: string
    let budgetBaseUnits: string
    try {
      // money.ts throws on malformed / over-precise amounts — fail before we POST.
      // Use the token's decimals so ledger amounts match the on-chain transfer.
      bidBaseUnits = toBaseUnits(form.bid, decimals).toString()
      budgetBaseUnits = toBaseUnits(form.budget, decimals).toString()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
      return
    }
    if (toBaseUnits(form.budget, decimals) <= 0n) {
      setFormError("Budget must be greater than 0.")
      return
    }

    setSubmitting(true)
    try {
      const { campaign } = await createCampaign({
        advertiser: form.advertiser.trim(),
        text: form.text.trim(),
        url: form.url.trim(),
        bidBaseUnits,
        budgetBaseUnits,
      })
      setNotice(`Campaign created (${campaign.id}). Fund it below to enter the auction.`)
      setForm(EMPTY)
      await loadCampaigns()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFund(c: Campaign) {
    setFundingId(c.id)
    setNotice(null)
    setListError(null)
    try {
      if (!treasury) throw new Error("Payment configuration unavailable — is the backend reachable?")
      if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
        throw new Error("Connect an EVM (Dynamic) wallet to pay the campaign budget on-chain.")
      }
      const amount = BigInt(c.budgetBaseUnits ?? "0")
      if (amount <= 0n) throw new Error("This campaign has no budget to fund.")

      const token = treasury.token as `0x${string}`
      const to = treasury.address as `0x${string}`
      const walletClient = await primaryWallet.getWalletClient(String(treasury.chainId))
      const sender = walletClient.account.address
      const publicClient = createPublicClient({ chain: arcTestnet, transport: http(ARC_RPC_URL) })

      // Pre-checks: enough token balance + some native gas (Arc gas = native USDC).
      const [bal, gas] = await Promise.all([
        publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [sender] }),
        publicClient.getBalance({ address: sender }),
      ])
      if (bal < amount) {
        throw new Error(
          `Insufficient balance: need ${fromBaseUnits(amount, decimals)} but the wallet holds ${fromBaseUnits(bal, decimals)}.`,
        )
      }
      if (gas === 0n) throw new Error("Wallet has no native gas on Arc. Top up from faucet.circle.com.")

      // 1) Public transfer of the budget to the treasury EOA (advertiser signs).
      setNotice("Confirm the USDC transfer to the treasury in your wallet…")
      const hash = await walletClient.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "transfer",
        args: [to, amount],
      })
      setNotice("Payment sent — waiting for on-chain confirmation…")
      await publicClient.waitForTransactionReceipt({ hash })

      // 2) Backend verifies that transfer, then privately deposits the budget into the pool.
      setNotice("Confirmed — shielding the budget into the private pool…")
      await fundCampaign(c.id, hash)

      setNotice(
        "Funded. Your transfer to the treasury is public on-chain; the deposit into the private pool — " +
          "and which developers your budget ends up paying — stays hidden via Unlink.",
      )
      await loadCampaigns()
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err))
    } finally {
      setFundingId(null)
    }
  }

  if (!authed) {
    return (
      <>
        <h1 className="page-title">Advertise to developers</h1>
        <p className="page-sub">Connect a wallet to create and fund a campaign.</p>
        <div className="card stack" style={{ maxWidth: 560, marginTop: 24 }}>
          <DynamicWidget />
          <p className="muted" style={{ fontSize: 14 }}>
            Prefer importing a key? Head to the{" "}
            <Link href="/wallet" style={{ color: "var(--accent-2)" }}>
              wallet page
            </Link>
            .
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="page-title">Advertise to developers</h1>
      <p className="page-sub">Create a campaign, fund it on Arc, and watch your spend in real time.</p>

      <section className="section" style={{ marginTop: 28 }}>
        <h2>New campaign</h2>
        <form className="form" onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="advertiser">Advertiser</label>
            <input
              id="advertiser"
              value={form.advertiser}
              onChange={(e) => set("advertiser", e.target.value)}
              placeholder="Acme Devtools"
              required
            />
            <span className="hint">Shown to developers as the sponsor.</span>
          </div>

          <div className="field">
            <label htmlFor="text">Ad copy</label>
            <textarea
              id="text"
              value={form.text}
              onChange={(e) => set("text", e.target.value)}
              placeholder="Ship faster with Acme — try it free."
              rows={2}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="url">Click-through URL</label>
            <input
              id="url"
              type="url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://acme.dev"
              required
            />
          </div>

          <div className="row-2">
            <div className="field">
              <label htmlFor="bid">Bid (USDC / 1,000 impressions)</label>
              <input
                id="bid"
                inputMode="decimal"
                value={form.bid}
                onChange={(e) => set("bid", e.target.value)}
                placeholder="2.50"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="budget">Total budget (USDC)</label>
              <input
                id="budget"
                inputMode="decimal"
                value={form.budget}
                onChange={(e) => set("budget", e.target.value)}
                placeholder="100"
                required
              />
            </div>
          </div>

          {formError ? <div className="banner error">{formError}</div> : null}
          {notice ? <div className="banner ok">{notice}</div> : null}

          <div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create campaign"}
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <h2>Your campaigns</h2>
        {listError ? <div className="banner error">{listError}</div> : null}
        {campaigns.length === 0 && !listError ? (
          <p className="muted">No campaigns yet. Create one above to get started.</p>
        ) : (
          <div className="stack">
            {campaigns.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                decimals={decimals}
                funding={fundingId === c.id}
                onFund={() => handleFund(c)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function CampaignRow({
  campaign,
  decimals,
  funding,
  onFund,
}: {
  campaign: Campaign
  decimals: number
  funding: boolean
  onFund: () => void
}) {
  const remaining = campaign.budgetRemainingBaseUnits
  const spent = campaign.spentBaseUnits
  let pct: number | null = null
  if (remaining !== undefined && spent !== undefined) {
    const total = BigInt(remaining) + BigInt(spent)
    pct = total > 0n ? Number((BigInt(spent) * 100n) / total) : 0
  }
  const fundable = !campaign.status || campaign.status === "pending" || campaign.status === "draft"

  return (
    <div className="campaign">
      <div className="campaign-head">
        <div>
          <strong>{campaign.advertiser || "Untitled"}</strong>{" "}
          {campaign.status ? <span className="badge">{campaign.status}</span> : null}
          <div className="ad-text">{campaign.text}</div>
          <a href={campaign.url} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 13 }}>
            {campaign.url}
          </a>
        </div>
        {/* Disabled once funded — a campaign funds once; re-paying an active one
            would transfer again while the backend treats it as already funded. */}
        <button className="btn btn-sm" onClick={onFund} disabled={funding || !fundable}>
          {funding ? "Funding…" : fundable ? "Fund" : "Funded"}
        </button>
      </div>

      <div className="inline" style={{ marginTop: 12, gap: 24 }}>
        <span className="muted" style={{ fontSize: 13 }}>
          Bid: <span className="mono">{fromBaseUnits(BigInt(campaign.bidBaseUnits), decimals)} USDC</span> / 1k
        </span>
        {remaining !== undefined ? (
          <span className="muted" style={{ fontSize: 13 }}>
            Remaining: <span className="mono">{fromBaseUnits(BigInt(remaining), decimals)} USDC</span>
          </span>
        ) : null}
        {spent !== undefined ? (
          <span className="muted" style={{ fontSize: 13 }}>
            Spent: <span className="mono">{fromBaseUnits(BigInt(spent), decimals)} USDC</span>
          </span>
        ) : null}
      </div>

      {pct !== null ? (
        <div className="bar">
          <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      ) : null}
    </div>
  )
}
