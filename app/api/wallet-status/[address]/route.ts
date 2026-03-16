import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { fetchWalletSnapshot } from "@/lib/server/wallet-status";

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    if (!isAddress(params.address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const snapshot = await fetchWalletSnapshot(params.address);
    return NextResponse.json(snapshot, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar el estado on-chain";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
