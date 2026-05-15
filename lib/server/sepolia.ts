import "server-only";

import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

let publicClient: ReturnType<typeof createPublicClient> | null = null;
let publicClientRpcUrl: string | undefined;

export function getSepoliaRpcUrl(): string | undefined {
  return process.env.SEPOLIA_RPC_URL;
}

export function getSepoliaPublicClient() {
  const rpc = getSepoliaRpcUrl();
  if (publicClient && publicClientRpcUrl === rpc) {
    return publicClient;
  }

  publicClient = createPublicClient({
    chain: sepolia,
    transport: rpc ? http(rpc) : http(),
  });
  publicClientRpcUrl = rpc;

  return publicClient;
}
