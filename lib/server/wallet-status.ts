import "server-only";

import { formatUnits, getAddress } from "viem";

import { erc20Abi, transportAbi, type WalletSnapshot, verifierAbi } from "@/lib/abi";
import { getSepoliaPublicClient } from "@/lib/server/sepolia";

export type NetworkStatus = {
  chainId: number;
  latestBlock: bigint;
  mintingPaused: boolean;
  fromBlock: bigint;
};

function getNetworkFromBlock(): bigint {
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

export async function fetchWalletSnapshot(userAddress: string): Promise<WalletSnapshot> {
  const verifierAddress = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS;
  if (!verifierAddress) {
    throw new Error("Falta NEXT_PUBLIC_VERIFIER_ADDRESS");
  }

  const tokenAddress = process.env.NEXT_PUBLIC_CLPC_TOKEN_ADDRESS;
  const transportAddress = process.env.NEXT_PUBLIC_TRANSPORT_ADDRESS;
  const client = getSepoliaPublicClient();
  const user = getAddress(userAddress);
  const verifier = getAddress(verifierAddress);
  const token = tokenAddress ? getAddress(tokenAddress) : null;
  const transport = transportAddress ? getAddress(transportAddress) : null;

  const statusContracts = [
    {
      address: verifier,
      abi: verifierAbi,
      functionName: "isVerified" as const,
      args: [user] as const,
    },
    {
      address: verifier,
      abi: verifierAbi,
      functionName: "isOver18" as const,
      args: [user] as const,
    },
    {
      address: verifier,
      abi: verifierAbi,
      functionName: "isOver65" as const,
      args: [user] as const,
    },
  ];

  const [statusResult, transportResult, tokenResult] = await Promise.all([
    client.multicall({
      contracts: statusContracts,
      allowFailure: false,
    }),
    transportAddress
      ? client.multicall({
          contracts: [
            {
              address: transport!,
              abi: transportAbi,
              functionName: "eligibleSchoolTransport",
              args: [user] as const,
            },
            {
              address: transport!,
              abi: transportAbi,
              functionName: "currentPeriod",
            },
          ],
          allowFailure: false,
        })
      : Promise.resolve(null),
    tokenAddress
      ? client.multicall({
          contracts: [
            {
              address: token!,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [user] as const,
            },
            {
              address: token!,
              abi: erc20Abi,
              functionName: "decimals",
            },
          ],
          allowFailure: false,
        })
      : Promise.resolve(null),
  ]);

  const [verified, over18, over65] = statusResult;
  const ageLabel = over65 ? "65+" : over18 ? "18-64" : "<18";
  let schoolTransport = false;
  let transportClaimedCurrentPeriod = false;

  let clpcBalance = "No configurado";

  if (transportResult) {
    const [transportEligible, currentPeriod] = transportResult;
    schoolTransport = transportEligible;

    transportClaimedCurrentPeriod = await client.readContract({
      address: transport!,
      abi: transportAbi,
      functionName: "claimedByPeriod",
      args: [user, currentPeriod],
    });
  }

  if (tokenResult) {
    const [rawBalance, tokenDecimals] = tokenResult;
    clpcBalance = formatUnits(rawBalance, tokenDecimals);
  }

  return {
    status: { verified, over18, over65, ageLabel, schoolTransport, transportClaimedCurrentPeriod, clpcBalance },
  };
}

export async function fetchForwarderNonce(userAddress: string): Promise<bigint> {
  const forwarderAddress = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS;
  if (!forwarderAddress) {
    throw new Error("Falta NEXT_PUBLIC_FORWARDER_ADDRESS");
  }

  const client = getSepoliaPublicClient();
  return client.readContract({
    address: getAddress(forwarderAddress),
    abi: [
      {
        inputs: [{ name: "owner", type: "address" }],
        name: "nonces",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "nonces",
    args: [getAddress(userAddress)],
  });
}

export async function fetchNetworkStatus(): Promise<NetworkStatus> {
  const tokenAddress = process.env.NEXT_PUBLIC_CLPC_TOKEN_ADDRESS;

  if (!tokenAddress) throw new Error("Falta NEXT_PUBLIC_CLPC_TOKEN_ADDRESS");

  const client = getSepoliaPublicClient();
  const fromBlock = getNetworkFromBlock();

  const [chainId, latestBlock, mintingPaused] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
    client.readContract({
      address: getAddress(tokenAddress),
      abi: erc20Abi,
      functionName: "mintingPaused",
    }),
  ]);

  return {
    chainId,
    latestBlock,
    mintingPaused,
    fromBlock,
  };
}
