import type { ProviderSource } from "@liberfi.io/react-predict";

export function predictEventHref(event: { slug: string; source?: ProviderSource }): string {
  return `/event/${event.slug}`;
}
