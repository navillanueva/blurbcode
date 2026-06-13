import { describe, expect, test } from "bun:test"
import { selectWinner, type AuctionCandidate } from "../src/auction"

function candidate(over: Partial<AuctionCandidate>): AuctionCandidate {
  return {
    id: "c1",
    advertiser: "Acme",
    text: "Buy widgets",
    url: "https://acme.test",
    bidBaseUnits: 1_000_000n,
    budgetRemaining: 5_000_000n,
    status: "active",
    createdAt: 1000,
    ...over,
  }
}

describe("selectWinner", () => {
  test("no candidates → null", () => {
    expect(selectWinner([])).toBeNull()
  })

  test("ignores draft and budget-exhausted campaigns", () => {
    expect(selectWinner([candidate({ status: "draft" })])).toBeNull()
    expect(selectWinner([candidate({ budgetRemaining: 0n })])).toBeNull()
    expect(selectWinner([candidate({ bidBaseUnits: 0n })])).toBeNull()
  })

  test("serves the single eligible campaign", () => {
    const ad = selectWinner([candidate({ id: "only" })])
    expect(ad).toEqual({ id: "only", advertiser: "Acme", text: "Buy widgets", url: "https://acme.test" })
  })

  test("highest bid wins", () => {
    const ad = selectWinner([
      candidate({ id: "low", bidBaseUnits: 1_000_000n }),
      candidate({ id: "high", bidBaseUnits: 3_000_000n }),
      candidate({ id: "mid", bidBaseUnits: 2_000_000n }),
    ])
    expect(ad?.id).toBe("high")
  })

  test("ties break to the earliest-created campaign", () => {
    const ad = selectWinner([
      candidate({ id: "later", bidBaseUnits: 2_000_000n, createdAt: 5000 }),
      candidate({ id: "earlier", bidBaseUnits: 2_000_000n, createdAt: 2000 }),
    ])
    expect(ad?.id).toBe("earlier")
  })
})
