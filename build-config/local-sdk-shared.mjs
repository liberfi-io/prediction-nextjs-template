/**
 * Shared utilities for local-sdk link mode.
 *
 * Both the webpack alias generator (local-sdk-aliases.mjs) and the PostCSS
 * rewrite plugin (local-sdk-rewrite.mjs) read the same env variables and
 * scan the same react-sdk packages directory. This module centralises that
 * logic so the env gate and package discovery stay in sync.
 *
 * Activation rules (all must be true):
 *   1. USE_LOCAL_SDK=true        — explicit opt-in
 *   2. NODE_ENV !== "production" — double safety, prod never enables
 *   3. LOCAL_SDK_ROOT resolves to an existing react-sdk/packages/ dir
 */
import fs from "fs";
import path from "path";

/**
 * Returns `true` only when ALL gates are satisfied. Used by both the webpack
 * alias path and the PostCSS rewrite path so they activate together.
 *
 * @param {string|undefined} sdkRoot - Absolute path or undefined.
 */
export function isLocalSdkEnabled(sdkRoot) {
  if (process.env.USE_LOCAL_SDK !== "true") return false;
  if (process.env.NODE_ENV === "production") return false;
  if (!sdkRoot) return false;
  if (!fs.existsSync(path.join(sdkRoot, "packages"))) return false;
  return true;
}

/**
 * Resolve LOCAL_SDK_ROOT (relative to the caller's directory) into an
 * absolute path. Returns undefined when the env var is unset.
 *
 * @param {string} baseDir - Absolute dir to resolve LOCAL_SDK_ROOT against.
 *                           Typically the dir of next.config.mjs / postcss.config.mjs.
 * @param {string} [fallback] - Optional default (relative to baseDir) when
 *                              LOCAL_SDK_ROOT is unset but caller still wants
 *                              a sensible default.
 */
export function resolveSdkRoot(baseDir, fallback) {
  const raw = process.env.LOCAL_SDK_ROOT || fallback;
  if (!raw) return undefined;
  return path.resolve(baseDir, raw);
}

/**
 * Resolve a package.json "exports" condition value to a concrete file path.
 * Handles simple strings and nested condition objects like
 *   { import: { types: "...", default: "./dist/foo.mjs" }, require: { ... } }
 */
export function resolveExportTarget(value) {
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
 * Scan react-sdk/packages and return one descriptor per @liberfi.io/* package.
 * Returns [] when the directory does not exist.
 *
 * @typedef {Object} SdkPackage
 * @property {string} name      - npm name, e.g. "@liberfi.io/ui-tokens"
 * @property {string} dir       - absolute package directory
 * @property {string} dirName   - directory basename (e.g. "ui-tokens")
 * @property {object} pkgJson   - parsed package.json
 *
 * @param {string} sdkRoot - absolute path to react-sdk root
 * @returns {SdkPackage[]}
 */
export function scanSdkPackages(sdkRoot) {
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

    if (!pkgJson.name?.startsWith("@liberfi.io/")) continue;
    out.push({
      name: pkgJson.name,
      dir: path.join(packagesDir, entry.name),
      dirName: entry.name,
      pkgJson,
    });
  }
  return out;
}
