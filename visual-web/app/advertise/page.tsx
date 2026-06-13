"use client"

import { useCallback, useEffect, useState } from "react"
import { DynamicWidget } from "@dynamic-labs/sdk-react-core"
import Link from "next/link"
import {
  createCampaign,
  fundCampaign,
  listCampaigns,
  type Campaign,
} from "@/lib/api"
import { fromBaseUnits, toBaseUnits } from "@/lib/money"
import { useMe } from "@/lib/useMe"

const EMPTY = { advertiser: "", text: "", url: "", bid: "", budget: "" }

export default function AdvertisePage() {
  const { me, isLoggedIn } = useMe()
  const authed = isLoggedIn || me !== null

  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [fundingId, setFundingId] = useState<string | null>(null)

  const loadCampaigns = useCallback(async () => {
    try {
      setListError(null)
      setCampaigns(await listCampaigns())
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e))
    }
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
      bidBaseUnits = toBaseUnits(form.bid).toString()
      budgetBaseUnits = toBaseUnits(form.budget).toString()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
      return
    }
    if (toBaseUnits(form.budget) <= 0n) {
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

  async function handleFund(id: string) {
    setFundingId(id)
    setNotice(null)
    try {
      await fundCampaign(id)
      setNotice(`Campaign ${id} funded — the on-chain private deposit is in flight.`)
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
                funding={fundingId === c.id}
                onFund={() => handleFund(c.id)}
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
  funding,
  onFund,
}: {
  campaign: Campaign
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
        <button className="btn btn-sm" onClick={onFund} disabled={funding}>
          {funding ? "Funding…" : fundable ? "Fund" : "Re-fund"}
        </button>
      </div>

      <div className="inline" style={{ marginTop: 12, gap: 24 }}>
        <span className="muted" style={{ fontSize: 13 }}>
          Bid: <span className="mono">{fromBaseUnits(BigInt(campaign.bidBaseUnits))} USDC</span> / 1k
        </span>
        {remaining !== undefined ? (
          <span className="muted" style={{ fontSize: 13 }}>
            Remaining: <span className="mono">{fromBaseUnits(BigInt(remaining))} USDC</span>
          </span>
        ) : null}
        {spent !== undefined ? (
          <span className="muted" style={{ fontSize: 13 }}>
            Spent: <span className="mono">{fromBaseUnits(BigInt(spent))} USDC</span>
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
