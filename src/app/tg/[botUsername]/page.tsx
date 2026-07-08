import { redirect } from "next/navigation";

const DEFAULT_TELEGRAM_MINI_APP_URL = "https://t.me/liberfi_live_bot/liberfi_prediction_app";

interface OperatorSourceResponse {
  success?: boolean;
  operator_segment?: string;
}

function cleanBotUsername(username: string): string {
  return decodeURIComponent(username).trim().replace(/^@/, "");
}

function miniAppURL(operatorSegment?: string): string {
  const url = new URL(
    process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_URL || DEFAULT_TELEGRAM_MINI_APP_URL,
  );
  if (operatorSegment) {
    url.searchParams.set("startapp", `v1-${operatorSegment}`);
  }
  return url.toString();
}

async function operatorSegmentFor(username: string): Promise<string | undefined> {
  const baseUrl = process.env.TG_BOT_S2S_URL;
  const token = process.env.TG_BOT_S2S_API_TOKEN;
  if (!baseUrl?.trim() || !token?.trim()) return undefined;

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/s2s/operator/source`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ operator_bot_username: username }),
      cache: "no-store",
    },
  );
  if (!response.ok) return undefined;
  const body = (await response.json().catch(() => ({}))) as OperatorSourceResponse;
  return body.success && body.operator_segment ? body.operator_segment : undefined;
}

export default async function TelegramBotLandingPage({
  params,
}: {
  params: Promise<{ botUsername: string }>;
}) {
  const { botUsername } = await params;
  const operatorSegment = await operatorSegmentFor(cleanBotUsername(botUsername));
  redirect(miniAppURL(operatorSegment));
}
