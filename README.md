# Prediction Nextjs Template

Standalone Next.js 15 (App Router) prediction market application powered by Liberfi. Supports browsing prediction events, placing trades, and managing USDC balances across Polymarket and Kalshi.

## Tech Stack

- **Next.js 15** (App Router, standalone output)
- **React 18** + TypeScript
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **HeroUI** component library
- **Privy** authentication (email, social, wallet)
- **Jotai** state management
- **TanStack React Query 5** data fetching
- **`@liberfi.io/ui-predict`** prediction market UI components
- **`@liberfi.io/react-predict`** prediction data hooks and client

## Getting Started

1. Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

2. Install dependencies:

```bash
pnpm install
```

3. Start development server:

```bash
pnpm dev
```

4. Build for production:

```bash
pnpm build
pnpm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout (font, metadata, providers)
│   ├── page.tsx            # Redirects to /predict
│   ├── predict/            # Prediction market pages
│   │   ├── page.tsx        # Events list (SSR prefetch)
│   │   ├── layout.tsx      # WebSocket connector
│   │   ├── loading.tsx     # List skeleton
│   │   └── [source]/[id]/  # Event detail (SSR prefetch)
│   └── api/auth/privy/     # Privy JWT auth endpoint
├── components/
│   ├── AppLayout.tsx       # Provider stack + Scaffold layout
│   ├── AuthProviders.tsx   # Privy wallet connector
│   ├── PredictAccountButton.tsx
│   ├── PredictDepositButton.tsx
│   └── page/               # Page-level client components
├── config.ts               # Branding config
├── i18n/                   # Server-side i18n setup
├── libs/                   # Client/server utilities
├── locales/                # Translation JSON (en, zh)
└── styles/                 # Tailwind globals + theme
```

## Environment Variables

See [`.env.example`](.env.example) for all required and optional environment variables.
