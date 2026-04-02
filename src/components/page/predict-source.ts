import type { ProviderSource } from "@liberfi.io/react-predict";

export type DisplaySource = "kalshi" | "polymarket";

const DISPLAY_TO_API: Record<DisplaySource, ProviderSource> = {
  kalshi: "dflow",
  polymarket: "polymarket",
};

const API_TO_DISPLAY: Record<ProviderSource, DisplaySource> = {
  dflow: "kalshi",
  polymarket: "polymarket",
};

export function toApiSource(display: string): ProviderSource {
  return DISPLAY_TO_API[display as DisplaySource] ?? (display as ProviderSource);
}

export function toDisplaySource(api: ProviderSource): DisplaySource {
  return API_TO_DISPLAY[api] ?? (api as DisplaySource);
}

export function predictEventHref(event: { slug: string; source: ProviderSource }): string {
  return `/${toDisplaySource(event.source)}/${event.slug}`;
}
