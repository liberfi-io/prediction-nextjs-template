import "../styles/globals.css";
import { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, DM_Sans } from "next/font/google";
import { defaultNS } from "@liberfi.io/i18n/server";
import { CONFIG } from "../config";
import { GoogleAnalytics } from "../components/GoogleAnalytics";
import { RootProviders } from "../components/RootProviders";
import { TelegramMiniAppSessionSync } from "../components/TelegramMiniAppSessionSync";
import { initServerI18n } from "../i18n/initServerI18n";
import { detectLanguage } from "../i18n/detectLanguage";

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-482RQNZD1J";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await detectLanguage();
  const i18n = await initServerI18n(locale);
  const t = i18n.getFixedT(locale, defaultNS);
  return {
    applicationName: CONFIG.branding.name,
    title: t("extend.title", { name: CONFIG.branding.name }),
    description: t("extend.description"),
    formatDetection: {
      date: false,
      email: false,
      address: false,
      url: false,
      telephone: false,
    },
    icons: {
      icon: {
        url: "/favicon.ico",
        sizes: "128x128",
        type: "image/x-icon",
      },
    },
  };
}

const inter = Inter({
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await detectLanguage();
  await initServerI18n(locale);
  return (
    <html
      lang={locale}
      className="dark"
      data-theme="liberfi"
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <body className={`${inter.className} ${dmSans.variable}`}>
        {/*
          Telegram WebApp SDK. It exposes `window.Telegram.WebApp` (ready()/
          expand(), initData, theme/viewport), which the Telegram client does
          NOT inject on its own — it only passes launch params via the URL hash.

          Self-hosted from `public/` instead of `telegram.org` on purpose: the
          official host is frequently slow/unreachable from inside the in-app
          proxy (a direct `curl telegram.org` from our network already fails),
          and a cross-origin SDK load is exactly what used to stall the app.
          Serving it same-origin makes it load fast and reliably.

          `afterInteractive` (not `beforeInteractive`): never make this script a
          render-blocking dependency. `beforeInteractive` would hold hydration
          hostage to the script — the original "spinner for minutes" bug. None
          of our critical paths need it ready synchronously: Privy reads the
          launch payload from the URL hash, and `start_param`/`initData` both
          have hash fallbacks (`readUrlStartParam` / `readTelegramInitData`).
          So the SDK loads in parallel and only powers ready()/expand() and the
          richer `initDataUnsafe` once available.

          To refresh: re-download `public/telegram-web-app.js` from
          https://telegram.org/js/telegram-web-app.js.
        */}
        <Script src="/telegram-web-app.js" strategy="afterInteractive" />
        {/*
          MPChat WebApp SDK. Keep this non-blocking for normal web traffic; the
          `/` launch redirect has URL fallbacks and a bounded MP-only retry for
          SDK-provided start params.

          To refresh: re-download `public/mpchat-web-app.js` from
          https://mp.net/i/mpchat-web-app.js.
        */}
        {process.env.NEXT_PUBLIC_ENABLE_MPCHAT_MINIAPP === "true" && (
          <Script src="/mpchat-web-app.js" strategy="afterInteractive" />
        )}
        <RootProviders locale={locale}>{children}</RootProviders>
        <TelegramMiniAppSessionSync />
        {process.env.NODE_ENV === "production" && (
          <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
