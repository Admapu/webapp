import { SessionBackground } from "@/components/session-background";
import { WalletStatusClient } from "@/components/wallet-status-client";

export default function HomePage() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  return (
    <main id="main" className="landing">
      <SessionBackground />

      <section className="glass-card">
        <div className="status-intro">
          <div className="lock-badge" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/></svg></div>
          <div>
            <p className="eyebrow">Identidad · Wallet · CLPc</p>
            <h1>Tu espacio Admapu.</h1>
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
