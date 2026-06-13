import { describe, expect, test } from "bun:test"
import { fromBaseUnits, toBaseUnits, USDC_DECIMALS } from "../src/money"

describe("toBaseUnits", () => {
  test("converts whole and fractional USDC", () => {
    expect(toBaseUnits("1")).toBe(1_000_000n)
    expect(toBaseUnits("1.99")).toBe(1_990_000n)
    expect(toBaseUnits("0.000001")).toBe(1n)
    expect(toBaseUnits("0")).toBe(0n)
  })

  test("honors a custom decimals (18dp native gas)", () => {
    expect(toBaseUnits("1", 18)).toBe(1_000_000_000_000_000_000n)
  })

  test("rejects more fractional digits than the token allows", () => {
    expect(() => toBaseUnits("1.9999999")).toThrow(/more than 6 decimal places/)
  })

  test("rejects malformed input", () => {
    expect(() => toBaseUnits("abc")).toThrow(/invalid decimal amount/)
    expect(() => toBaseUnits(".5")).toThrow(/invalid decimal amount/)
    expect(() => toBaseUnits("-1")).toThrow(/invalid decimal amount/)
  })
})

describe("fromBaseUnits", () => {
  test("renders normalized decimals, dropping trailing zeros", () => {
    expect(fromBaseUnits(1_000_000n)).toBe("1")
    expect(fromBaseUnits(1_990_000n)).toBe("1.99")
    expect(fromBaseUnits(1n)).toBe("0.000001")
    expect(fromBaseUnits(0n)).toBe("0")
  })

  test("rejects negative balances", () => {
    expect(() => fromBaseUnits(-1n)).toThrow(/non-negative/)
  })
})

describe("round-trip", () => {
  test("toBaseUnits -> fromBaseUnits is stable for normalized inputs", () => {
    for (const v of ["0", "1", "1.99", "0.000001", "123456.654321"]) {
      expect(fromBaseUnits(toBaseUnits(v))).toBe(v)
    }
  })

  test("USDC_DECIMALS is 6", () => {
    expect(USDC_DECIMALS).toBe(6)
  })
})
