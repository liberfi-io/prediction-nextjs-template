import { TelegramBotLanding } from "src/features/telegram-miniapp/TelegramBotLanding";

export default async function TelegramBotLandingPage({
  params,
}: {
  params: Promise<{ botUsername: string }>;
}) {
  const { botUsername } = await params;
  return <TelegramBotLanding botUsername={botUsername} />;
}
