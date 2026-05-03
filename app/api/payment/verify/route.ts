import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Hex } from "viem";

import { verifyPaymentTransaction } from "@/lib/server/payment-verification";

function isHexHash(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { loginAddress?: string; txHash?: string };
    const loginAddress = body.loginAddress?.trim();
    const txHash = body.txHash?.trim();

    if (!loginAddress || !isAddress(loginAddress)) {
      return NextResponse.json({ error: "Invalid login address" }, { status: 400 });
    }

    if (!txHash || !isHexHash(txHash)) {
      return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
    }

    const result = await verifyPaymentTransaction({ loginAddress, txHash });
    const status = result.ok ? 200 : 400;

    return NextResponse.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
