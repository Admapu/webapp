import type { Metadata } from "next";
import "./globals.css";
import { PrivyProviderClient } from "@/components/privy-provider";

export const metadata: Metadata = {
  title: "Admapu · Tu espacio digital",
  description: "Tu identidad chilena y tu balance CLPc, en un solo lugar.",
  icons: { icon: "/admapu-symbol.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#main">Saltar al contenido</a>
        <header className="site-header">
          <a className="wordmark" href="/" aria-label="Admapu, inicio">
            <img src="/admapu-symbol.svg" alt="" width="48" height="48" />
            <span>admapu<span className="brand-dot">.</span></span>
          </a>
          <nav className="site-nav" aria-label="Navegación principal">
            <a href="/network-status">Estado de red</a>
            <a href="https://admapu.xyz">Conoce el proyecto <span aria-hidden="true">→</span></a>
          </nav>
        </header>
        <PrivyProviderClient>{children}</PrivyProviderClient>
        <footer className="site-footer">
          <a className="footer-brand" href="/" aria-label="Admapu, inicio"><img src="/admapu-symbol.svg" alt="" width="30" height="30" />admapu.</a>
          <p>Tecnología con raíces. Hecha para explorar.</p>
          <span>Prueba de concepto · Sepolia</span>
        </footer>
      </body>
    </html>
  );
}
