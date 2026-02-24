import { createPublicClient, getAddress, http, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";

const tokenAbi = [
  {
    inputs: [],
    name: "mintingPaused",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const addressVerifiedEvent = parseAbiItem("event AddressVerified(address indexed user, uint256 at)");
const verificationRevokedEvent = parseAbiItem("event VerificationRevoked(address indexed user, uint256 at)");

export type NetworkStatus = {
  chainId: number;
  latestBlock: bigint;
  mintingPaused: boolean;
  verifiedEvents: number;
  revokedEvents: number;
  uniqueVerifiedWallets: number;
  uniqueRevokedWallets: number;
  fromBlock: bigint;
};

function getFromBlock(): bigint {
  const raw =
    process.env.SEPOLIA_FROM_BLOCK ??
    process.env.NEXT_PUBLIC_SEPOLIA_FROM_BLOCK ??
    "10320000";

  try {
    return BigInt(raw);
  } catch {
    return BigInt("9981114");
  }
}

export async function fetchNetworkStatus(): Promise<NetworkStatus> {
  const verifierAddress = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS;
  const tokenAddress = process.env.NEXT_PUBLIC_CLPC_TOKEN_ADDRESS;

  if (!verifierAddress) throw new Error("Falta NEXT_PUBLIC_VERIFIER_ADDRESS");
  if (!tokenAddress) throw new Error("Falta NEXT_PUBLIC_CLPC_TOKEN_ADDRESS");

  const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  const client = createPublicClient({
    chain: sepolia,
    transport: rpc ? http(rpc) : http(),
  });

  const fromBlock = getFromBlock();

  const [chainId, latestBlock, mintingPaused, addedLogs, revokedLogs] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
    client.readContract({
      address: getAddress(tokenAddress),
      abi: tokenAbi,
      functionName: "mintingPaused",
    }),
    client.getLogs({
      address: getAddress(verifierAddress),
      event: addressVerifiedEvent,
      fromBlock,
      toBlock: "latest",
    }),
    client.getLogs({
      address: getAddress(verifierAddress),
      event: verificationRevokedEvent,
      fromBlock,
      toBlock: "latest",
    }),
  ]);

  const uniqueVerifiedWallets = new Set(
    addedLogs
      .map((l) => l.args.user)
      .filter((v): v is `0x${string}` => Boolean(v))
      .map((v) => v.toLowerCase())
  ).size;

  const uniqueRevokedWallets = new Set(
    revokedLogs
      .map((l) => l.args.user)
      .filter((v): v is `0x${string}` => Boolean(v))
      .map((v) => v.toLowerCase())
  ).size;

  return {
    chainId,
    latestBlock,
    mintingPaused,
    verifiedEvents: addedLogs.length,
    revokedEvents: revokedLogs.length,
    uniqueVerifiedWallets,
    uniqueRevokedWallets,
    fromBlock,
  };
}
