// Verifies the advertiser's public ERC-20 payment to the treasury EOA before the
// backend shields the budget into the private pool (Plan 4 §3.4). Pure viem — no
// Unlink SDK — so it stays in the default typecheck graph and is unit-testable.
//
// The on-chain check is split in two: `assertValidPayment` is a pure function over
// a receipt + chain tip (tested with synthetic receipts, no network), and
// `verifyPaymentToTreasury` is the thin wrapper that fetches the receipt + tip via
// RPC and delegates. Any mismatch throws a descriptive Error (the fund route maps
// it to a 502 and leaves the campaign in `draft`, so the advertiser can retry).

import { createPublicClient, erc20Abi, http, parseEventLogs } from "viem"
import type { Log, TransactionReceipt } from "viem"
import type { BaseUnits } from "@kickback/money"

export interface VerifyPaymentParams {
  /** Arc RPC URL. */
  rpcUrl: string
  /** ERC-20 token the budget must be paid in (the pool token). */
  token: string
  /** EOA the transfer must land at (the platform treasury). */
  treasury: string
  /** Advertiser's linked address; when set, the transfer's sender must match it. */
  from?: string
  /** Minimum base units that must have been transferred (the campaign budget). */
  minAmount: BaseUnits
  /** The advertiser's payment transaction hash. */
  txHash: string
  /** Confirmations required on the payment tx. */
  minConfirmations: number
}

export interface VerifiedPayment {
  from: string
  to: string
  value: BaseUnits
  confirmations: number
}

/** Receipt fields the verification depends on (subset of viem's TransactionReceipt). */
type ReceiptLike = Pick<TransactionReceipt, "status" | "blockNumber"> & { logs: Log[] }

/**
 * Validate a payment receipt against the expected (token, treasury, amount, sender,
 * confirmations). Pure — no I/O — so it can be exhaustively unit-tested. Throws on
 * any mismatch; returns the matched transfer on success.
 */
export function assertValidPayment(
  receipt: ReceiptLike,
  tipBlockNumber: bigint,
  params: Omit<VerifyPaymentParams, "rpcUrl" | "txHash">,
): VerifiedPayment {
  if (receipt.status !== "success") {
    throw new Error(`payment tx reverted on-chain (status=${receipt.status})`)
  }

  const confirmations = Number(tipBlockNumber - receipt.blockNumber + 1n)
  if (confirmations < params.minConfirmations) {
    throw new Error(`payment tx has ${confirmations} confirmation(s); ${params.minConfirmations} required`)
  }

  const token = params.token.toLowerCase()
  const treasury = params.treasury.toLowerCase()

  // Decode every conforming ERC-20 Transfer in the receipt (parseEventLogs filters
  // out non-Transfer / malformed / ERC-721 logs). Match by token contract + recipient.
  const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs })
  const matches = transfers.filter(
    (t) => t.address.toLowerCase() === token && String(t.args.to).toLowerCase() === treasury,
  )
  if (matches.length === 0) {
    throw new Error(`no ERC-20 Transfer of ${params.token} to treasury ${params.treasury} found in tx logs`)
  }

  // If multiple, take the largest transfer to the treasury (the one covering budget).
  let best = matches[0]!
  for (const m of matches) if ((m.args.value ?? 0n) > (best.args.value ?? 0n)) best = m

  const value = best.args.value ?? 0n
  if (value < params.minAmount) {
    throw new Error(`payment of ${value} base units is short of the required ${params.minAmount}`)
  }

  const from = String(best.args.from)
  if (params.from && from.toLowerCase() !== params.from.toLowerCase()) {
    throw new Error(`payment sender ${from} does not match the advertiser address ${params.from}`)
  }

  return { from, to: String(best.args.to), value, confirmations }
}

/** Fetch the payment receipt + chain tip via RPC and validate it. */
export async function verifyPaymentToTreasury(params: VerifyPaymentParams): Promise<VerifiedPayment> {
  const client = createPublicClient({ transport: http(params.rpcUrl) })

  let receipt: TransactionReceipt
  try {
    receipt = await client.getTransactionReceipt({ hash: params.txHash as `0x${string}` })
  } catch (e) {
    throw new Error(
      `payment tx ${params.txHash} not found or still pending: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  const tip = await client.getBlockNumber()
  return assertValidPayment(receipt, tip, params)
}
