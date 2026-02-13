import { WalletStatusClient } from "@/components/wallet-status-client";

export default function HomePage() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  return (
    <main className="container">
      <div className="card">
        <h1>Admapu WebApp</h1>
        <p className="muted">Connect your wallet to check Chilean verification and age status.</p>

        {!appId ? (
          <p className="error">
            Missing NEXT_PUBLIC_PRIVY_APP_ID. Add it in <code>.env.local</code> (or Vercel env vars) to enable login.
          </p>
        ) : (
          <WalletStatusClient />
        )}
      </div>
    </main>
  );
}
