import Link from "next/link"

export default function Landing() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">ads in your coding harness</div>
        <h1>
          Your terminal agent just became <span className="grad">an income stream</span>.
        </h1>
        <p className="lead">
          Visual Code drops a tasteful, non-intrusive ad slot into your OpenCode TUI. Advertisers bid to reach
          developers where they actually work; you earn half of every impression — settled privately on Arc, so no one
          sees your balance.
        </p>
        <div className="cta-row">
          <Link href="/wallet" className="btn btn-primary">
            Create / connect wallet
          </Link>
          <Link href="/advertise" className="btn btn-ghost">
            Advertise to developers →
          </Link>
        </div>
      </section>

      <section className="section">
        <h2>How it works</h2>
        <div className="grid grid-3">
          <div className="card">
            <div className="step-num">01 — advertisers</div>
            <h3>Fund a campaign</h3>
            <p>
              Set your ad copy, a click-through URL, a bid per 1,000 impressions, and a budget. Fund it on Arc and your
              ad enters the auction.
            </p>
          </div>
          <div className="card">
            <div className="step-num">02 — developers</div>
            <h3>Earn while you code</h3>
            <p>
              The winning ad shows in your harness in a 5-second slot. Every impression credits your account — you keep
              50% of what advertisers pay.
            </p>
          </div>
          <div className="card">
            <div className="step-num">03 — settlement</div>
            <h3>Private payouts on Arc</h3>
            <p>
              Deposits and earnings settle as private USDC transfers via Unlink on Arc testnet. Withdraw to any wallet
              when you like.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>For developers</h2>
        <div className="card">
          <p style={{ color: "var(--text)", marginBottom: 16 }}>
            Create a wallet with one click (social or email via Dynamic — non-custodial, the key stays with you), then
            generate a device token and paste it into the OpenCode TUI:
          </p>
          <div className="codeblock">
            <span className="prompt">/wallet</span>
            {"  "}# in the OpenCode TUI, then paste your device token
          </div>
          <div className="cta-row" style={{ marginTop: 20 }}>
            <Link href="/wallet" className="btn btn-primary">
              Get my device token
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>For advertisers</h2>
        <div className="card">
          <p style={{ color: "var(--text)", marginBottom: 16 }}>
            Reach developers inside the tool they live in. Ascending auction, transparent spend, pay only for real
            5-second impressions and clicks.
          </p>
          <div className="cta-row">
            <Link href="/advertise" className="btn btn-primary">
              Launch a campaign
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
