"use client"

import { useState } from "react"

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function copy() {
    setFailed(false)
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API needs a secure context (https/localhost); if it's missing
      // we say so rather than pretending the copy worked.
      setFailed(true)
    }
  }

  return (
    <button type="button" className="btn btn-sm" onClick={copy}>
      {failed ? "Copy failed — select manually" : copied ? "Copied!" : label}
    </button>
  )
}
