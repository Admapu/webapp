import { WalletStatusClient } from "@/components/wallet-status-client";

export default function HomePage() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  return (
    <main className="landing">
      <div className="scene" aria-hidden="true" />
      <div className="network-overlay" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <section className="glass-card">
        <div className="status-intro">
          <div className="lock-badge" aria-hidden="true">🔒</div>
          <div>
            <h1>Wallet Connected</h1>
            <p className="muted">Estado de identidad chilena y balance CLPc on-chain.</p>
          </div>
        </div>

        {!appId ? (
          <p className="error">
            Falta <code>NEXT_PUBLIC_PRIVY_APP_ID</code>. Agrégalo en <code>.env.local</code> (o en Vercel) para habilitar el login.
          </p>
        ) : (
          <WalletStatusClient />
        )}
      </section>
    </main>
  );
}
