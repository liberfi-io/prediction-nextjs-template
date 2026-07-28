import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  isLocalSdkEnabled,
  resolveExportTarget,
  resolveSdkRoot,
  scanSdkPackages,
} from "../build-config/local-sdk-shared.mjs";

const rootDir = process.cwd();
const sdkRoot = resolveSdkRoot(rootDir, "../react-sdk");

function runTsc(args) {
  const result = spawnSync("tsc", args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(result.status ?? 1);
}

function srcIndex(pkgDir) {
  for (const rel of ["src/index.tsx", "src/index.ts", "src/index.js"]) {
    if (fs.existsSync(path.join(pkgDir, rel))) return path.join(pkgDir, rel);
  }
  return pkgDir;
}

function declarationIndex(pkgDir) {
  for (const rel of [
    `dist/${path.basename(pkgDir)}/src/index.d.ts`,
    "dist/index.d.ts",
    "dist/index.d.mts",
  ]) {
    if (fs.existsSync(path.join(pkgDir, rel))) return path.join(pkgDir, rel);
  }
  return srcIndex(pkgDir);
}

function declarationTarget(pkgDir, target) {
  const clean = target.replace(/^\.\//, "");
  const withoutRuntimeExtension = clean.replace(/\.(mjs|cjs|js)$/, "");
  for (const rel of [
    `${withoutRuntimeExtension}.d.ts`,
    `${withoutRuntimeExtension}.d.mts`,
    clean,
  ]) {
    if (fs.existsSync(path.join(pkgDir, rel))) return path.join(pkgDir, rel);
  }
  return path.join(pkgDir, clean);
}

function distTargetToSrc(pkgDir, target) {
  const clean = target.replace(/^\.\//, "");
  if (!clean.startsWith("dist/")) return undefined;

  const withoutExt = clean
    .replace(/^dist\//, "src/")
    .replace(/\.(mjs|cjs|js|d\.mts|d\.ts)$/, "");

  for (const ext of [".tsx", ".ts", ".js"]) {
    const candidate = path.join(pkgDir, `${withoutExt}${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const ext of [".tsx", ".ts", ".js"]) {
    const candidate = path.join(pkgDir, withoutExt, `index${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function toRootRelative(filePath) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function localSdkPaths() {
  const paths = {};
  const useDeclarations = process.env.LOCAL_SDK_TYPECHECK_USE_DIST === "true";
  const allowed = new Set(
    (
      process.env.LOCAL_SDK_TYPECHECK_EXPORTS ||
      "@liberfi.io/react-predict/server"
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  for (const { name, dir, pkgJson } of scanSdkPackages(sdkRoot)) {
    if (allowed.has(name)) {
      paths[name] = [
        toRootRelative(useDeclarations ? declarationIndex(dir) : srcIndex(dir)),
      ];
    }

    if (!pkgJson.exports) continue;
    for (const [key, value] of Object.entries(pkgJson.exports)) {
      if (key === ".") continue;
      const subpath = key.replace(/^\.\//, "");
      const publicExport = `${name}/${subpath}`;
      if (!allowed.has(name) && !allowed.has(publicExport)) continue;

      if (key.includes("*") && typeof value === "string") {
        const prefix = key.replace(/^\.\//, "").replace(/\/?\*$/, "");
        const targetDir = value.replace(/^\.\//, "").replace(/\/?\*$/, "");
        const srcDir = targetDir.startsWith("dist/")
          ? targetDir.replace(/^dist\//, "src/")
          : targetDir;
        paths[`${name}/${prefix}/*`] = [
          toRootRelative(path.join(dir, srcDir, "*")),
        ];
        continue;
      }

      const target = resolveExportTarget(value);
      if (!target) continue;
      if (useDeclarations) {
        paths[publicExport] = [toRootRelative(declarationTarget(dir, target))];
        continue;
      }
      const src = distTargetToSrc(dir, target);
      if (!src) continue;
      paths[publicExport] = [toRootRelative(src)];
    }
  }
  return paths;
}

if (!isLocalSdkEnabled(sdkRoot)) {
  runTsc(["--noEmit"]);
}

const generatedDir = path.join(rootDir, ".next", "cache");
fs.mkdirSync(generatedDir, { recursive: true });
const generatedConfig = path.join(generatedDir, "tsconfig.local-sdk.json");
fs.writeFileSync(
  generatedConfig,
  JSON.stringify(
    {
      extends: "../../tsconfig.json",
      compilerOptions: {
        baseUrl: "../..",
        paths: {
          "src/*": ["src/*"],
          ...localSdkPaths(),
        },
      },
    },
    null,
    2,
  ),
);

console.info(`[local-sdk] Typecheck paths enabled → ${sdkRoot}`);
runTsc(["--noEmit", "-p", generatedConfig]);
