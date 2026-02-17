"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { fetchUserStatus, type UserStatus } from "@/lib/verifier";

export function WalletStatusClient() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = useMemo(() => wallets[0]?.address, [wallets]);

  useEffect(() => {
    if (!authenticated || !walletAddress) {
      setStatus(null);
      setError(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    fetchUserStatus(walletAddress)
      .then((result) => {
        if (mounted) setStatus(result);
      })
      .catch((e) => {
        if (mounted) {
          setError(e instanceof Error ? e.message : "No se pudo consultar el estado on-chain");
          setStatus(null);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [authenticated, walletAddress]);

  return (
    <>
      {!ready ? (
        <p>Cargando Privy...</p>
      ) : !authenticated ? (
        <button onClick={login}>Iniciar sesión con wallet</button>
      ) : (
        <>
          <div className="row">
            <span className="label">Wallet</span>
            <code>{walletAddress}</code>
          </div>

          {loading && <p>Consultando estado on-chain...</p>}
          {error && <p className="error">{error}</p>}

          {status && (
            <>
              <div className="row">
                <span className="label">Usuario chileno verificado</span>
                <strong>{status.verified ? "Sí" : "No"}</strong>
              </div>
              <div className="row">
                <span className="label">Edad</span>
                <strong>{status.ageLabel}</strong>
              </div>
              <div className="row">
                <span className="label">Balance CLPc</span>
                <strong>{status.clpcBalance}</strong>
              </div>
              <p className="muted small">
                Flags del verificador: mayor18={String(status.over18)}, mayor65={String(status.over65)}
              </p>
            </>
          )}

          <button className="secondary" onClick={logout}>Cerrar sesión</button>
        </>
      )}
    </>
  );
}
