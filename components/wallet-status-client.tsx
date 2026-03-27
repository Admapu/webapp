"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  getAddress,
  isAddress,
  parseUnits,
  recoverTypedDataAddress,
} from "viem";
import { sepolia } from "viem/chains";

import { claimAbi, erc20Abi, transportAbi, type UserStatus, type WalletSnapshot } from "@/lib/abi";

const CLPC_DECIMALS = 8;

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const walletSnapshotRequests = new Map<string, Promise<WalletSnapshot>>();

async function fetchWalletSnapshot(address: string): Promise<WalletSnapshot> {
  const normalizedAddress = getAddress(address);
  const existing = walletSnapshotRequests.get(normalizedAddress);
  if (existing) {
    return existing;
  }

  const request = fetch(`/api/wallet-status/${normalizedAddress}`, {
    cache: "no-store",
  }).then(async (res) => {
    const body = (await res.json()) as WalletSnapshot & { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "No se pudo consultar el estado on-chain");
    }
    return body;
  });

  walletSnapshotRequests.set(normalizedAddress, request);

  try {
    return await request;
  } finally {
    walletSnapshotRequests.delete(normalizedAddress);
  }
}

async function fetchForwarderNonce(address: string): Promise<bigint> {
  const res = await fetch(`/api/claim/prepare?address=${address}`, {
    cache: "no-store",
  });
  const body = (await res.json()) as { nonce?: string; error?: string };
  if (!res.ok || !body.nonce) {
    throw new Error(body.error ?? "No se pudo preparar la meta-transaccion");
  }
  return BigInt(body.nonce);
}

