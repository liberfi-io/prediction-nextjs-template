import type { SportsPage, SportsSection, TaxonomySelection } from "../types";

/** Loads the next sports page while passing the opaque server cursor unchanged. */
export async function fetchNextSportsPage<T>(input: {
  section: SportsSection;
  resource: "matches" | "props";
  taxonomy?: TaxonomySelection;
  limit: number;
  cursor: string;
  lang?: string;
}): Promise<SportsPage<T>> {
  const baseUrl = process.env.NEXT_PUBLIC_PREDICT_URL ?? "/predict-api";
  const url = new URL(
    `${baseUrl}/api/v1/${input.section}/${input.resource}`,
    window.location.origin,
  );
  if (input.taxonomy) {
    url.searchParams.set("taxonomy_type", input.taxonomy.taxonomy_type);
    url.searchParams.set("taxonomy_slug", input.taxonomy.taxonomy_slug);
  }
  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("cursor", input.cursor);
  if (input.lang) url.searchParams.set("lang", input.lang);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sports API returned ${response.status}`);
  const page = (await response.json()) as SportsPage<T>;
  return {
    ...page,
    items: page.items ?? [],
    has_more: Boolean(page.has_more && page.next_cursor),
  };
}
