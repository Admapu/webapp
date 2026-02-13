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
          setError(e instanceof Error ? e.message : "Could not fetch on-chain status");
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
        <p>Loading Privy...</p>
      ) : !authenticated ? (
        <button onClick={login}>Login with wallet</button>
      ) : (
        <>
          <div className="row">
            <span className="label">Wallet</span>
            <code>{walletAddress}</code>
          </div>

          {loading && <p>Fetching on-chain status...</p>}
          {error && <p className="error">{error}</p>}

          {status && (
            <>
              <div className="row">
                <span className="label">Chilean verified</span>
                <strong>{status.verified ? "Yes" : "No"}</strong>
              </div>
              <div className="row">
                <span className="label">Age</span>
                <strong>{status.ageLabel}</strong>
              </div>
              <p className="muted small">
                Derived from verifier flags: over18={String(status.over18)}, over65={String(status.over65)}
              </p>
            </>
          )}

          <button className="secondary" onClick={logout}>Logout</button>
        </>
      )}
    </>
  );
}
