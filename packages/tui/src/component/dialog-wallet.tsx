import { onMount } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useToast } from "../ui/toast"
import { useTheme } from "../context/theme"
import { DialogPrompt } from "../ui/dialog-prompt"
import * as KickbackBackend from "../kickback/backend"
import { VISUALCODE_PROVIDER_ID, DEFAULT_API_URL } from "../kickback/config"

// BlurbCode — connect your account (`/wallet`). The backend URL is baked into the
// build (kickback/config DEFAULT_API_URL), so we only ask for the device token from
// blurbcode.xyz/wallet — the user never needs to know a backend URL. Persisted via
// OpenCode's own credential mechanism (auth.json, mode 0600): the token is the `key`,
// the baked backend URL rides in `metadata.apiUrl`.

export function DialogWallet() {
  const dialog = useDialog()
  const sdk = useSDK()
  const toast = useToast()
  const { theme } = useTheme()

  async function promptToken(): Promise<string | undefined> {
    const value = await DialogPrompt.show(dialog, "Connect BlurbCode — paste your device token", {
      placeholder: "vc_dt_…",
      description: () => (
        <box gap={1}>
          <text fg={theme.textMuted}>
            Sign in at blurbcode.xyz/wallet, copy your device token, and paste it here to start earning.
          </text>
        </box>
      ),
    })
    if (value === null) return
    const trimmed = value.trim()
    if (trimmed) return trimmed
    toast.show({ variant: "error", message: "A device token is required to connect." })
    return promptToken()
  }

  async function run() {
    const token = await promptToken()
    if (!token) return dialog.clear()

    const result = await sdk.client.auth.set({
      providerID: VISUALCODE_PROVIDER_ID,
      auth: {
        type: "api",
        key: token,
        metadata: { apiUrl: DEFAULT_API_URL },
      },
    })
    if (result.error) {
      toast.show({ variant: "error", message: "Failed to save BlurbCode credential." })
      dialog.clear()
      return
    }

    // Re-resolve the client and swap the ad source to the backend-served ad.
    await KickbackBackend.reconnect()
    toast.show({
      variant: KickbackBackend.isConfigured() ? "success" : "info",
      message: KickbackBackend.isConfigured()
        ? "BlurbCode connected — serving live ads."
        : "Saved BlurbCode credential.",
    })
    dialog.clear()
  }

  onMount(() => {
    void run()
  })

  return <box />
}
