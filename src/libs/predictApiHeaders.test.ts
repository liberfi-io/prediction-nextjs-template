/** @jest-environment node */
import { predictApiHeaders } from "./predictApiHeaders";

const original = process.env.PREDICT_API_KEY;
afterEach(() => { if (original === undefined) delete process.env.PREDICT_API_KEY; else process.env.PREDICT_API_KEY = original; });

test("SSR merges its API key with language and upstream signature headers", () => {
  process.env.PREDICT_API_KEY = "self-service-key";
  expect(predictApiHeaders({ "Accept-Language": "zh", POLY_SIGNATURE: "sig" })).toEqual({
    "accept-language": "zh", poly_signature: "sig", "x-api-key": "self-service-key",
  });
});
