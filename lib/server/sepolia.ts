import "server-only";

import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

let publicClient: ReturnType<typeof createPublicClient> | null = null;

export function getSepoliaRpcUrl(): string | undefined {
  return process.env.SEPOLIA_RPC_URL;
}

export function getSepoliaPublicClient() {
  if (publicClient) {
    return publicClient;
  }

  const rpc = getSepoliaRpcUrl();
  publicClient = createPublicClient({
    chain: sepolia,
    transport: rpc ? http(rpc) : http(),
  });

  return publicClient;
}
