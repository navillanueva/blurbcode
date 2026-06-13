import { describe, expect, test } from "bun:test"
import { generateKeyPair, SignJWT, type KeyLike } from "jose"
import { createDynamicVerifier, extractWalletAddress } from "../src/auth/dynamic"

const ADDRESS = "0x1111111111111111111111111111111111111111"

async function signWith(key: KeyLike, payload: Record<string, unknown>, sub = "dyn-user-1"): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key)
}

describe("Dynamic JWT verification", () => {
  test("verifies a valid JWT and extracts the lower-cased wallet address", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256")
    const verifier = createDynamicVerifier({ key: publicKey as KeyLike })
    const jwt = await signWith(privateKey as KeyLike, {
      verified_credentials: [{ address: ADDRESS.toUpperCase(), format: "blockchain" }],
      email: "dev@example.com",
    })
    const id = await verifier.verify(jwt)
    expect(id.sub).toBe("dyn-user-1")
    expect(id.address).toBe(ADDRESS) // lower-cased
    expect(id.email).toBe("dev@example.com")
  })

  test("rejects a JWT signed with a different key", async () => {
    const { publicKey } = await generateKeyPair("RS256")
    const other = await generateKeyPair("RS256")
    const verifier = createDynamicVerifier({ key: publicKey as KeyLike })
    const jwt = await signWith(other.privateKey as KeyLike, {
      verified_credentials: [{ address: ADDRESS, format: "blockchain" }],
    })
    await expect(verifier.verify(jwt)).rejects.toThrow()
  })

  test("rejects a JWT with no verified wallet address", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256")
    const verifier = createDynamicVerifier({ key: publicKey as KeyLike })
    const jwt = await signWith(privateKey as KeyLike, { verified_credentials: [{ email: "x@y.z" }] })
    await expect(verifier.verify(jwt)).rejects.toThrow(/wallet address/)
  })

  test("unconfigured verifier (no key, no env) errors only at verify time", async () => {
    const verifier = createDynamicVerifier({})
    await expect(verifier.verify("anything")).rejects.toThrow(/DYNAMIC_ENVIRONMENT_ID/)
  })

  test("extractWalletAddress finds the first valid EVM address", () => {
    expect(extractWalletAddress({ verified_credentials: [{ email: "a@b.c" }, { address: ADDRESS }] } as never)).toBe(
      ADDRESS,
    )
    expect(extractWalletAddress({ verified_credentials: [] } as never)).toBeUndefined()
    expect(extractWalletAddress({} as never)).toBeUndefined()
  })
})
