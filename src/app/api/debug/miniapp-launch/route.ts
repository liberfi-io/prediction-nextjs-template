import { NextRequest, NextResponse } from "next/server";

const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 20;
const MAX_DEPTH = 4;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) return "[depth-limit]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitize(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (key.toLowerCase().includes("hash")) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = sanitize(item, depth + 1);
    }
    return out;
  }

  return String(value).slice(0, MAX_STRING_LENGTH);
}

export async function POST(request: NextRequest) {
  let body: unknown = null;

  try {
    body = await request.json();
  } catch {
    body = { parseError: true };
  }

  console.info("[miniapp-launch-debug]", {
    at: new Date().toISOString(),
    userAgent: request.headers.get("user-agent")?.slice(0, MAX_STRING_LENGTH) ?? "",
    referer: request.headers.get("referer")?.slice(0, MAX_STRING_LENGTH) ?? "",
    body: sanitize(body),
  });

  return NextResponse.json({ ok: true });
}
