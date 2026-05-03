import "server-only";

import { getAddress, type Hex } from "viem";

import {
  parseOwnerPaymentAddresses,
  validatePaymentTransaction,
  type PaymentVerificationResult,
} from "@/lib/payment-verification";
import { getSepoliaPublicClient } from "@/lib/server/sepolia";

export { parseOwnerPaymentAddresses, validatePaymentTransaction } from "@/lib/payment-verification";
export type { PaymentVerificationResult } from "@/lib/payment-verification";

function getConfiguredOwnerPaymentAddresses() {
  return process.env.OWNER_PAYMENT_ADDRESSES ?? process.env.NEXT_PUBLIC_OWNER_PAYMENT_ADDRESSES;
}

export async function verifyPaymentTransaction(params: {
  loginAddress: string;
  txHash: Hex;
}): Promise<PaymentVerificationResult> {
  const ownerAddresses = parseOwnerPaymentAddresses(getConfiguredOwnerPaymentAddresses());
  const client = getSepoliaPublicClient();

  let transaction;
  try {
    transaction = await client.getTransaction({ hash: params.txHash });
  } catch {
    return { ok: false, error: "Transaction not found on-chain.", txHash: params.txHash };
  }

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: params.txHash });
  } catch {
    receipt = null;
  }

  return validatePaymentTransaction({
    loginAddress: params.loginAddress,
    ownerAddresses,
    transaction: {
      hash: params.txHash,
      from: getAddress(transaction.from),
      to: transaction.to ? getAddress(transaction.to) : null,
      blockNumber: receipt?.blockNumber ?? transaction.blockNumber ?? null,
      status: receipt ? receipt.status : "pending",
      value: transaction.value,
    },
  });
}
