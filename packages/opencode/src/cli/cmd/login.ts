import path from "path"
import fs from "fs/promises"
import { cmd } from "./cmd"
import { Global } from "@opencode-ai/core/global"
import { UI } from "../ui"

// BlurbCode account link — `blurbcode login --token <device-token> --url <backend>`.
//
// The non-interactive twin of the in-TUI `/wallet` dialog: it writes the
// `visualcode` credential into the SAME auth.json the TUI reads
// (packages/tui/src/kickback/config.ts → `Global.Path.data/auth.json`, mode 0600),
// so the next `blurbcode` session serves live ads and real earnings instead of the
// local mock. The web wallet page hands the user the full command (token + url) to
// paste, so both flags are normally present.

const PROVIDER_ID = "visualcode"
const URL_RE = /^https?:\/\/.+/i

// The hosted BlurbCode backend, baked in so `blurbcode login --token <token>` works
// with no --url. Keep in sync with packages/tui/src/kickback/config.ts DEFAULT_API_URL.
const DEFAULT_API_URL = "https://visual-api-production.up.railway.app"

export const LoginCommand = cmd({
  command: "login",
  describe: "link this machine to your BlurbCode account",
  builder: (yargs) =>
    yargs
      .option("token", {
        describe: "device token from blurbcode.xyz/wallet",
        type: "string",
        demandOption: true,
      })
      .option("url", {
        describe: "BlurbCode backend URL (defaults to the hosted backend)",
        type: "string",
        default: process.env.VISUALCODE_API_URL ?? DEFAULT_API_URL,
      }),
  async handler(args) {
    const token = (args.token ?? "").trim()
    const url = (args.url ?? "").trim().replace(/\/+$/, "")

    if (!token) {
      UI.error("A device token is required. Get yours at https://blurbcode.xyz/wallet")
      process.exitCode = 1
      return
    }
    if (!URL_RE.test(url)) {
      UI.error("A backend URL is required (--url https://…). Copy the full command from https://blurbcode.xyz/wallet")
      process.exitCode = 1
      return
    }

    const file = path.join(Global.Path.data, "auth.json")
    let data: Record<string, unknown> = {}
    try {
      data = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>
    } catch {
      // No auth.json yet (or unreadable) — start a fresh store. We never throw the
      // user's other credentials away: anything readable above is preserved below.
    }
    data[PROVIDER_ID] = { type: "api", key: token, metadata: { apiUrl: url } }
    await fs.mkdir(Global.Path.data, { recursive: true })
    await fs.writeFile(file, JSON.stringify(data, null, 2), { mode: 0o600 })

    UI.println("")
    UI.println("  ✓ Linked to BlurbCode.")
    UI.println("  Run `blurbcode` — your status line now serves live ads, and you earn while you code.")
    UI.println("")
  },
})
