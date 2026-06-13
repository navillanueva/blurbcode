import { describe, expect, test } from "bun:test"
import { createMockWalletProvider } from "../src/mock/wallet"

describe("MockWalletProvider", () => {
  test("starts signed out", () => {
    const w = createMockWalletProvider()
    expect(w.getSession()).toBeNull()
  })

  test("signIn returns a deterministic session reused as the Unlink userId", async () => {
    const w = createMockWalletProvider({ userId: "u-42", address: "0xabc", jwt: "jwt-token" })
    const session = await w.signIn()
    expect(session).toEqual({ userId: "u-42", address: "0xabc", jwt: "jwt-token" })
    expect(w.getSession()).toEqual(session)
  })

  test("uses fixed defaults when no options are given", async () => {
    const session = await createMockWalletProvider().signIn()
    expect(session.userId).toBe("mock-user-0001")
    expect(session.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(session.jwt).toBeUndefined()
  })

  test("signOut clears the session", async () => {
    const w = createMockWalletProvider()
    await w.signIn()
    await w.signOut()
    expect(w.getSession()).toBeNull()
  })

  test("returns copies so callers cannot mutate internal state", async () => {
    const w = createMockWalletProvider()
    const a = await w.signIn()
    a.userId = "tampered"
    expect(w.getSession()?.userId).toBe("mock-user-0001")
  })
})
