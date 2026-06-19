import path from "path";
import { fileURLToPath } from "url";
import {
  getLocalSdkAliases,
  getLocalSdkWatchOptions,
} from "./build-config/local-sdk-aliases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default LOCAL_SDK_ROOT relative to repo root. Keep in sync with
// postcss.config.mjs so both pipelines resolve the same path.
const LOCAL_SDK_FALLBACK = "../react-sdk";

const localSdkAliases = getLocalSdkAliases({
  baseDir: __dirname,
  fallback: LOCAL_SDK_FALLBACK,
});
const useLocalSdk = Object.keys(localSdkAliases).length > 0;

/* eslint-disable no-undef */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/predict-api/:path*",
        destination: process.env.PREDICT_URL + "/:path*",
      },
    ];
  },
  webpack(config) {
    config.optimization.minimize = process.env.NODE_ENV === "production";

    const singletonAliases = {
      jotai: path.resolve(__dirname, "node_modules/jotai"),
      "@tanstack/react-query": path.resolve(
        __dirname,
        "node_modules/@tanstack/react-query",
      ),
      ...(useLocalSdk
        ? {
            "@privy-io/react-auth$": path.resolve(
              __dirname,
              "node_modules/@privy-io/react-auth",
            ),
            "@privy-io/react-auth/solana$": path.resolve(
              __dirname,
              "node_modules/@privy-io/react-auth/dist/esm/solana.mjs",
            ),
          }
        : {}),
    };

    config.resolve.alias = {
      ...config.resolve.alias,
      ...(useLocalSdk ? localSdkAliases : {}),
      ...singletonAliases,
    };

    if (useLocalSdk) {
      const localWatch = getLocalSdkWatchOptions({
        baseDir: __dirname,
        fallback: LOCAL_SDK_FALLBACK,
      });
      if (localWatch) {
        config.watchOptions = {
          ...config.watchOptions,
          ...localWatch,
        };
      }
    }

    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@farcaster/mini-app-solana": false,
    };

    config.module.rules.push({
      test: /\.svg$/i,
      use: [
        {
          loader: "@svgr/webpack",
          options: {
            svgoConfig: {
              plugins: [{ name: "prefixIds", active: false }],
            },
          },
        },
        "url-loader",
      ],
    });
    return config;
  },
};

export default nextConfig;
