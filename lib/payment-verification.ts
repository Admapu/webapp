import { getAddress, isAddress, type Address, type Hex } from "viem";

export type OwnerPaymentAddress = Address;

export type PaymentTransactionDetails = {
  hash: Hex;
  from: Address;
  to: Address | null;
  blockNumber: bigint | null;
  status: "success" | "reverted" | "pending";
  value: bigint;
};

export type PaymentVerificationResult =
  | {
      ok: true;
      txHash: Hex;
      payer: Address;
      recipient: Address;
      blockNumber: bigint;
      value: string;
    }
  | {
      ok: false;
      error: string;
      txHash?: Hex;
      payer?: Address;
      recipient?: Address | null;
      blockNumber?: bigint | null;
      value?: string;
    };

export function parseOwnerPaymentAddresses(raw: string | undefined): OwnerPaymentAddress[] {
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw new Error("Falta OWNER_PAYMENT_ADDRESSES con al menos una owner payment address.");
  }

  return Array.from(
    new Set(
      entries.map((entry) => {
        if (!isAddress(entry)) {
          throw new Error(`OWNER_PAYMENT_ADDRESSES contiene una direccion invalida: ${entry}`);
        }
        return getAddress(entry);
      })
    )
  );
}

export function validatePaymentTransaction(input: {
  loginAddress: string;
  ownerAddresses: readonly OwnerPaymentAddress[];
  transaction: PaymentTransactionDetails;
}): PaymentVerificationResult {
  const loginAddress = getAddress(input.loginAddress);
  const ownerAddresses = new Set(input.ownerAddresses.map((address) => getAddress(address)));
  const from = getAddress(input.transaction.from);
  const to = input.transaction.to ? getAddress(input.transaction.to) : null;

  if (from !== loginAddress) {
    return {
      ok: false,
      error: "The payment must come from the login wallet.",
      txHash: input.transaction.hash,
      payer: from,
      recipient: to,
      blockNumber: input.transaction.blockNumber,
      value: input.transaction.value.toString(),
    };
  }

  if (!to || !ownerAddresses.has(to)) {
    return {
      ok: false,
      error: "The transaction recipient is not an owner payment address.",
      txHash: input.transaction.hash,
      payer: from,
      recipient: to,
      blockNumber: input.transaction.blockNumber,
      value: input.transaction.value.toString(),
    };
  }

  if (input.transaction.status !== "success" || input.transaction.blockNumber === null) {
    return {
      ok: false,
      error: "The transaction is not confirmed on-chain yet.",
      txHash: input.transaction.hash,
      payer: from,
      recipient: to,
      blockNumber: input.transaction.blockNumber,
      value: input.transaction.value.toString(),
    };
  }

  if (input.transaction.value <= BigInt(0)) {
    return {
      ok: false,
      error: "The payment transaction must transfer a positive native amount.",
      txHash: input.transaction.hash,
      payer: from,
      recipient: to,
      blockNumber: input.transaction.blockNumber,
      value: input.transaction.value.toString(),
    };
  }

  return {
    ok: true,
    txHash: input.transaction.hash,
    payer: from,
    recipient: to,
    blockNumber: input.transaction.blockNumber,
    value: input.transaction.value.toString(),
  };
}