export function WalletStatusClient() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimingTransport, setClaimingTransport] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [transportClaimMessage, setTransportClaimMessage] = useState<string | null>(null);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const wallet = useMemo(() => wallets[0], [wallets]);
  const walletAddress = useMemo(() => wallet?.address, [wallet]);
  const claimAddress = process.env.NEXT_PUBLIC_CLPC_CLAIM_ADDRESS;
  const transportAddress = process.env.NEXT_PUBLIC_TRANSPORT_ADDRESS;
  const tokenAddress = process.env.NEXT_PUBLIC_CLPC_TOKEN_ADDRESS;
  const forwarderAddress = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS;
  const forwarderName = process.env.NEXT_PUBLIC_FORWARDER_NAME ?? "AdmapuForwarder";

  async function refreshStatus(address: string) {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchWalletSnapshot(address);
      setStatus(result.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar el estado on-chain");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  async function getSigningContext() {
    if (!walletAddress || !wallet) {
      throw new Error("No hay wallet conectada.");
    }

    const provider = (await wallet.getEthereumProvider()) as EthereumProvider;
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
    const connectedWalletAddress = getAddress(walletAddress);

    if (signerAddress !== connectedWalletAddress) {
      throw new Error(
        `La firma se intento con otra cuenta. wallet=${connectedWalletAddress} signer=${signerAddress}`
      );
    }

    return { provider, signerAddress };
  }

  async function signForwardRequest(params: {
    provider: EthereumProvider;
    signerAddress: `0x${string}`;
    targetAddress: string;
    data: `0x${string}`;
    nonce: bigint;
    gas: bigint;
    deadline: bigint;
  }) {
    if (!forwarderAddress) {
      throw new Error("Falta NEXT_PUBLIC_FORWARDER_ADDRESS.");
    }

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
        from: params.signerAddress,
        to: getAddress(params.targetAddress),
        value: BigInt(0),
        gas: params.gas,
        nonce: params.nonce,
        deadline: Number(params.deadline),
        data: params.data,
      },
    } as const;

    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(params.provider),
    });

    const signatureHex = await walletClient.signTypedData({
      account: params.signerAddress,
      domain: typedData.domain,
      types: typedData.types,
      primaryType: "ForwardRequest",
      message: typedData.message,
    });

    const recovered = await recoverTypedDataAddress({
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
      signature: signatureHex,
    });

    if (getAddress(recovered) !== params.signerAddress) {
      throw new Error(
        `Firma invalida para signer activo. signer=${params.signerAddress} recovered=${getAddress(recovered)}`
      );
    }

    return signatureHex;
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
    if (!claimAddress) {
      setClaimMessage("Falta NEXT_PUBLIC_CLPC_CLAIM_ADDRESS.");
      return;
    }

    try {
      setClaiming(true);
      setClaimMessage(null);
      setTransportClaimMessage(null);
      setTransferMessage(null);
      setError(null);

      const { provider, signerAddress } = await getSigningContext();
      const claimData = encodeFunctionData({
        abi: claimAbi,
        functionName: "claim",
      });
      const nonce = await fetchForwarderNonce(signerAddress);
      const gas = BigInt(300_000);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      const signatureHex = await signForwardRequest({
        provider,
        signerAddress,
        targetAddress: claimAddress,
        data: claimData,
        nonce,
        gas,
        deadline,
      });

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
        };
      };

      if (!relayRes.ok || !relayBody.txHash) {
        const debug = relayBody.debug
          ? ` expectedFrom=${relayBody.debug.expectedFrom} recoveredSigner=${relayBody.debug.recoveredSigner} nonce=${relayBody.debug.nonce}/${relayBody.debug.currentNonce} deadline=${relayBody.debug.deadline} now=${relayBody.debug.now}`
          : "";
        throw new Error(`${relayBody.error ?? "No se pudo relayer la transaccion"}${debug}`);
      }

      setClaimMessage("✅ Claim ejecutado por relayer (usuario sin gas).");
      await refreshStatus(signerAddress);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo ejecutar claim por relay";
      setClaimMessage(`❌ ${message}`);
    } finally {
      setClaiming(false);
    }
  }

  async function handleTransportClaim() {
    if (!transportAddress) {
      setTransportClaimMessage("Falta NEXT_PUBLIC_TRANSPORT_ADDRESS.");
      return;
    }

    try {
      setClaimingTransport(true);
      setTransportClaimMessage(null);
      setClaimMessage(null);
      setTransferMessage(null);
      setError(null);

      if (!status?.schoolTransport) {
        throw new Error("Solo usuarios habilitados en transporte escolar pueden reclamar este beneficio.");
      }
      if (status.transportClaimedCurrentPeriod) {
        throw new Error("El beneficio de transporte ya fue reclamado en el periodo actual.");
      }

      const { provider, signerAddress } = await getSigningContext();
      const claimData = encodeFunctionData({
        abi: transportAbi,
        functionName: "claim",
      });
      const nonce = await fetchForwarderNonce(signerAddress);
      const gas = BigInt(300_000);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      const signatureHex = await signForwardRequest({
        provider,
        signerAddress,
        targetAddress: transportAddress,
        data: claimData,
        nonce,
        gas,
        deadline,
      });

      const relayRes = await fetch("/api/transport/relay", {
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
        };
      };

      if (!relayRes.ok || !relayBody.txHash) {
        const debug = relayBody.debug
          ? ` expectedFrom=${relayBody.debug.expectedFrom} recoveredSigner=${relayBody.debug.recoveredSigner} nonce=${relayBody.debug.nonce}/${relayBody.debug.currentNonce} deadline=${relayBody.debug.deadline} now=${relayBody.debug.now}`
          : "";
        throw new Error(`${relayBody.error ?? "No se pudo relayer el beneficio de transporte"}${debug}`);
      }

      setTransportClaimMessage("✅ Beneficio de transporte ejecutado por relayer (usuario sin gas).");
      await refreshStatus(signerAddress);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo ejecutar el beneficio de transporte";
      setTransportClaimMessage(`❌ ${message}`);
    } finally {
      setClaimingTransport(false);
    }
  }

  async function handleTransfer() {
    if (!tokenAddress) {
      setTransferMessage("Falta NEXT_PUBLIC_CLPC_TOKEN_ADDRESS.");
      return;
    }

    try {
      setTransferring(true);
      setTransferMessage(null);
      setClaimMessage(null);
      setError(null);

      if (!status?.verified) {
        throw new Error("Solo wallets verificadas pueden transferir CLPc.");
      }

      if (!transferTo.trim() || !isAddress(transferTo.trim())) {
        throw new Error("Ingresa una wallet destino valida.");
      }

      const recipient = getAddress(transferTo.trim());
      const recipientSnapshot = await fetchWalletSnapshot(recipient);
      if (!recipientSnapshot.status.verified) {
        throw new Error("La wallet destino no esta verificada para recibir CLPc.");
      }

      if (!transferAmount.trim()) {
        throw new Error("Ingresa un monto a transferir.");
      }

      const parsedAmount = parseUnits(transferAmount.trim(), CLPC_DECIMALS);
      if (parsedAmount <= BigInt(0)) {
        throw new Error("El monto debe ser mayor a cero.");
      }

      const { provider, signerAddress } = await getSigningContext();
      const nonce = await fetchForwarderNonce(signerAddress);
      const gas = BigInt(300_000);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      const transferData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient, parsedAmount],
      });

      const signatureHex = await signForwardRequest({
        provider,
        signerAddress,
        targetAddress: tokenAddress,
        data: transferData,
        nonce,
        gas,
        deadline,
      });

      const relayRes = await fetch("/api/transfer/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: signerAddress,
          to: recipient,
          amount: parsedAmount.toString(),
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
        };
      };

      if (!relayRes.ok || !relayBody.txHash) {
        const debug = relayBody.debug
          ? ` expectedFrom=${relayBody.debug.expectedFrom} recoveredSigner=${relayBody.debug.recoveredSigner} nonce=${relayBody.debug.nonce}/${relayBody.debug.currentNonce} deadline=${relayBody.debug.deadline} now=${relayBody.debug.now}`
          : "";
        throw new Error(`${relayBody.error ?? "No se pudo relayer la transferencia"}${debug}`);
      }

      setTransferMessage("✅ Transferencia ejecutada por relayer (usuario sin gas).");
      setTransferAmount("");
      await refreshStatus(signerAddress);
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo ejecutar la transferencia";
      setTransferMessage(`❌ ${message}`);
    } finally {
      setTransferring(false);
    }
  }

  if (!ready) return <p>Cargando Privy...</p>;

  if (!authenticated) {
    return <button onClick={login}>Iniciar sesion con wallet</button>;
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
          <div className="split-row">
            <span className="label">Transporte Escolar</span>
            <strong>{status.schoolTransport ? "true" : "false"}</strong>
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
      {transportClaimMessage && (
        <p className={transportClaimMessage.startsWith("✅") ? "success" : "error"}>{transportClaimMessage}</p>
      )}

      <div className="panel">
        <h3>Transferencias</h3>
        <p className="muted small">
          Info: Firma la transferencia y el relayer paga el gas. Emisor y receptor deben estar verificados.
        </p>

        <div className="form-grid">
          <label className="field">
            <span>Wallet destino</span>
            <input
              type="text"
              inputMode="text"
              placeholder="0x..."
              value={transferTo}
              onChange={(event) => setTransferTo(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Monto CLPc</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="10"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
            />
          </label>
        </div>

        {transferMessage && (
          <p className={transferMessage.startsWith("✅") ? "success" : "error"}>{transferMessage}</p>
        )}

        <div className="actions-row compact">
          <button
            onClick={handleTransfer}
            disabled={transferring || !status?.verified || !transferTo.trim() || !transferAmount.trim()}
            title={!status?.verified ? "Solo usuarios verificados pueden transferir" : undefined}
          >
            {transferring ? "Procesando transferencia..." : "Transferir CLPc sin gas"}
          </button>
        </div>
      </div>

      <div className="actions-row">
        <button
          onClick={handleTransportClaim}
          disabled={claimingTransport || !status?.schoolTransport || !!status?.transportClaimedCurrentPeriod}
          title={
            !status?.schoolTransport
              ? "Solo usuarios habilitados en transporte escolar pueden reclamar este beneficio"
              : status?.transportClaimedCurrentPeriod
                ? "Beneficio ya reclamado en el periodo actual"
                : undefined
          }
        >
          {claimingTransport ? "Procesando transporte..." : "Claim Transporte Escolar"}
        </button>

        <button
          onClick={handleClaim}
          disabled={claiming || !status?.verified}
          title={!status?.verified ? "Solo usuarios verificados pueden reclamar" : undefined}
        >
          {claiming ? "Procesando claim..." : "Claim CLPc"}
        </button>

        <button className="secondary" onClick={logout}>Cerrar sesion</button>
      </div>
    </>
  );
}
