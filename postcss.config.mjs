import path from "path";
import { fileURLToPath } from "url";
import { resolveSdkRoot } from "./build-config/local-sdk-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Keep this in sync with LOCAL_SDK_FALLBACK in next.config.mjs.
const LOCAL_SDK_FALLBACK = "../react-sdk";

const sdkRoot = resolveSdkRoot(__dirname, LOCAL_SDK_FALLBACK);
const isProd = process.env.NODE_ENV === "production";

// Next.js's PostCSS loader requires plugin entries to be string/tuple/object
// form (NOT raw plugin instances) and loads them via require(). See
// the dex template's postcss.config.mjs for the full explanation.
export default {
  plugins: {
    "./build-config/local-sdk-rewrite.cjs": { sdkRoot },
    "@tailwindcss/postcss": {},
    ...(isProd ? { cssnano: {} } : {}),
  },
};
