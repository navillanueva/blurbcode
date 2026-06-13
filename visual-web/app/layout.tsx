import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"
import { Header } from "@/components/Header"

export const metadata: Metadata = {
  title: "Visual Code — ads in your coding harness",
  description:
    "Advertisers pay, devs earn, settled privately on Arc. Visual Code puts a tasteful ad slot in your terminal coding agent and shares the revenue with you.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main className="container">{children}</main>
          <footer className="footer">
            <span className="mono">visual-code</span> · settled privately on Arc testnet · non-custodial via Dynamic
          </footer>
        </Providers>
      </body>
    </html>
  )
}
