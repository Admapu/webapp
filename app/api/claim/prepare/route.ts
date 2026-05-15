import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { fetchForwarderNonce } from "@/lib/server/wallet-status";

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address");
    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const nonce = await fetchForwarderNonce(address);
    return NextResponse.json(
      { nonce: nonce.toString() },
      {
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo preparar el claim";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
