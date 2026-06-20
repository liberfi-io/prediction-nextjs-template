import { AppLayout } from "../../components/AppLayout";

/**
 * Layout for the main authenticated app. Wraps every normal route in
 * {@link AppLayout} (Privy auth, Telegram/MPChat auto-login, predict services,
 * and the page chrome). The `/` launch splash and the `(recovery)` group are
 * deliberately OUTSIDE this group so they never mount the custom-JWT
 * auto-login.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
