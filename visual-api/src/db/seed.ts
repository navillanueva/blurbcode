// `bun run seed` — insert the launch-partner house ads (Dynamic / Arc / Unlink)
// so the ad slot has branded inventory to rotate before any advertiser signs up.
// Idempotent: deterministic ids + upserts, so re-running refreshes copy/logos
// instead of duplicating. Run against the configured DATABASE_URL (same as the
// migrate CLI); applies the schema first so the logo_url column exists.

import { eq } from "drizzle-orm"
import { createDatabase } from "./index"
import { applySchema } from "./migrate"
import { accounts, campaigns } from "./schema"
import { readKickbackEnv } from "@kickback/config"
import { toBaseUnits, USDC_DECIMALS } from "@kickback/money"

// A single house advertiser owns every seeded campaign. Fixed address so re-runs
// resolve to the same account row (address is unique).
const HOUSE_ID = "seed-house-advertiser"
const HOUSE_ADDRESS = "0x" + "ad5eed".padStart(40, "0")

interface SeedAd {
  id: string
  advertiser: string
  text: string
  url: string
  logoUrl: string
}

// The blurb renders as "{advertiser} — {text}". Logos are self-hosted under the
// web app's /public/ads (see visual-web/public/ads). Edit freely — re-run to apply.
const SEED_ADS: SeedAd[] = [
  { id: "seed-dynamic", advertiser: "Dynamic", text: "wallets in minutes", url: "https://www.dynamic.xyz", logoUrl: "/ads/dynamic.png" },
  { id: "seed-arc", advertiser: "Arc", text: "private, gas-free USDC", url: "https://arc.network", logoUrl: "/ads/arc.png" },
  { id: "seed-unlink", advertiser: "Unlink", text: "private onchain settlement", url: "https://unlink.xyz", logoUrl: "/ads/unlink.png" },
]

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is required to seed")
  process.exit(1)
}

const db = createDatabase(url)
await applySchema(db)

// Decimals must match the running API (fixed bid is $10/1,000 views in these units).
const kb = readKickbackEnv()
const decimals = kb.arc?.usdc.decimals ?? USDC_DECIMALS
const bid = toBaseUnits("10", decimals).toString()
const budget = toBaseUnits("1000", decimals).toString()

// House advertiser account (FK target for the campaigns).
await db.insert(accounts).values({ id: HOUSE_ID, address: HOUSE_ADDRESS }).onConflictDoNothing({ target: accounts.address })
const [house] = await db.select().from(accounts).where(eq(accounts.address, HOUSE_ADDRESS))
if (!house) throw new Error("house advertiser account missing immediately after upsert")

for (const ad of SEED_ADS) {
  await db
    .insert(campaigns)
    .values({
      id: ad.id,
      advertiserAccountId: house.id,
      advertiser: ad.advertiser,
      text: ad.text,
      url: ad.url,
      logoUrl: ad.logoUrl,
      bidBaseUnits: bid,
      budgetBaseUnits: budget,
      budgetRemainingBaseUnits: budget,
      status: "active",
    })
    .onConflictDoUpdate({
      target: campaigns.id,
      // Refresh display fields on re-run; leave budget_remaining alone so a live
      // ad that's already been spending down isn't silently topped back up.
      set: { advertiser: ad.advertiser, text: ad.text, url: ad.url, logoUrl: ad.logoUrl, status: "active" },
    })
  console.log(`✓ seeded ${ad.advertiser} (${ad.logoUrl})`)
}

console.log(`✓ ${SEED_ADS.length} house ads seeded to`, url.replace(/:\/\/[^@]*@/, "://***@"))
process.exit(0)
