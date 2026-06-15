import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { RGBA } from "@opentui/core"
import open from "open"
import { useTheme } from "../context/theme"
import { adStore, type AdState } from "./ad-store"
import { startViewTracking } from "./view-tracking"
import { reportImpression } from "./backend"

// Per-advertiser brand accent for the status-line marker. Keyed by lower-cased
// advertiser name; unknown advertisers fall back to the theme accent.
const BRAND_COLORS: Record<string, RGBA> = {
  dynamic: RGBA.fromHex("#7c5cff"),
  arc: RGBA.fromHex("#ff5c5c"),
  unlink: RGBA.fromHex("#22d3ee"),
  worldcoin: RGBA.fromHex("#f5f5f5"),
  "blurb code": RGBA.fromHex("#a3e635"),
  blurbcode: RGBA.fromHex("#a3e635"),
}

// Kickback AI — live status-bar ad renderer.
//
// Replaces the agent's transient "working title" (the gerund shown next to the spinner
// while busy) with the auction-winning ad, rendered as:
//
//   ▐ <advertiser> · <ad copy>
//
// Display-only: this is TUI render output, never injected into the LLM context. View
// tracking runs while the slot is mounted (i.e. while the agent is working); consent off
// or an empty slot renders nothing, so the caller falls back to the normal title.
//
// The advertiser marker is a `▐` block in the advertiser's brand color (a real image logo
// isn't feasible in a cell-based terminal renderer), falling back to the BlurbCode accent
// (theme.primary) for advertisers we have no brand color for. The advertiser name + copy
// are clickable to open the campaign URL and count a click.
export function StatusBarAd() {
  const { theme } = useTheme()
  const [state, setState] = createSignal<AdState>(adStore.getState())

  onMount(() => {
    const unsubscribe = adStore.subscribe(setState)
    const stop = startViewTracking(adStore, { onImpression: reportImpression })
    onCleanup(() => {
      unsubscribe()
      stop()
    })
  })

  // Only render when consent is on AND an ad is present.
  const ad = () => (state().enabled ? state().ad : null)

  function onClickAd(url: string) {
    adStore.recordClick()
    open(url).catch(() => {})
  }

  const markColor = (advertiser: string): RGBA => BRAND_COLORS[advertiser.trim().toLowerCase()] ?? theme.primary

  return (
    <Show when={ad()}>
      {(current) => (
        <box flexDirection="row" gap={1} flexShrink={0} onMouseUp={() => onClickAd(current().clickUrl ?? current().url)}>
          <text fg={markColor(current().advertiser)}>▐</text>
          <text fg={theme.text}>
            {current().advertiser}
            <span style={{ fg: theme.textMuted }}> · {current().text}</span>
          </text>
        </box>
      )}
    </Show>
  )
}
