/**
 * Webpack `resolve.alias` generator for local-sdk link mode.
 *
 * Strategy: src-pointing.
 *   Every @liberfi.io/* root import is redirected to the package's
 *   src/index.{tsx,ts} entry, and subpath exports are translated from
 *   "./dist/<rel>.js" to "./src/<rel>.{tsx,ts}" when the src twin exists.
 *   Next.js's SWC loader compiles the SDK source on demand, so SDK edits
 *   are picked up immediately — no `tsup --watch` rebuild loop required.
 *
 * Falls back to the dist target when the src equivalent does not exist
 * (e.g. wildcard exports like @liberfi.io/i18n's "./locales/*" point at
 * build-time-generated JSON that has no src twin).
 *
 * Returns `{}` (a no-op alias map) when link mode is disabled, so the
 * caller can spread it unconditionally.
 */
import fs from "fs";
import path from "path";
import {
  isLocalSdkEnabled,
  resolveExportTarget,
  resolveSdkRoot,
  scanSdkPackages,
} from "./local-sdk-shared.mjs";

// Extensions we try when translating a dist target (e.g. "./dist/foo.js")
// into its src twin ("./src/foo.tsx"). Order matters — first existing wins.
const SRC_EXT_CANDIDATES = [".tsx", ".ts", ".js"];

/**
 * Translate a dist-relative target (e.g. "./dist/client/index.js") into the
 * best matching src file path relative to pkgDir, or `undefined` when no
 * src twin exists on disk. Wildcard / non-dist targets are returned as-is.
 */
function distTargetToSrc(pkgDir, target) {
  const distRel = target.replace(/^\.\//, "");
  if (!distRel.startsWith("dist/")) return undefined;

  const withoutExt = distRel
    .replace(/^dist\//, "src/")
    .replace(/\.(js|mjs|cjs|d\.ts)$/, "");

  // Try src/foo.tsx, src/foo.ts, src/foo.js then src/foo/index.tsx, etc.
  for (const ext of SRC_EXT_CANDIDATES) {
    const candidate = `${withoutExt}${ext}`;
    if (fs.existsSync(path.join(pkgDir, candidate))) return candidate;
  }
  for (const ext of SRC_EXT_CANDIDATES) {
    const candidate = `${withoutExt}/index${ext}`;
    if (fs.existsSync(path.join(pkgDir, candidate))) return candidate;
  }
  return undefined;
}

/**
 * @param {object} options
 * @param {string} options.baseDir   - Absolute dir of next.config.mjs.
 * @param {string} [options.fallback] - Default LOCAL_SDK_ROOT relative to baseDir.
 */
export function getLocalSdkAliases({ baseDir, fallback } = {}) {
  const sdkRoot = resolveSdkRoot(baseDir, fallback);
  if (!isLocalSdkEnabled(sdkRoot)) return {};

  const aliases = {};
  for (const { name, dir: pkgDir, pkgJson } of scanSdkPackages(sdkRoot)) {
    // Root alias: prefer src/index.{tsx,ts}; fall back to pkgDir (which then
    // resolves via package.json "main"/"exports" to dist).
    const srcIndex = ["src/index.tsx", "src/index.ts"].find((f) =>
      fs.existsSync(path.join(pkgDir, f)),
    );
    aliases[`${name}$`] = srcIndex ? path.join(pkgDir, srcIndex) : pkgDir;

    if (!pkgJson.exports) continue;

    for (const [key, value] of Object.entries(pkgJson.exports)) {
      if (key === ".") continue;

      if (key.includes("*")) {
        // Wildcard export — keep pointing at dist. These are typically
        // build-time-generated artifacts (e.g. @liberfi.io/i18n's
        // "./locales/*": "./dist/locales/*") that have no src twin.
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
      if (!target) continue;

      // Prefer src twin; fall back to dist when src is missing.
      const srcRel = distTargetToSrc(pkgDir, target);
      const finalRel = srcRel || target.replace(/^\.\//, "");
      aliases[`${name}/${subpath}`] = path.join(pkgDir, finalRel);
    }
  }

  console.log(
    `[local-sdk] Linked ${Object.keys(aliases).length} aliases from ${sdkRoot} (src-pointing)`,
  );
  return aliases;
}

/**
 * Compute watchOptions.ignored entries that narrow webpack's watcher to
 * react-sdk/packages/<pkg>/src only. Since we alias to src directly,
 * dist changes are irrelevant — we watch src/ exclusively.
 *
 * @param {object} options
 * @param {string} options.baseDir
 * @param {string} [options.fallback]
 * @returns {{ aggregateTimeout: number, ignored: string[] } | undefined}
 *          `undefined` when link mode is disabled (caller leaves webpack defaults).
 */
export function getLocalSdkWatchOptions({ baseDir, fallback } = {}) {
  const sdkRoot = resolveSdkRoot(baseDir, fallback);
  if (!isLocalSdkEnabled(sdkRoot)) return undefined;

  return {
    aggregateTimeout: 300,
    ignored: [
      "**/node_modules/**",
      // Only listen to src/ of every react-sdk package — dist is no
      // longer on the resolution path.
      `!${path.join(sdkRoot, "packages/*/src/**")}`,
    ],
  };
}
