import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  recoverTypedDataAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import { erc20Abi, forwarderAbi } from "@/lib/abi";
import { getSepoliaPublicClient, getSepoliaRpcUrl } from "@/lib/server/sepolia";

type RelayTransferRequest = {
  from?: string;
  to?: string;
  amount?: string;
  nonce?: string;
  gas?: string;
  deadline?: string;
  signature?: string;
};

function friendlyTransferError(message: string): { status: number; error: string } {
  if (message.includes("0x3c7f73d1")) {
    return { status: 409, error: "Recipient wallet is not verified to receive CLPc." };
  }

  if (message.includes("0x63d9b285")) {
    return { status: 409, error: "Sender wallet is not verified to transfer CLPc." };
  }

  if (message.includes("0xe450d38c")) {
    return { status: 409, error: "Insufficient CLPc balance for this transfer." };
  }

  return { status: 500, error: message };
}

export async function POST(req: NextRequest) {
  try {
    const relayPk = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
    const forwarderAddress = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS;
    const forwarderName = process.env.NEXT_PUBLIC_FORWARDER_NAME ?? "AdmapuForwarder";
    const tokenAddress = process.env.NEXT_PUBLIC_CLPC_TOKEN_ADDRESS;

    if (!relayPk) {
      return NextResponse.json({ error: "Missing RELAYER_PRIVATE_KEY" }, { status: 500 });
    }
    if (!forwarderAddress || !tokenAddress) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_FORWARDER_ADDRESS or NEXT_PUBLIC_CLPC_TOKEN_ADDRESS" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as RelayTransferRequest;
    if (
      !body.from ||
      !body.to ||
      !body.amount ||
      !body.nonce ||
      !body.gas ||
      !body.deadline ||
      !body.signature
    ) {
      return NextResponse.json({ error: "Invalid relay payload" }, { status: 400 });
    }

    const from = getAddress(body.from);
    const to = getAddress(body.to);
    const forwarder = getAddress(forwarderAddress);
    const token = getAddress(tokenAddress);
    const amount = BigInt(body.amount);
    const nonce = BigInt(body.nonce);
    const gas = BigInt(body.gas);
    const deadline = BigInt(body.deadline);

    if (amount <= BigInt(0)) {
      return NextResponse.json({ error: "Transfer amount must be greater than zero." }, { status: 400 });
    }

    const account = privateKeyToAccount(relayPk);
    const rpc = getSepoliaRpcUrl();
    const transport = rpc ? http(rpc) : http();
    const publicClient = getSepoliaPublicClient();
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport,
    });

    const currentNonce = await publicClient.readContract({
      address: forwarder,
      abi: forwarderAbi,
      functionName: "nonces",
      args: [from],
    });

    if (currentNonce !== nonce) {
      return NextResponse.json(
        { error: `Invalid nonce. expected=${currentNonce.toString()} got=${nonce.toString()}` },
        { status: 409 }
      );
    }

    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount],
    });

    const request = {
      from,
      to: token,
      value: BigInt(0),
      gas,
      deadline: Number(deadline),
      data: transferData,
      signature: body.signature as `0x${string}`,
    } as const;

    const isValid = await publicClient.readContract({
      address: forwarder,
      abi: forwarderAbi,
      functionName: "verify",
      args: [request],
    });

    if (!isValid) {
      const recovered = await recoverTypedDataAddress({
        domain: {
          name: forwarderName,
          version: "1",
          chainId: sepolia.id,
          verifyingContract: forwarder,
        },
        types: {
          ForwardRequest: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "gas", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint48" },
            { name: "data", type: "bytes" },
          ],
        },
        primaryType: "ForwardRequest",
        message: {
          from,
          to: token,
          value: BigInt(0),
          gas,
          nonce,
          deadline: Number(deadline),
          data: transferData,
        },
        signature: body.signature as `0x${string}`,
      });

      return NextResponse.json(
        {
          error: "Forwarder.verify returned false",
          debug: {
            expectedFrom: from,
            recoveredSigner: recovered,
            nonce: nonce.toString(),
            currentNonce: currentNonce.toString(),
            deadline: deadline.toString(),
            now: Math.floor(Date.now() / 1000).toString(),
            forwarder,
            token,
            transferTo: to,
            transferAmount: amount.toString(),
            forwarderName,
          },
        },
        { status: 400 }
      );
    }

    const hash = await walletClient.writeContract({
      address: forwarder,
      abi: forwarderAbi,
      functionName: "execute",
      args: [request],
      value: BigInt(0),
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({ txHash: hash });
  } catch (error) {
    const message = error instanceof Error ? error.message : "relay failed";
    const friendly = friendlyTransferError(message);
    return NextResponse.json({ error: friendly.error }, { status: friendly.status });
  }
}
