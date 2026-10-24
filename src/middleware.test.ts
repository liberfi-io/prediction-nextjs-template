/** @jest-environment node */
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

test("same-origin rewrites receive the configured service key", () => {
  const saved = process.env.PREDICT_API_KEY;
  process.env.PREDICT_API_KEY = "self-service-key";
  try {
    const response = middleware(new NextRequest("https://app.test/predict-api/api/v1/orders", {
      headers: { "X-API-Key": "caller-key", POLY_SIGNATURE: "signed", "Accept-Language": "zh" },
    }));
    expect(response.headers.get("x-middleware-request-x-api-key")).toBe("self-service-key");
    expect(response.headers.get("x-middleware-request-poly_signature")).toBe("signed");
    expect(response.headers.get("x-middleware-request-accept-language")).toBe("zh");
  } finally {
    if (saved === undefined) delete process.env.PREDICT_API_KEY;
    else process.env.PREDICT_API_KEY = saved;
  }
});
