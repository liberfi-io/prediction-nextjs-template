/**
 * Tab identifiers shared by the server route and the client page (server-safe).
 * `map` is intentionally omitted for now (hidden); `MapTab` stays on disk and
 * `/world-cup/map` normalizes back to Today until it is re-enabled.
 */
export const WC_TABS = ["today", "games", "props", "groups", "bracket"] as const;

export type WcTab = (typeof WC_TABS)[number];

export function normalizeTab(raw?: string): WcTab {
  return (WC_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as WcTab)
    : "today";
}
