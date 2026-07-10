import type {
  MarketOutcome,
  PredictEvent,
  PredictMarket,
  ProviderSource,
  SimilarEventsParams,
} from "@liberfi.io/react-predict";

function localizedText(
  localized: string | undefined,
  fallback: string | undefined,
) {
  const value = localized?.trim();
  return value || fallback;
}

function localizeOutcome(outcome: MarketOutcome): MarketOutcome {
  return {
    ...outcome,
    label: localizedText(outcome.label_trans, outcome.label) ?? outcome.label,
  };
}

function localizeMarket(market: PredictMarket): PredictMarket {
  return {
    ...market,
    question:
      localizedText(market.question_trans, market.question) ?? market.question,
    description: localizedText(
      market.description_trans,
      market.description,
    ),
    outcomes: market.outcomes.map(localizeOutcome),
  };
}

export function localizePredictEvent(event: PredictEvent): PredictEvent {
  return {
    ...event,
    title: localizedText(event.title_trans, event.title) ?? event.title,
    subtitle: localizedText(event.subtitle_trans, event.subtitle),
    description: localizedText(event.description_trans, event.description),
    markets: event.markets?.map(localizeMarket),
  };
}

export function localizePredictEvents(events: PredictEvent[]): PredictEvent[] {
  return events.map(localizePredictEvent);
}

function buildQuery(params: Record<string, unknown>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      qs.set(key, String(value));
    }
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const error = new Error(await response.text());
    Object.assign(error, { status: response.status });
    throw error;
  }
  return (await response.json()) as T;
}

export async function fetchLocalizedPredictEvent(
  endpoint: string,
  slug: string,
  source: ProviderSource | undefined,
  lang: string,
  init?: RequestInit,
): Promise<PredictEvent> {
  const query = buildQuery({ source, lang });
  const event = await fetchJson<PredictEvent>(
    `${endpoint}/api/v1/events/${encodeURIComponent(slug)}${query}`,
    init,
  );
  return localizePredictEvent(event);
}

export async function fetchLocalizedSimilarPredictEvents(
  endpoint: string,
  slug: string,
  source: ProviderSource,
  params: SimilarEventsParams | undefined,
  lang: string,
  init?: RequestInit,
): Promise<PredictEvent[]> {
  const query = buildQuery({ source, ...params, lang });
  const events = await fetchJson<PredictEvent[]>(
    `${endpoint}/api/v1/events/${encodeURIComponent(slug)}/similar${query}`,
    init,
  );
  return localizePredictEvents(events);
}
