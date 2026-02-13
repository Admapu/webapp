# Admapu WebApp

Minimal webapp to connect a wallet and show:

1. Whether the user is a Chilean verified user
2. The age bracket of the user (derived from verifier flags)

Built with **Next.js + Privy + viem**.

## Requirements

- Node.js 20+
- A Privy app (for `NEXT_PUBLIC_PRIVY_APP_ID`)
- Sepolia verifier contract address (`NEXT_PUBLIC_VERIFIER_ADDRESS`)

## Local run

```bash
cp .env.example .env.local
# fill env vars in .env.local

npm install
npm run dev
```

Open: `http://localhost:3000`

## Build

```bash
npm run build
npm run start
```

## Vercel deployment

Deploy as a standard Next.js app.

Set these Environment Variables in Vercel project settings:

- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_VERIFIER_ADDRESS`
- `NEXT_PUBLIC_SEPOLIA_RPC_URL` (optional)

Then deploy from the repo (main branch or PR previews).
