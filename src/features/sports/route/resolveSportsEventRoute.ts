import type { SportsFeatureFlags } from "src/libs/featureFlags";
import type { WorldcupEventAttribution } from "src/features/worldcup/data/resolve-event-attribution";
import { mergeSportsDeepLinkParams } from "./mergeSportsDeepLinkParams";
import type { SportsSsrDeadline } from "./sportsSsrDeadline";

export type SportsSection = "sports" | "esports";

export interface SportsRoutingResult {
  route_type: "match" | "prop" | "child_redirect" | "not_sports";
  slug: string;
  section?: SportsSection;
  match_group_slug?: string;
  event_slug?: string;
  redirect_to?: string;
}

export interface SportsMatchDetailLike {
  match_group_slug: string;
  section: SportsSection;
  sport_slug?: string;
  game_slug?: string;
}

export interface ResolveSportsEventRouteInput {
  slug: string;
  searchParams: URLSearchParams;
  lang: string;
  flags: SportsFeatureFlags;
  deadline: SportsSsrDeadline;
  resolveWorldcupAttribution: (slug: string) => WorldcupEventAttribution | null;
  fetchSportsRouting: (
    slug: string,
    lang: string,
    signal: AbortSignal,
  ) => Promise<SportsRoutingResult | null>;
  fetchFallbackEvent: (
    slug: string,
    lang: string,
    signal: AbortSignal,
  ) => Promise<{ event_slug: string } | null>;
  fetchSportsMatchDetail?: (
    section: SportsSection,
    matchGroupSlug: string,
    lang: string,
    signal: AbortSignal,
  ) => Promise<SportsMatchDetailLike | null>;
}

export type SportsEventRouteResult =
  | { kind: "worldcup_match"; slug: string }
  | { kind: "worldcup_event_redirect"; redirect_to: string }
  | {
      kind: "sports_match";
      match_group_slug: string;
      section: SportsSection;
      detail: SportsMatchDetailLike;
    }
  | {
      kind: "sports_match_skeleton";
      match_group_slug: string;
      section: SportsSection;
    }
  | { kind: "sports_child_redirect"; redirect_to: string }
  | { kind: "sports_prop"; event_slug: string }
  | { kind: "fallback_event"; event_slug: string }
  | { kind: "not_found" };

export async function resolveSportsEventRoute(
  input: ResolveSportsEventRouteInput,
): Promise<SportsEventRouteResult> {
  const worldcup = input.resolveWorldcupAttribution(input.slug);
  if (worldcup?.kind === "match") {
    return { kind: "worldcup_match", slug: worldcup.matchSlug };
  }
  if (worldcup?.kind === "event") {
    return {
      kind: "worldcup_event_redirect",
      redirect_to: mergeSportsDeepLinkParams({
        redirectTo: `/event/${encodeURIComponent(worldcup.matchSlug)}`,
        searchParams: input.searchParams,
      }),
    };
  }

  const sportsEnabled =
    input.flags.sports_enabled || input.flags.esports_enabled;
  if (!sportsEnabled) {
    const fallback = await input.deadline
      .withRemainingTimeout((signal) =>
        input.fetchFallbackEvent(input.slug, input.lang, signal),
      )
      .catch(() => null);
    return fallback
      ? { kind: "fallback_event", event_slug: fallback.event_slug }
      : { kind: "not_found" };
  }

  const routingPromise = input.deadline
    .withRemainingTimeout((signal) =>
      input.fetchSportsRouting(input.slug, input.lang, signal),
    )
    .catch(() => null);
  const fallbackPromise = input.deadline
    .withRemainingTimeout((signal) =>
      input.fetchFallbackEvent(input.slug, input.lang, signal),
    )
    .catch(() => null);

  const [routing, fallback] = await Promise.all([
    routingPromise,
    fallbackPromise,
  ]);

  if (!routing || routing.route_type === "not_sports") {
    return fallback
      ? { kind: "fallback_event", event_slug: fallback.event_slug }
      : { kind: "not_found" };
  }

  if (routing.route_type === "prop" && routing.event_slug) {
    return { kind: "sports_prop", event_slug: routing.event_slug };
  }

  if (routing.route_type === "child_redirect" && routing.redirect_to) {
    return {
      kind: "sports_child_redirect",
      redirect_to: mergeSportsDeepLinkParams({
        redirectTo: routing.redirect_to,
        searchParams: input.searchParams,
      }),
    };
  }

  if (routing.route_type === "match" && routing.match_group_slug) {
    const section = routing.section ?? "sports";
    if (!matchDetailEnabled(input.flags, section)) {
      return fallback
        ? { kind: "fallback_event", event_slug: fallback.event_slug }
        : { kind: "not_found" };
    }

    const detail = await input.deadline
      .withRemainingTimeout(
        (signal) =>
          input.fetchSportsMatchDetail?.(
            section,
            routing.match_group_slug!,
            input.lang,
            signal,
          ) ?? Promise.resolve(null),
      )
      .catch(() => null);

    if (!detail) {
      return {
        kind: "sports_match_skeleton",
        match_group_slug: routing.match_group_slug,
        section,
      };
    }

    return {
      kind: "sports_match",
      match_group_slug: routing.match_group_slug,
      section,
      detail,
    };
  }

  return fallback
    ? { kind: "fallback_event", event_slug: fallback.event_slug }
    : { kind: "not_found" };
}

function matchDetailEnabled(
  flags: SportsFeatureFlags,
  section: SportsSection,
): boolean {
  if (section === "esports") {
    return flags.esports_enabled && flags.esports_match_detail_cs2_enabled;
  }
  return flags.sports_enabled && flags.sports_match_detail_enabled;
}
