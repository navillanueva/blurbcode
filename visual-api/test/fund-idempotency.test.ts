// Fund-route idempotency + payment-reuse guard (app + PGlite + mock settlement).
// Mock ignores paymentTxHash, so this exercises the route/DB logic that is shared
// with real mode: a campaign funds once, and a payment hash funds at most one campaign.

import { beforeAll, describe, expect, test } from "bun:test"
import { jsonInit, makeHarness, sessionCookie, type TestHarness } from "./helpers"

const ADV = "0x" + "f".repeat(40)
const TX = "0x" + "1".repeat(64)

let h: TestHarness
let cookie: string

async function newCampaign(): Promise<string> {
  const res = await h.app.request(
    "/api/campaigns",
    jsonInit(
      "POST",
      { advertiser: "Acme", text: "ad copy here", url: "https://acme.test", bidBaseUnits: "1000000", budgetBaseUnits: "10000000" },
      { cookie },
    ),
  )
  const { campaign } = (await res.json()) as { campaign: { id: string } }
  return campaign.id
}

beforeAll(async () => {
  h = await makeHarness()
  const jwt = await h.signDynamicJwt({ sub: "adv-idem", address: ADV })
  const auth = await h.app.request("/api/auth/dynamic", jsonInit("POST", { dynamicJwt: jwt }))
  cookie = sessionCookie(auth)
})

describe("fund idempotency + reuse guard", () => {
  test("funding with a paymentTxHash activates and binds the hash", async () => {
    const id = await newCampaign()
    const res = await h.app.request(`/api/campaigns/${id}/fund`, jsonInit("POST", { paymentTxHash: TX }, { cookie }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { campaign: { status: string; paymentTxHash: string | null }; txRef: string }
    expect(body.campaign.status).toBe("active")
    expect(body.campaign.paymentTxHash).toBe(TX)
    expect(body.txRef).toMatch(/^mock-fund:/)
  })

  test("re-funding the same campaign is idempotent (no double deposit)", async () => {
    // Find the already-funded campaign and fund it again with the same hash.
    const list = await h.app.request("/api/campaigns", { headers: { cookie } })
    const { campaigns } = (await list.json()) as { campaigns: { id: string; status: string }[] }
    const funded = campaigns.find((c) => c.status === "active")!
    const res = await h.app.request(`/api/campaigns/${funded.id}/fund`, jsonInit("POST", { paymentTxHash: TX }, { cookie }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { alreadyFunded?: boolean; campaign: { status: string } }
    expect(body.alreadyFunded).toBe(true)
    expect(body.campaign.status).toBe("active")
  })

  test("a payment hash cannot fund a second campaign", async () => {
    const id2 = await newCampaign()
    const res = await h.app.request(`/api/campaigns/${id2}/fund`, jsonInit("POST", { paymentTxHash: TX }, { cookie }))
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/already used/)
  })
})
