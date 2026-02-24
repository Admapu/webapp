import Link from "next/link";
import { fetchNetworkStatus } from "@/lib/network-status";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NetworkStatusPage() {
  try {
    const status = await fetchNetworkStatus();

    return (
      <main className="landing">
        <div className="scene" aria-hidden="true" />
        <div className="network-overlay" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />

        <section className="glass-card">
          <div className="status-intro">
            <div className="lock-badge" aria-hidden="true">🌐</div>
            <div>
              <h1>Estado de red y verificación</h1>
            </div>
          </div>

          <div className="status-grid">
            <div className="split-row">
              <span className="label">Network</span>
              <strong>Sepolia (chainId {status.chainId})</strong>
            </div>

            <div className="split-row">
              <span className="label">Latest block</span>
              <strong>{status.latestBlock.toString()}</strong>
            </div>

            <div className="split-row">
              <span className="label">Bloque de inicio de consultas on-chain</span>
              <strong>{status.fromBlock.toString()}</strong>
            </div>

            <div className="split-row">
              <span className="label">Minting Paused</span>
              <strong>{String(status.mintingPaused)}</strong>
            </div>

            <div className="split-row">
              <span className="label">Usuarios únicos verificados</span>
              <strong>{status.uniqueVerifiedWallets}</strong>
            </div>

            <div className="split-row">
              <span className="label">Usuarios únicos revocados</span>
              <strong>{status.uniqueRevokedWallets}</strong>
            </div>
          </div>

          <div className="actions-row">
            <Link className="link-button" href="/">Volver al inicio</Link>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    return (
      <main className="landing">
        <div className="scene" aria-hidden="true" />
        <div className="network-overlay" aria-hidden="true" />
        <div className="vignette" aria-hidden="true" />

        <section className="glass-card">
          <div className="status-intro">
            <div className="lock-badge" aria-hidden="true">⚠️</div>
            <div>
              <h1>Error al consultar estado</h1>
              <p className="muted">No se pudo leer la información on-chain.</p>
            </div>
          </div>

          <p className="error">{error instanceof Error ? error.message : "Error desconocido"}</p>
          <div className="actions-row">
            <Link className="link-button" href="/">Volver al inicio</Link>
          </div>
        </section>
      </main>
    );
  }
}
