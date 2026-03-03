"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  recoverTypedDataAddress,
} from "viem";

import { sepolia } from "viem/chains";
import { fetchUserStatus, fetchUserTransfers, type UserStatus, type UserTransfer } from "@/lib/verifier";

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

const tokenAbi = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
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
  const [sending, setSending] = useState(false);
  const [openingReceive, setOpeningReceive] = useState(false);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [transfers, setTransfers] = useState<UserTransfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  const wallet = useMemo(() => wallets[0], [wallets]);
  const walletAddress = useMemo(() => wallet?.address, [wallet]);
  const tokenAddress = process.env.NEXT_PUBLIC_CLPC_TOKEN_ADDRESS;
  const claimAddress = process.env.NEXT_PUBLIC_CLPC_CLAIM_ADDRESS;
  const forwarderAddress = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS;
  const forwarderName = process.env.NEXT_PUBLIC_FORWARDER_NAME ?? "AdmapuForwarder";
  const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

  async function refreshStatus(address: string) {
    setLoading(true);
    setLoadingTxs(true);
    setError(null);

    try {
      const [result, txs] = await Promise.all([
        fetchUserStatus(address),
        fetchUserTransfers(address),
      ]);
      setStatus(result);
      setTransfers(txs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar el estado on-chain");
      setStatus(null);
      setTransfers([]);
    } finally {
      setLoading(false);
      setLoadingTxs(false);
    }
  }

  useEffect(() => {
    if (!authenticated || !walletAddress) {
      setStatus(null);
      setTransfers([]);
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
              request: (args: { method: string; params?: unknown }) => Promise<unknown>;
            })
          : ((await wallet.getEthereumProvider()) as {
              request: (args: { method: string; params?: unknown }) => Promise<unknown>;
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

  async function handleSendCLPc() {
    if (!walletAddress || !wallet) {
      setClaimMessage("No hay wallet conectada.");
      return;
    }
    if (!tokenAddress) {
      setClaimMessage("Falta NEXT_PUBLIC_CLPC_TOKEN_ADDRESS.");
      return;
    }

    const toInput = window.prompt("Dirección destino (0x...):");
    if (!toInput) return;

    const amountInput = window.prompt("Monto CLPc a enviar (ej: 10.5):");
    if (!amountInput) return;

    try {
      setSending(true);
      setClaimMessage(null);

      const provider =
        typeof window !== "undefined" && (window as { ethereum?: unknown }).ethereum
          ? ((window as { ethereum?: unknown }).ethereum as {
              request: (args: { method: string; params?: unknown }) => Promise<unknown>;
            })
          : ((await wallet.getEthereumProvider()) as {
              request: (args: { method: string; params?: unknown }) => Promise<unknown>;
            });

      const chainHex = await provider.request({ method: "eth_chainId" });
      const chainId = Number.parseInt(String(chainHex), 16);
      if (chainId !== sepolia.id) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${sepolia.id.toString(16)}` }],
        });
      }

      const client = createPublicClient({
        chain: sepolia,
        transport: rpc ? http(rpc) : http(),
      });
      const decimals = await client.readContract({
        address: getAddress(tokenAddress),
        abi: tokenAbi,
        functionName: "decimals",
      });

      const to = getAddress(toInput.trim());
      const amountBase = parseUnits(amountInput.trim(), decimals);
      const transferData = encodeFunctionData({
        abi: tokenAbi,
        functionName: "transfer",
        args: [to, amountBase],
      });

      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: walletAddress,
            to: getAddress(tokenAddress),
            data: transferData,
          },
        ],
      });

      await client.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      setClaimMessage(`✅ Envío realizado: ${formatUnits(amountBase, decimals)} CLP`);
      await refreshStatus(walletAddress);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo enviar CLPc";
      setClaimMessage(`❌ ${message}`);
    } finally {
      setSending(false);
    }
  }

  async function handleReceiveCLPc() {
    if (!walletAddress || !wallet) {
      setClaimMessage("No hay wallet conectada.");
      return;
    }

    try {
      setOpeningReceive(true);
      const provider =
        typeof window !== "undefined" && (window as { ethereum?: unknown }).ethereum
          ? ((window as { ethereum?: unknown }).ethereum as {
              request: (args: { method: string; params?: unknown }) => Promise<unknown>;
            })
          : ((await wallet.getEthereumProvider()) as {
              request: (args: { method: string; params?: unknown }) => Promise<unknown>;
            });

      await provider.request({ method: "eth_requestAccounts" });

      if (tokenAddress) {
        await provider.request({
          method: "wallet_watchAsset",
          params: {
            type: "ERC20",
            options: {
              address: getAddress(tokenAddress),
              symbol: "CLPc",
              decimals: 8,
            },
          },
        });
      }

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(walletAddress);
      }
      setClaimMessage("✅ Wallet abierto. Tu dirección fue copiada para recibir CLPc.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo abrir wallet";
      setClaimMessage(`❌ ${message}`);
    } finally {
      setOpeningReceive(false);
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

      <div className="tx-history">
        <h3>Historial de transacciones</h3>
        {loadingTxs ? (
          <p className="muted small">Cargando transacciones...</p>
        ) : transfers.length === 0 ? (
          <p className="muted small">
            Sin transacciones desde el bloque {process.env.NEXT_PUBLIC_TX_HISTORY_FROM_BLOCK ?? "10320000"}.
          </p>
        ) : (
          <div className="tx-list">
            {transfers.map((tx, idx) => (
              <div className="tx-row" key={`${tx.txHash}-${tx.direction}-${idx}`}>
                <span className={`tx-badge ${tx.direction}`}>{tx.direction === "in" ? "IN" : "OUT"}</span>
                <span className="tx-amount">{tx.amount} CLP</span>
                <code className="tx-counterparty">{tx.counterparty}</code>
                <a
                  className="tx-link"
                  href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  tx
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="actions-row">
        <button onClick={handleSendCLPc} disabled={sending || !status?.verified}>
          {sending ? "Abriendo wallet..." : "Enviar CLPc"}
        </button>

        <button className="secondary" onClick={handleReceiveCLPc} disabled={openingReceive}>
          {openingReceive ? "Abriendo wallet..." : "Recibir CLPc"}
        </button>

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
