import { getServerPredictClient } from "src/libs/server/predictClient";
import type {
  SportsPageData,
  SportsPageFilters,
  SportsSection,
  SportsTaxonomyResponse,
} from "../types";
import type { SportsSsrDeadline } from "../route/sportsSsrDeadline";

type RuntimeSportsClient = {
  getSportsTaxonomy?: (params: Record<string, unknown>) => Promise<unknown>;
  getSportsMatches?: (params: Record<string, unknown>) => Promise<unknown>;
  getSportsProps?: (params: Record<string, unknown>) => Promise<unknown>;
  getEsportsTaxonomy?: (params: Record<string, unknown>) => Promise<unknown>;
  getEsportsMatches?: (params: Record<string, unknown>) => Promise<unknown>;
  getEsportsProps?: (params: Record<string, unknown>) => Promise<unknown>;
};

interface PageResponse<T> {
  items?: T[];
}

export async function prefetchSportsPageData(input: {
  section: SportsSection;
  lang: string;
  requestHeaders?: HeadersInit;
  deadline: SportsSsrDeadline;
  filters?: SportsPageFilters;
}): Promise<SportsPageData> {
  const client = getServerPredictClient({
    headers: input.requestHeaders,
  }) as RuntimeSportsClient;
  const params = {
    ...(input.filters ?? {}),
    ...(input.lang ? { lang: input.lang } : {}),
  };

  const readTaxonomy =
    input.section === "esports"
      ? client.getEsportsTaxonomy
      : client.getSportsTaxonomy;
  const readMatches =
    input.section === "esports"
      ? client.getEsportsMatches
      : client.getSportsMatches;
  const readProps =
    input.section === "esports"
      ? client.getEsportsProps
      : client.getSportsProps;

  const [taxonomy, matches, props] = await Promise.all([
    input.deadline
      .withRemainingTimeout(
        () => readTaxonomy?.call(client, params) ?? Promise.resolve(null),
      )
      .catch(() => null),
    input.deadline
      .withRemainingTimeout(
        () =>
          readMatches?.call(client, params) ?? Promise.resolve({ items: [] }),
      )
      .catch(() => ({ items: [] })),
    input.deadline
      .withRemainingTimeout(
        () => readProps?.call(client, params) ?? Promise.resolve({ items: [] }),
      )
      .catch(() => ({ items: [] })),
  ]);

  return {
    taxonomy: taxonomy as SportsTaxonomyResponse | null,
    matches: ((matches as PageResponse<SportsPageData["matches"][number]>)
      .items ?? []) as SportsPageData["matches"],
    props: ((props as PageResponse<SportsPageData["props"][number]>).items ??
      []) as SportsPageData["props"],
  };
}
