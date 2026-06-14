"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core"
import { Logo } from "@/components/BlurbMark"
import { MenuIcon } from "@/components/Icons"

// v2 nav (handoff §1): only Advertise + Personal account. Home is the logo; the
// personal-account page (/me) is also the sign-in/onboarding destination, holding
// the device token, wallet, and earnings. Brand + Terminal were removed.
const NAV = [
  { href: "/advertise", label: "Advertise" },
  { href: "/me", label: "Personal account" },
] as const

export function Header() {
  const pathname = usePathname()
  const { setShowAuthFlow, primaryWallet, handleLogOut } = useDynamicContext()
  // Dynamic-side login state: flips as soon as the OTP/social flow finalizes,
  // independent of whether the backend account-link (GET /api/me) succeeded.
  const isLoggedIn = useIsLoggedIn()
  const [open, setOpen] = useState(false)

  // Close the mobile menu on route change.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const address = primaryWallet?.address
  const shortAddr = address ? `${address.slice(0, 6)}···${address.slice(-4)}` : "Account"

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="logo" aria-label="BlurbCode home">
          <Logo />
        </Link>

        <nav className="main-nav" data-open={open}>
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? " nav-link--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="header-right">
          {isLoggedIn ? (
            <>
              <Link href="/me" className="btn btn--ink btn--sign mono" title={address ?? undefined}>
                {shortAddr}
              </Link>
              <button className="btn btn--ghost btn--sign" onClick={() => handleLogOut()}>
                Sign out
              </button>
            </>
          ) : (
            <button className="btn btn--ink btn--sign" onClick={() => setShowAuthFlow(true)}>
              Sign in
            </button>
          )}
          <button
            className="nav-toggle"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <MenuIcon />
          </button>
        </div>
      </div>
    </header>
  )
}
