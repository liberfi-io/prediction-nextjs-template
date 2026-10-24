/** Merge Prediction API credentials with per-request language and upstream headers. */
export function predictApiHeaders(input?: HeadersInit): Record<string, string> {
  const headers = new Headers(input);
  const key = typeof window === "undefined"
    ? process.env.PREDICT_API_KEY || process.env.NEXT_PUBLIC_PREDICT_API_KEY
    : process.env.NEXT_PUBLIC_PREDICT_API_KEY;
  if (key) headers.set("X-API-Key", key);
  return Object.fromEntries(headers);
}
