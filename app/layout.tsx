import type { Metadata } from "next";
import "./globals.css";
import { PrivyProviderClient } from "@/components/privy-provider";

export const metadata: Metadata = {
  title: "Admapu WebApp",
  description: "Wallet login and identity status for CLPc",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrivyProviderClient>{children}</PrivyProviderClient>
      </body>
    </html>
  );
}
