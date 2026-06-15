// GET /api/click/:campaignId — server-observed clicks. The served ad carries a
// signed click-redirect URL; hitting it records ONE click for the bound dev and
// 302-redirects to the advertiser. App + PGlite + mock settlement, end to end:
// advertiser funds two campaigns, a developer serves an ad, clicks it, and the
// click shows up in /api/me/earnings — while bad/mismatched tokens redirect but
// credit nothing.

import { beforeAll, describe, expect, test } from "bun:test"
import { jsonInit, makeHarness, sessionCookie, type TestHarness } from "./helpers"

const ADV = "0x" + "a".repeat(40)
const DEV = "0x" + "b".repeat(40)

let h: TestHarness
let advCookie: string
let devCookie: string
let deviceToken: string
const urlById = new Map<string, string>()

async function authCookie(sub: string, address: string): Promise<string> {
  const jwt = await h.signDynamicJwt({ sub, address })
  return sessionCookie(await h.app.request("/api/auth/dynamic", jsonInit("POST", { dynamicJwt: jwt })))
}

async function createFunded(advertiser: string, url: string, txHash: string): Promise<string> {
  const create = await h.app.request(
    "/api/campaigns",
    jsonInit("POST", { advertiser, text: `${advertiser} ad`, url, budgetBaseUnits: "10000000" }, { cookie: advCookie }),
  )
  const id = ((await create.json()) as { campaign: { id: string } }).campaign.id
  await h.app.request(`/api/campaigns/${id}/fund`, jsonInit("POST", { paymentTxHash: txHash }, { cookie: advCookie }))
  urlById.set(id, url)
  return id
}

/** Serve until we get a clickUrl for the requested campaign id (rotation alternates). */
async function clickUrlFor(campaignId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const res = await h.app.request("/api/ad/serve", { headers: { Authorization: `Bearer ${deviceToken}` } })
    const { ad } = (await res.json()) as { ad: { id: string; clickUrl?: string } | null }
    if (ad?.id === campaignId && ad.clickUrl) return ad.clickUrl
  }
  throw new Error(`no clickUrl served for ${campaignId}`)
}

/** Current server-observed click count for the dev. */
async function clicksNow(): Promise<number> {
  const res = await h.app.request("/api/me/earnings", { headers: { Authorization: `Bearer ${deviceToken}` } })
  return ((await res.json()) as { clicks: number }).clicks
}

/** A clickUrl is absolute (origin); reduce it to the path+query app.request wants. */
function pathOf(absUrl: string): string {
  const u = new URL(absUrl)
  return u.pathname + u.search
}

let campA: string
let campB: string

beforeAll(async () => {
  h = await makeHarness()
  advCookie = await authCookie("adv-click", ADV)
  campA = await createFunded("Globex", "https://globex.test/landing", "0x" + "1".repeat(64))
  campB = await createFunded("Initech", "https://initech.test/landing", "0x" + "2".repeat(64))

  devCookie = await authCookie("dev-click", DEV)
  const tok = await h.app.request("/api/device-tokens", jsonInit("POST", {}, { cookie: devCookie }))
  deviceToken = ((await tok.json()) as { token: string }).token
})

describe("GET /api/ad/serve clickUrl", () => {
  test("the served ad carries a click-redirect URL for its own campaign", async () => {
    const res = await h.app.request("/api/ad/serve", { headers: { Authorization: `Bearer ${deviceToken}` } })
    const { ad } = (await res.json()) as { ad: { id: string; url: string; clickUrl: string } | null }
    expect(ad).not.toBeNull()
    expect(ad!.clickUrl).toContain(`/api/click/${ad!.id}?t=`)
  })
})

describe("GET /api/click/:campaignId", () => {
  test("a valid click 302-redirects to the advertiser and records one click", async () => {
    const before = await clicksNow()
    const res = await h.app.request(pathOf(await clickUrlFor(campA)), { redirect: "manual" })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://globex.test/landing")
    expect(await clicksNow()).toBe(before + 1)
  })

  test("a tampered token still redirects but records nothing", async () => {
    const before = await clicksNow()
    const res = await h.app.request(`/api/click/${campA}?t=not-a-real-token`, { redirect: "manual" })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://globex.test/landing")
    expect(await clicksNow()).toBe(before)
  })

  test("a missing token still redirects but records nothing", async () => {
    const before = await clicksNow()
    const res = await h.app.request(`/api/click/${campA}`, { redirect: "manual" })
    expect(res.status).toBe(302)
    expect(await clicksNow()).toBe(before)
  })

  test("a token bound to a different campaign is not credited", async () => {
    // Token minted for campA, replayed against campB's path → redirects to campB but
    // the campaignId-binding guard refuses the credit.
    const tokenA = new URL(await clickUrlFor(campA)).searchParams.get("t")!
    const before = await clicksNow()
    const res = await h.app.request(`/api/click/${campB}?t=${encodeURIComponent(tokenA)}`, { redirect: "manual" })
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://initech.test/landing")
    expect(await clicksNow()).toBe(before)
  })

  test("an unknown campaign is a 404 (nothing to redirect to)", async () => {
    const res = await h.app.request("/api/click/does-not-exist?t=whatever", { redirect: "manual" })
    expect(res.status).toBe(404)
  })
})
