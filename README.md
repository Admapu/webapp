# Admapu WebApp

Webapp mínima para conectar wallet y mostrar:

1. Si el usuario está verificado como chileno
2. El rango de edad del usuario
3. El balance de CLPc de la wallet

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
- `NEXT_PUBLIC_SEPOLIA_RPC_URL` (opcional)

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir: `http://localhost:3000`

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
- `NEXT_PUBLIC_SEPOLIA_RPC_URL` (opcional)

> Nota: Para este proyecto la ruta de entrada del Worker es `.open-next/worker.js` (configurado en `wrangler.jsonc`).
