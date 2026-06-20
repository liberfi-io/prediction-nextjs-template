import { RecoveryProviders } from "../../components/RecoveryProviders";

/**
 * Layout for the wallet recovery route group. Mounts only the isolated
 * {@link RecoveryProviders} (native-Telegram Privy, no auto-login, no app
 * shell), structurally guaranteeing the main app's custom-JWT auto-login can
 * never race the recovery login here.
 */
export default function RecoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RecoveryProviders>{children}</RecoveryProviders>;
}
