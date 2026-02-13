"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { sepolia } from "viem/chains";

export function PrivyProviderClient({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#4f46e5",
          logo: undefined,
        },
        defaultChain: sepolia,
        supportedChains: [sepolia],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
