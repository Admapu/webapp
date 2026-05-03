import test from "node:test";
import assert from "node:assert/strict";

import {
  parseOwnerPaymentAddresses,
  validatePaymentTransaction,
} from "../lib/payment-verification.ts";

test("parseOwnerPaymentAddresses normalizes and validates the configured owner addresses", () => {
  const addresses = parseOwnerPaymentAddresses(
    "0x1111111111111111111111111111111111111111, 0x2222222222222222222222222222222222222222"
  );

  assert.deepEqual(addresses, [
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
  ]);
});

test("parseOwnerPaymentAddresses throws when the configured list is empty", () => {
  assert.throws(() => parseOwnerPaymentAddresses("  ,   "), /owner payment/i);
});

test("validatePaymentTransaction accepts a confirmed transfer from the login wallet to an owner address", () => {
  const result = validatePaymentTransaction({
    loginAddress: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
    ownerAddresses: ["0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"],
    transaction: {
      hash: "0xabc",
      from: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
      to: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
      blockNumber: 123n,
      status: "success",
      value: 1n,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.recipient, "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB");
});

test("validatePaymentTransaction rejects transfers sent from another wallet", () => {
  const result = validatePaymentTransaction({
    loginAddress: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
    ownerAddresses: ["0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"],
    transaction: {
      hash: "0xabc",
      from: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      to: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
      blockNumber: 123n,
      status: "success",
      value: 1n,
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /login wallet/i);
});

test("validatePaymentTransaction rejects transfers to wallets outside the owner list", () => {
  const result = validatePaymentTransaction({
    loginAddress: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
    ownerAddresses: ["0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"],
    transaction: {
      hash: "0xabc",
      from: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
      to: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      blockNumber: 123n,
      status: "success",
      value: 1n,
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /owner payment address/i);
});

test("validatePaymentTransaction rejects txs that are not confirmed on-chain", () => {
  const result = validatePaymentTransaction({
    loginAddress: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
    ownerAddresses: ["0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"],
    transaction: {
      hash: "0xabc",
      from: "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
      to: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
      blockNumber: null,
      status: "pending",
      value: 1n,
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /confirmed on-chain/i);
});
