# Prediction Nextjs Template

Standalone Next.js 15 (App Router) prediction market application powered by Liberfi. Supports browsing prediction events, placing trades, managing positions, and tracking USDC balances across Polymarket and Kalshi.

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

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Markets | Prediction event list with categories, filters, and sorting |
| `/portfolio` | Portfolio | User positions, open orders, and trade history |
| `/[source]/[id]` | Event Detail | Single event with price chart, markets, and trade form |

## Project Structure

```
src/
├── app/                       # Next.js App Router pages
│   ├── layout.tsx             # Root layout (font, metadata, providers)
│   ├── page.tsx               # Markets page (events list, SSR prefetch)
│   ├── loading.tsx            # Markets skeleton
│   ├── portfolio/
│   │   ├── page.tsx           # Portfolio page
│   │   └── loading.tsx        # Portfolio skeleton
│   ├── [source]/[id]/         # Event detail (SSR prefetch)
│   │   ├── page.tsx
│   │   └── loading.tsx
│   └── api/auth/privy/        # Privy JWT auth endpoint
├── components/
│   ├── AppLayout.tsx          # Provider stack + Scaffold layout
│   ├── AuthProviders.tsx      # Privy wallet connector
│   ├── LanguageButton.tsx     # Language switcher (desktop header)
│   ├── PredictAccountButton.tsx # Account menu (balance, deposit, language on mobile)
│   ├── PredictDepositButton.tsx # Deposit popover (Polymarket / Kalshi)
│   └── page/                  # Page-level client components
│       ├── PredictListPage.tsx
│       ├── PredictDetailPage.tsx
│       ├── PredictPortfolioPage.tsx
│       └── predict-source.ts
├── config.ts                  # Branding config
├── i18n/                      # Server-side i18n setup
├── libs/                      # Client/server utilities
├── locales/                   # Translation JSON (en, zh)
└── styles/                    # Tailwind globals + theme
```

## Layout

### Desktop

```
[Logo] [Markets] [Portfolio]  [===== Search Bar =====]  [Deposit] [Language] [Account]
|                          Content Area                                              |
```

### Mobile

```
[Logo]  [===== Search Bar =====]  [Account]
|              Content Area                |
[    Markets Tab    |   Portfolio Tab      ]
```

On mobile, Deposit and Language controls are accessible via the Account dropdown menu.

## Environment Variables

See [`.env.example`](.env.example) for all required and optional environment variables.
