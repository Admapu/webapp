import { WalletStatusClient } from "@/components/wallet-status-client";

export default function HomePage() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  return (
    <main className="container">
      <div className="card">
        <h1>Admapu WebApp</h1>
        <p className="muted">Conecta tu wallet para revisar verificación chilena, edad y saldo CLPc.</p>

        {!appId ? (
          <p className="error">
            Falta <code>NEXT_PUBLIC_PRIVY_APP_ID</code>. Agrégalo en <code>.env.local</code> (o en Vercel) para habilitar el login.
          </p>
        ) : (
          <WalletStatusClient />
        )}
      </div>
    </main>
  );
}
