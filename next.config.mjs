import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve a package.json "exports" condition value to a concrete file path
 * string. Handles both simple strings and nested condition objects like
 * `{ import: { types: "...", default: "./dist/foo.mjs" }, require: { ... } }`.
 */
function resolveExportTarget(value) {
  if (typeof value === "string") return value;
  if (value == null || typeof value !== "object") return undefined;
  const entry = value.import ?? value.require ?? value.default;
  if (typeof entry === "string") return entry;
  if (entry != null && typeof entry === "object") {
    return entry.default ?? entry.types;
  }
  return undefined;
}

/**
 * When USE_LOCAL_SDK=true, scans LOCAL_SDK_ROOT/packages and returns webpack
 * resolve.alias entries that redirect every @liberfi.io/* import to the local
 * react-sdk dist output. Combined with `pnpm dev:watch` in react-sdk (which
 * runs tsup --watch for all packages), this gives live reload on SDK changes.
 */
function getLocalSdkAliases() {
  if (process.env.USE_LOCAL_SDK !== "true") return {};

  const sdkRoot = path.resolve(
    __dirname,
    process.env.LOCAL_SDK_ROOT || "../react-sdk",
  );
  const packagesDir = path.join(sdkRoot, "packages");

  if (!fs.existsSync(packagesDir)) {
    console.warn(`[local-sdk] packages dir not found: ${packagesDir}`);
    return {};
  }

  const aliases = {};

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgJsonPath = path.join(packagesDir, entry.name, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    const name = pkgJson.name;
    if (!name?.startsWith("@liberfi.io/")) continue;

    const pkgDir = path.join(packagesDir, entry.name);
    const srcIndex = ["src/index.tsx", "src/index.ts"].find((f) =>
      fs.existsSync(path.join(pkgDir, f)),
    );
    aliases[`${name}$`] = srcIndex
      ? path.join(pkgDir, srcIndex)
      : pkgDir;

    if (pkgJson.exports) {
      for (const [key, value] of Object.entries(pkgJson.exports)) {
        if (key === ".") continue;

        if (key.includes("*")) {
          // Wildcard export, e.g. "./locales/*": "./dist/locales/*"
          // Create a directory alias so webpack resolves sub-paths from local dist
          if (typeof value === "string") {
            const prefix = key.replace(/^\.\//, "").replace(/\/?\*$/, "");
            const targetDir = value.replace(/^\.\//, "").replace(/\/?\*$/, "");
            if (prefix && targetDir) {
              aliases[`${name}/${prefix}`] = path.join(pkgDir, targetDir);
            }
          }
          continue;
        }

        const subpath = key.replace(/^\.\//, "");
        const target = resolveExportTarget(value);
        if (target) {
          aliases[`${name}/${subpath}`] = path.join(
            pkgDir,
            target.replace(/^\.\//, ""),
          );
        }
      }
    }
  }

  console.log(
    `[local-sdk] Linked ${Object.keys(aliases).length} aliases from ${sdkRoot}`,
  );
  return aliases;
}

const localSdkAliases = getLocalSdkAliases();
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
    };

    config.resolve.alias = {
      ...config.resolve.alias,
      ...(useLocalSdk ? localSdkAliases : {}),
      ...singletonAliases,
    };

    if (useLocalSdk) {
      const sdkRoot = path.resolve(
        __dirname,
        process.env.LOCAL_SDK_ROOT || "../react-sdk",
      );
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          `!${path.join(sdkRoot, "packages")}/**`,
        ],
      };
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
