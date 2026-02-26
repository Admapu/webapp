# Admapu WebApp

Webapp mínima para conectar wallet y mostrar:

1. Si el usuario está verificado como chileno
2. El rango de edad del usuario
3. El balance de CLPc de la wallet
4. Botón de claim único (meta-tx ERC-2771) para CLPc

Stack: **Next.js + Privy + viem**, preparado para deploy en **Cloudflare Workers** con **OpenNext**.

## Requisitos

- Node.js 20+
- Cuenta en Privy (para `NEXT_PUBLIC_PRIVY_APP_ID`)
- Dirección del contrato Verifier en Sepolia (`NEXT_PUBLIC_VERIFIER_ADDRESS`)
- Dirección del token CLPc en Sepolia (`NEXT_PUBLIC_CLPC_TOKEN_ADDRESS`)

## Variables de entorno

Copia y completa:

```bash
cp .env.example .env.local
```

Variables:

- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_VERIFIER_ADDRESS`
- `NEXT_PUBLIC_CLPC_TOKEN_ADDRESS`
- `NEXT_PUBLIC_CLPC_CLAIM_ADDRESS`
- `NEXT_PUBLIC_FORWARDER_ADDRESS`
- `NEXT_PUBLIC_FORWARDER_NAME` (default `AdmapuForwarder`)
- `RELAYER_PRIVATE_KEY` (solo backend)
- `NEXT_PUBLIC_SEPOLIA_RPC_URL` (opcional)
- `NEXT_PUBLIC_SEPOLIA_FROM_BLOCK` (opcional, default `9981114`)

Direcciones Sepolia actuales:

- Verifier: `0xD51F4F3D2c35E51FD4Fda03D4Ae8A251801C9c94`
- Token: `0xfb43d4e4dBB4c444e7Dcd73A86e836EC7607f553`
- Claim: `0xe1c2dB0ea79f8b91991aC789E32A35E39D7d1fF7`

Claim en UI:
- El botón **Claim CLPc** aparece al iniciar sesión.
- Está habilitado solo para usuarios verificados.
- Requiere `NEXT_PUBLIC_CLPC_CLAIM_ADDRESS`, `NEXT_PUBLIC_FORWARDER_ADDRESS` y `RELAYER_PRIVATE_KEY`.
- El usuario firma typed data y el backend relayer paga gas vía `ERC2771Forwarder`.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir: `http://localhost:3000`

Endpoint/página pública nueva (sin login Privy):

- `http://localhost:3000/network-status`
  - estado de red + `mintingPaused` (similar a `make check-status`)
  - cantidad de eventos `AddressVerified` (similar a `make list-added`)
  - cantidad de eventos `VerificationRevoked` (similar a `make list-revoked`)

## Build Next.js (local)

```bash
npm run build
npm run start
```

## Deploy en Cloudflare Workers

### 1) Login en Cloudflare

```bash
npx wrangler login
```

### 2) Build para Workers (OpenNext)

```bash
npm run cf:build
```

### 3) Preview local del Worker

```bash
npm run cf:preview
```

### 4) Deploy

```bash
npm run cf:deploy
```

## Deploy CI (opcional)

Si usarás CI, define estos secretos/variables:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_VERIFIER_ADDRESS`
- `NEXT_PUBLIC_CLPC_TOKEN_ADDRESS`
- `NEXT_PUBLIC_CLPC_CLAIM_ADDRESS`
- `NEXT_PUBLIC_FORWARDER_ADDRESS`
- `NEXT_PUBLIC_FORWARDER_NAME`
- `RELAYER_PRIVATE_KEY`
- `NEXT_PUBLIC_SEPOLIA_RPC_URL` (opcional)

> Nota: Para este proyecto la ruta de entrada del Worker es `.open-next/worker.js` (configurado en `wrangler.jsonc`).
