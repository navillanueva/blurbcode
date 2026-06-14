// Withdraw atomicity: the route settles BEFORE zeroing earnings, so a settlement
// failure (e.g. the real pool-balance guard throwing) must surface as 502 and leave
// the developer's earnings intact. Drives the app with a settlement stub that throws.

import { describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { jsonInit, makeHarness, sessionCookie } from "./helpers"
import { earnings } from "../src/db/schema"
import * as repo from "../src/db/repo"
import type { SettlementService } from "../src/settlement/service"

const DEV = "0x" + "9".repeat(40)

const throwingSettlement: SettlementService = {
  mode: "real",
  live: { wallet: true, privacy: true, settlement: true },
  notes: [],
  async fundCampaign() {
    return { txRef: "unlink-deposit:stub" }
  },
  async withdrawEarnings() {
    // Mirrors real.ts when the pool can't cover the payout.
    throw new Error("pool balance 0 base units < requested — refusing to withdraw")
  },
}

describe("withdraw atomicity", () => {
  test("a failed payout returns 502 and does NOT zero earnings", async () => {
    const h = await makeHarness({ settlement: throwingSettlement })

    // Authenticate the developer and seed a non-zero earnings balance directly.
    const jwt = await h.signDynamicJwt({ sub: "dev-atomic", address: DEV })
    const auth = await h.app.request("/api/auth/dynamic", jsonInit("POST", { dynamicJwt: jwt }))
    const cookie = sessionCookie(auth)
    const { id } = await repo.upsertAccountByAddress(h.db, { address: DEV })
    await h.db.update(earnings).set({ balanceBaseUnits: "60000" }).where(eq(earnings.accountId, id))

    const res = await h.app.request("/api/withdraw", jsonInit("POST", {}, { cookie }))
    expect(res.status).toBe(502)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/withdraw failed/)

    // Earnings must be intact — never zeroed when settlement fails.
    const me = await h.app.request("/api/me", { headers: { cookie } })
    const meBody = (await me.json()) as { balanceBaseUnits: string }
    expect(meBody.balanceBaseUnits).toBe("60000")
  })

  test("a zero balance short-circuits without calling settlement", async () => {
    const h = await makeHarness({ settlement: throwingSettlement })
    const jwt = await h.signDynamicJwt({ sub: "dev-zero", address: "0x" + "8".repeat(40) })
    const auth = await h.app.request("/api/auth/dynamic", jsonInit("POST", { dynamicJwt: jwt }))
    const cookie = sessionCookie(auth)

    // No earnings seeded → withdraw returns ok with 0, never hits the throwing stub.
    const res = await h.app.request("/api/withdraw", jsonInit("POST", {}, { cookie }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; withdrawnBaseUnits: string }
    expect(body.ok).toBe(true)
    expect(body.withdrawnBaseUnits).toBe("0")
  })
})
