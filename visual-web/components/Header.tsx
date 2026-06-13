"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { DynamicWidget } from "@dynamic-labs/sdk-react-core"

export function Header() {
  // The widget reads browser-only wallet state; render it after mount to avoid
  // an SSR/hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <span className="dot" />
          visualcode
        </Link>
        <nav className="nav">
          <Link href="/advertise">Advertise</Link>
          <Link href="/wallet">Wallet</Link>
        </nav>
        <div className="header-spacer" />
        {mounted ? <DynamicWidget /> : null}
      </div>
    </header>
  )
}
