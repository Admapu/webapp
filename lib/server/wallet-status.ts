import "server-only";

import { formatUnits, getAddress } from "viem";

import {
  addressVerifiedEvent,
  erc20Abi,
  transferEvent,
  type UserTransfer,
  type WalletSnapshot,
  verifierAbi,
  verificationRevokedEvent,
} from "@/lib/abi";
import { getSepoliaPublicClient } from "@/lib/server/sepolia";

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

function getTxHistoryFromBlock(): bigint {
  const raw = process.env.NEXT_PUBLIC_TX_HISTORY_FROM_BLOCK ?? "10320000";
  try {
    return BigInt(raw);
  } catch {
    return BigInt("10320000");
  }
}

function getTxHistoryLimit(): number {
  const raw = process.env.NEXT_PUBLIC_TX_HISTORY_LIMIT ?? "10";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return parsed;
}

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

type TransferWithBlockNumber = Omit<UserTransfer, "blockNumber"> & {
  blockNumber: bigint;
};

function formatTransfers(transfers: TransferWithBlockNumber[], limit: number): UserTransfer[] {
  transfers.sort((a, b) => {
    if (a.blockNumber > b.blockNumber) return -1;
    if (a.blockNumber < b.blockNumber) return 1;
    return 0;
  });

  return transfers.slice(0, limit).map((transfer) => ({
    ...transfer,
    blockNumber: transfer.blockNumber.toString(),
  }));
}

export async function fetchWalletSnapshot(userAddress: string): Promise<WalletSnapshot> {
  const verifierAddress = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS;
  if (!verifierAddress) {
    throw new Error("Falta NEXT_PUBLIC_VERIFIER_ADDRESS");
  }

  const tokenAddress = process.env.NEXT_PUBLIC_CLPC_TOKEN_ADDRESS;
  const client = getSepoliaPublicClient();
  const user = getAddress(userAddress);
  const verifier = getAddress(verifierAddress);

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

  const [
    statusResult,
    tokenResult,
    incoming,
    outgoing,
  ] = await Promise.all([
    client.multicall({
      contracts: statusContracts,
      allowFailure: false,
    }),
    tokenAddress
      ? client.multicall({
          contracts: [
            {
              address: getAddress(tokenAddress),
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [user] as const,
            },
            {
              address: getAddress(tokenAddress),
              abi: erc20Abi,
              functionName: "decimals",
            },
          ],
          allowFailure: false,
        })
      : Promise.resolve(null),
    tokenAddress
      ? client.getLogs({
          address: getAddress(tokenAddress),
          event: transferEvent,
          args: { to: user },
          fromBlock: getTxHistoryFromBlock(),
          toBlock: "latest",
        })
      : Promise.resolve([]),
    tokenAddress
      ? client.getLogs({
          address: getAddress(tokenAddress),
          event: transferEvent,
          args: { from: user },
          fromBlock: getTxHistoryFromBlock(),
          toBlock: "latest",
        })
      : Promise.resolve([]),
  ]);

  const [verified, over18, over65] = statusResult;
  const ageLabel = over65 ? "65+" : over18 ? "18-64" : "<18";

  let clpcBalance = "No configurado";
  let decimals = 18;

  if (tokenResult) {
    const [rawBalance, tokenDecimals] = tokenResult;
    decimals = tokenDecimals;
    clpcBalance = formatUnits(rawBalance, tokenDecimals);
  }

  const transfers = formatTransfers(
    [
      ...incoming.map((log) => ({
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        direction: "in" as const,
        from: getAddress(log.args.from ?? "0x0000000000000000000000000000000000000000"),
        to: getAddress(log.args.to ?? user),
        amount: formatUnits(log.args.value ?? BigInt(0), decimals),
      })),
      ...outgoing.map((log) => ({
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        direction: "out" as const,
        from: getAddress(log.args.from ?? user),
        to: getAddress(log.args.to ?? "0x0000000000000000000000000000000000000000"),
        amount: formatUnits(log.args.value ?? BigInt(0), decimals),
      })),
    ],
    getTxHistoryLimit()
  );

  return {
    status: { verified, over18, over65, ageLabel, clpcBalance },
    transfers,
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
  const verifierAddress = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS;
  const tokenAddress = process.env.NEXT_PUBLIC_CLPC_TOKEN_ADDRESS;

  if (!verifierAddress) throw new Error("Falta NEXT_PUBLIC_VERIFIER_ADDRESS");
  if (!tokenAddress) throw new Error("Falta NEXT_PUBLIC_CLPC_TOKEN_ADDRESS");

  const client = getSepoliaPublicClient();
  const fromBlock = getNetworkFromBlock();

  const [chainId, latestBlock, mintingPaused, addedLogs, revokedLogs] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
    client.readContract({
      address: getAddress(tokenAddress),
      abi: erc20Abi,
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
      .map((log) => log.args.user)
      .filter((value): value is `0x${string}` => Boolean(value))
      .map((value) => value.toLowerCase())
  ).size;

  const uniqueRevokedWallets = new Set(
    revokedLogs
      .map((log) => log.args.user)
      .filter((value): value is `0x${string}` => Boolean(value))
      .map((value) => value.toLowerCase())
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
