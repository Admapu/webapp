"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, encodeFunctionData, http } from "viem";
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

    try {
      setClaiming(true);
      setClaimMessage(null);
      setError(null);

      const provider = await wallet.getEthereumProvider();
      const txData = encodeFunctionData({
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

      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: walletAddress,
            to: claimAddress,
            data: txData,
          },
        ],
      });

      const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
      const client = createPublicClient({
        chain: sepolia,
        transport: rpc ? http(rpc) : http(),
      });

      await client.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
      });

      setClaimMessage("✅ Claim ejecutado correctamente.");
      await refreshStatus(walletAddress);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo ejecutar claim()";
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
