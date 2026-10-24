import assert from "node:assert/strict";
import test from "node:test";
import { LEGACY_REDIRECTS } from "./legacy-redirects.mjs";

test("permanently redirects every legacy World Cup URL to Sports", () => {
  assert.deepEqual(LEGACY_REDIRECTS, [
    {
      source: "/world-cup/:path*",
      destination: "/sports",
      permanent: true,
    },
  ]);
});
