import { HomeLaunchRedirect } from "src/components/page/HomeLaunchRedirect";

/**
 * Home route (`/`). A thin client-side redirect splash, not a content page: it
 * renders a launch spinner and resolves the Telegram `start_param` (client-only)
 * before `router.replace`-ing to the real destination (a World Cup deep link,
 * or `/sports` by default). The events market list lives at `/events`.
 *
 * No SSR data work here on purpose: the page's entire job is to redirect ASAP,
 * so any server prefetch only adds TTFB to the spinner. The `wd` matchId→slug
 * lookup is fetched on the client (`useWorldcupMatches`), and the server can't
 * see `start_param` anyway, so it could never prefetch the right thing.
 */
export default function Page() {
  return <HomeLaunchRedirect />;
}
