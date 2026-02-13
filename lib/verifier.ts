import { createPublicClient, getAddress, http } from "viem";
import { sepolia } from "viem/chains";

const verifierAbi = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isVerified",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isOver18",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "isOver65",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export type UserStatus = {
  verified: boolean;
  over18: boolean;
  over65: boolean;
  ageLabel: string;
};

export async function fetchUserStatus(userAddress: string): Promise<UserStatus> {
  const verifierAddress = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS;
  if (!verifierAddress) {
    throw new Error("Missing NEXT_PUBLIC_VERIFIER_ADDRESS");
  }

  const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  const client = createPublicClient({
    chain: sepolia,
    transport: rpc ? http(rpc) : http(),
  });

  const [verified, over18, over65] = await Promise.all([
    client.readContract({
      address: getAddress(verifierAddress),
      abi: verifierAbi,
      functionName: "isVerified",
      args: [getAddress(userAddress)],
    }),
    client.readContract({
      address: getAddress(verifierAddress),
      abi: verifierAbi,
      functionName: "isOver18",
      args: [getAddress(userAddress)],
    }),
    client.readContract({
      address: getAddress(verifierAddress),
      abi: verifierAbi,
      functionName: "isOver65",
      args: [getAddress(userAddress)],
    }),
  ]);

  const ageLabel = over65 ? "65+" : over18 ? "18-64" : "<18";

  return { verified, over18, over65, ageLabel };
}
