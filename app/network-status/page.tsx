import Link from "next/link";
import { fetchNetworkStatus } from "@/lib/server/wallet-status";

export const revalidate = 60;

const BLOCKSCOUT_BASE = "https://eth-sepolia.blockscout.com/address";

function ContractRow({ label, address }: { label: string; address: string | null }) {
  if (!address) {
    return (
      <div className="split-row">
        <span className="label">{label}</span>
        <span className="muted">No configurado</span>
      </div>
    );
  }

  return (
    <div className="split-row">
      <span className="label">{label}</span>
      <a
        className="contract-link"
        href={`${BLOCKSCOUT_BASE}/${address}`}
        target="_blank"
        rel="noreferrer noopener"
      >
        <code>{address}</code>
      </a>
    </div>
  );
}

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
          </div>

          <div className="panel">
            <h3>Direcciones de Contratos</h3>
            <div className="status-grid">
              <ContractRow label="Token (CLPc)" address={status.contracts.token} />
              <ContractRow label="Claim" address={status.contracts.claim} />
              <ContractRow label="Verifier" address={status.contracts.verifier} />
              <ContractRow label="Transport" address={status.contracts.transport} />
              <ContractRow label="Forwarder" address={status.contracts.forwarder} />
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
