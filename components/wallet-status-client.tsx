"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  getAddress,
  http,
  recoverTypedDataAddress,
} from "viem";

import { sepolia } from "viem/chains";
import { fetchUserStatus, type UserStatus } from "@/lib/verifier";

const claimAbi = [
  {
    inputs: [],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const forwarderAbi = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "nonces",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;


export function WalletStatusClient() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  const wallet = useMemo(() => wallets[0], [wallets]);
  const walletAddress = useMemo(() => wallet?.address, [wallet]);
  const claimAddress = process.env.NEXT_PUBLIC_CLPC_CLAIM_ADDRESS;
  const forwarderAddress = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS;
  const forwarderName = process.env.NEXT_PUBLIC_FORWARDER_NAME ?? "AdmapuForwarder";
  const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

  async function refreshStatus(address: string) {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchUserStatus(address);
      setStatus(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar el estado on-chain");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authenticated || !walletAddress) {
      setStatus(null);
      setError(null);
      return;
    }

    refreshStatus(walletAddress);
  }, [authenticated, walletAddress]);

  async function handleClaim() {
    if (!walletAddress || !wallet) {
      setClaimMessage("No hay wallet conectada.");
      return;
    }

    if (!claimAddress) {
      setClaimMessage("Falta NEXT_PUBLIC_CLPC_CLAIM_ADDRESS.");
      return;
    }
    if (!forwarderAddress) {
      setClaimMessage("Falta NEXT_PUBLIC_FORWARDER_ADDRESS.");
      return;
    }


    try {
      setClaiming(true);
      setClaimMessage(null);
      setError(null);

      const provider =
        typeof window !== "undefined" && (window as { ethereum?: unknown }).ethereum
          ? ((window as { ethereum?: unknown }).ethereum as {
              request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            })
          : ((await wallet.getEthereumProvider()) as {
              request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
            });
      const claimData = encodeFunctionData({

        abi: claimAbi,
        functionName: "claim",
      });

      const chainHex = await provider.request({ method: "eth_chainId" });
      const chainId = Number.parseInt(String(chainHex), 16);

      if (chainId !== sepolia.id) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${sepolia.id.toString(16)}` }],
        });
      }

      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const signerAddress = getAddress(accounts[0]);


      const client = createPublicClient({
        chain: sepolia,
        transport: rpc ? http(rpc) : http(),
      });
      const nonce = await client.readContract({
        address: getAddress(forwarderAddress),
        abi: forwarderAbi,
        functionName: "nonces",
        args: [signerAddress],
      });

      const gas = BigInt(300_000);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      const deadlineNumber = Number(deadline);

      const typedData = {
        domain: {
          name: forwarderName,
          version: "1",
          chainId: sepolia.id,
          verifyingContract: getAddress(forwarderAddress),
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
          from: signerAddress,
          to: getAddress(claimAddress),
          value: BigInt(0),
          gas,
          nonce,
          deadline: deadlineNumber,
          data: claimData,
        },
      } as const;

      // eth_signTypedData_v4 expects JSON-serializable values.
      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      });
      const signatureHex = await walletClient.signTypedData({
        account: signerAddress,
        domain: typedData.domain,
        types: typedData.types,
        primaryType: "ForwardRequest",
        message: typedData.message,
      });

      // Local sanity check to prevent opaque 400 errors from the relay endpoint.
      const recovered = await recoverTypedDataAddress({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: "ForwardRequest",
        message: typedData.message,
        signature: signatureHex,
      });
      if (getAddress(recovered) !== signerAddress) {
        throw new Error(
          `Firma invalida para signer activo. signer=${signerAddress} recovered=${getAddress(recovered)}`
        );
      }

      const relayRes = await fetch("/api/claim/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: signerAddress,
          nonce: nonce.toString(),
          gas: gas.toString(),
          deadline: deadline.toString(),
          signature: signatureHex,
        }),
      });

      const relayBody = (await relayRes.json()) as {
        txHash?: string;
        error?: string;
        debug?: {
          expectedFrom?: string;
          recoveredSigner?: string;
          nonce?: string;
          currentNonce?: string;
          deadline?: string;
          now?: string;
          forwarder?: string;
          claim?: string;
          forwarderName?: string;
        };
      };
      if (!relayRes.ok || !relayBody.txHash) {
        const debug = relayBody.debug
          ? ` expectedFrom=${relayBody.debug.expectedFrom} recoveredSigner=${relayBody.debug.recoveredSigner} nonce=${relayBody.debug.nonce}/${relayBody.debug.currentNonce} deadline=${relayBody.debug.deadline} now=${relayBody.debug.now}`
          : "";
        throw new Error(`${relayBody.error ?? "No se pudo relayer la transaccion"}${debug}`);
      }

      await client.waitForTransactionReceipt({
        hash: relayBody.txHash as `0x${string}`,
      });

      setClaimMessage("✅ Claim ejecutado por relayer (usuario sin gas).");
      await refreshStatus(walletAddress);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo ejecutar claim por relay";

      setClaimMessage(`❌ ${message}`);
    } finally {
      setClaiming(false);
    }
  }

  if (!ready) return <p>Cargando Privy...</p>;

  if (!authenticated) {
    return <button onClick={login}>Iniciar sesión con wallet</button>;
  }

  return (
    <>
      <div className="split-row wallet-row">
        <span className="label">Wallet</span>
        <code>{walletAddress}</code>
      </div>

      {loading && <p>Consultando estado on-chain...</p>}
      {error && <p className="error">{error}</p>}

      {status && (
        <div className="status-grid">
          <div className="split-row">
            <span className="label">Verificado</span>
            <strong>{status.verified ? "true" : "false"}</strong>
          </div>
          <div className="split-row">
            <span className="label">Edad</span>
            <strong>{status.ageLabel}</strong>
          </div>
          <div className="split-row balance-row">
            <span className="label">Saldo CLPc</span>
            <strong className="balance-value">{status.clpcBalance} CLP</strong>
          </div>
          <p className="muted small">
            Flags del verificador: mayor18={String(status.over18)}, mayor65={String(status.over65)}
          </p>
        </div>
      )}

      {claimMessage && <p className={claimMessage.startsWith("✅") ? "success" : "error"}>{claimMessage}</p>}

      <div className="actions-row">
        <button
          onClick={handleClaim}
          disabled={claiming || !status?.verified}
          title={!status?.verified ? "Solo usuarios verificados pueden reclamar" : undefined}
        >
          {claiming ? "Procesando claim..." : "Claim CLPc"}
        </button>

        <button className="secondary" onClick={logout}>Cerrar sesión</button>
      </div>
    </>
  );
}
