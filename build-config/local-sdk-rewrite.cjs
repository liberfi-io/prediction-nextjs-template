/**
 * PostCSS plugin: rewrite Tailwind 4 `@import` / `@source` directives so they
 * point at the local react-sdk source tree instead of the published npm dist.
 *
 * Why CJS:
 *   Next.js's PostCSS loader (see next/dist/build/webpack/config/blocks/css
 *   /plugins.js) loads plugins via `require(require.resolve(name, {paths:[dir]}))`.
 *   That path requires CommonJS — `.mjs` files cannot be require()d.
 *   This file is the **runtime** plugin Next will load; helper logic is
 *   inlined here rather than imported from local-sdk-shared.mjs so the
 *   plugin stays self-contained and CJS-only.
 *
 * Why `Once` (not the PostCSS 8 `AtRule` visitor):
 *   Next.js wraps every plugin returned from postcss.config.mjs with its own
 *   `createLazyPostCssPlugin` (next/dist/build/webpack/config/blocks/css/plugins.js).
 *   That wrapper is a function with `.postcss = true` whose return value is the
 *   real plugin descriptor. PostCSS only auto-registers visitor entries
 *   (`AtRule.import`, `AtRule.source`, ...) when it sees the descriptor object
 *   directly — through Next's lazy wrapper, those visitors never fire on
 *   globals.css's @import / @source nodes, so dist→src rewrites silently
 *   no-op and Tailwind ends up loading the published @liberfi.io/ui dist
 *   (with stale theme tokens — e.g. content1 = #171816 instead of the local
 *   src #0e1211). The `Once` callback runs unconditionally, so we walk the
 *   tree manually and dispatch by AtRule name.
 *
 * Activation:
 *   No-op unless USE_LOCAL_SDK=true AND NODE_ENV !== "production" AND
 *   sdkRoot resolves to an existing packages/ dir. Safe to keep registered
 *   in postcss.config.mjs unconditionally.
 *
 * Rewrites:
 *   1. @import "@liberfi.io/<pkg>/<subpath>"
 *        Consults the package's `exports` field to find the dist target,
 *        then translates "./dist/foo.css" → "./src/foo.css".
 *   2. @source ".../node_modules/@liberfi.io/<pkg>/dist/**"
 *        Direct dist→src swap, anchored at `node_modules/@liberfi.io/`.
 */
const fs = require("fs");
const path = require("path");

const NPM_SCOPE = "@liberfi.io";

function isLocalSdkEnabled(sdkRoot) {
  if (process.env.USE_LOCAL_SDK !== "true") return false;
  if (process.env.NODE_ENV === "production") return false;
  if (!sdkRoot) return false;
  if (!fs.existsSync(path.join(sdkRoot, "packages"))) return false;
  return true;
}

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

function scanSdkPackages(sdkRoot) {
  const packagesDir = path.join(sdkRoot, "packages");
  if (!fs.existsSync(packagesDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgJsonPath = path.join(packagesDir, entry.name, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;
    let pkgJson;
    try {
      pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    } catch {
      continue;
    }
    if (!pkgJson.name || !pkgJson.name.startsWith(`${NPM_SCOPE}/`)) continue;
    out.push({
      name: pkgJson.name,
      dir: path.join(packagesDir, entry.name),
      pkgJson,
    });
  }
  return out;
}

function distTargetToSrc(target) {
  const clean = target.replace(/^\.\//, "");
  return clean.startsWith("dist/") ? clean.replace(/^dist\//, "src/") : clean;
}

function localSdkRewrite(options) {
  const opts = options || {};
  const sdkRoot = opts.sdkRoot;
  const enabled = isLocalSdkEnabled(sdkRoot);

  // Build a name→info map once so AtRule handlers can resolve packages in
  // O(1) without re-scanning the filesystem for every CSS file.
  const pkgInfoByName = new Map();
  if (enabled) {
    for (const { name, dir, pkgJson } of scanSdkPackages(sdkRoot)) {
      pkgInfoByName.set(name, { dir, exports: pkgJson.exports || null });
    }
    console.log(
      `[local-sdk-postcss] CSS rewrites enabled → ${sdkRoot} (${pkgInfoByName.size} packages)`,
    );
  }

  function rewriteImport(node) {
    const raw = node.params.trim().replace(/^['"]|['"]$/g, "");
    if (!raw.startsWith(`${NPM_SCOPE}/`)) return;

    // Longest-prefix match against known package names so e.g. "@liberfi.io/ui-tokens/..."
    // does not mis-match "@liberfi.io/ui".
    let matched;
    for (const name of pkgInfoByName.keys()) {
      if (raw === name || raw.startsWith(`${name}/`)) {
        if (!matched || name.length > matched.length) matched = name;
      }
    }
    if (!matched) return;

    const info = pkgInfoByName.get(matched);
    const pkgDir = info.dir;
    const exp = info.exports;
    const sub = raw.slice(matched.length).replace(/^\//, "");
    const exportKey = sub ? `./${sub}` : ".";

    // Try to resolve via package.json exports first — most faithful.
    // Fall back to assuming "<sub>" maps to "src/<sub>" when no exports
    // entry matches.
    let nextRel;
    if (exp && exp[exportKey] != null) {
      const target = resolveExportTarget(exp[exportKey]);
      if (target) nextRel = distTargetToSrc(target);
    }
    if (!nextRel) nextRel = sub ? `src/${sub}` : "src/tailwind/tailwind.css";

    node.params = `"${path.join(pkgDir, nextRel)}"`;
  }

  function rewriteSource(node) {
    const raw = node.params.trim().replace(/^['"]|['"]$/g, "");
    // Match a glob anchored at node_modules/@liberfi.io/<pkg>/dist/...
    const m = raw.match(/node_modules\/(@liberfi\.io\/[^/]+)\/dist\/(.*)$/);
    if (!m) return;
    const info = pkgInfoByName.get(m[1]);
    if (!info) return;
    node.params = `"${path.join(info.dir, "src", m[2])}"`;
  }

  return {
    postcssPlugin: "local-sdk-rewrite",
    // Run as a `Once` callback (not the PostCSS 8 `AtRule` visitor) — see
    // the file header for why visitors are silently skipped under Next.js.
    Once(root) {
      if (!enabled) return;
      root.walkAtRules((node) => {
        if (node.name === "import") rewriteImport(node);
        else if (node.name === "source") rewriteSource(node);
      });
    },
  };
}

localSdkRewrite.postcss = true;

module.exports = localSdkRewrite;
