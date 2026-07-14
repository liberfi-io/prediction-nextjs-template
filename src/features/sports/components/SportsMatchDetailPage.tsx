import type { SportsMatchDetail } from "../types";

interface SportsMatchDetailPageProps {
  match: SportsMatchDetail;
}

export function SportsMatchDetailPage({ match }: SportsMatchDetailPageProps) {
  const marketGroups = match.market_groups ?? [];

  return (
    <main className="min-h-[calc(100vh-var(--header-height))] bg-[#09090b] px-3 py-4 text-zinc-100 sm:px-6">
      <div className="mx-auto grid w-full max-w-[1280px] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              {[
                match.sport_slug ?? match.game_slug,
                match.league_slug,
                match.status,
              ]
                .filter(Boolean)
                .map((item) => (
                  <span key={item}>{item}</span>
                ))}
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-50">
              {match.title}
            </h1>
            {match.start_time && (
              <time
                className="mt-2 block text-sm text-zinc-500"
                dateTime={match.start_time}
              >
                {new Date(match.start_time).toLocaleString()}
              </time>
            )}
          </div>

          {match.participants && match.participants.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {match.participants.map((participant) => (
                <div
                  key={`${participant.role ?? "participant"}:${participant.slug ?? participant.name}`}
                  className="flex items-center gap-3 rounded-lg border border-zinc-900 bg-zinc-950 p-3"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded bg-zinc-900 text-sm font-semibold text-zinc-400">
                    {(participant.abbreviation ?? participant.name).slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-100">
                      {participant.name}
                    </div>
                    {participant.role && (
                      <div className="text-xs text-zinc-500">
                        {participant.role}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {marketGroups.map((group) => (
              <section
                key={group.market_category}
                className="rounded-lg border border-zinc-900 bg-zinc-950"
              >
                <div className="border-b border-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-100">
                  {group.label}
                </div>
                <div className="divide-y divide-zinc-900">
                  {(group.markets ?? []).map((market) => (
                    <div key={market.market_slug} className="p-3">
                      <div className="mb-2 text-sm text-zinc-300">
                        {market.label}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(market.outcomes ?? []).map((outcome) => (
                          <div
                            key={`${market.market_slug}:${outcome.outcome}`}
                            className="rounded-md bg-zinc-900 px-3 py-2"
                          >
                            <div className="text-xs text-zinc-500">
                              {outcome.label}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-zinc-100">
                              {formatPrice(
                                outcome.price ??
                                  outcome.best_ask ??
                                  outcome.last_trade_price,
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <aside className="rounded-lg border border-zinc-900 bg-zinc-950 p-4 lg:sticky lg:top-[calc(var(--header-height)+16px)] lg:h-fit">
          <div className="text-sm font-semibold text-zinc-100">
            {match.match_group_slug}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            {match.market_count ?? countMarkets(marketGroups)}
          </div>
        </aside>
      </div>
    </main>
  );
}

export function SportsMatchDetailSkeleton({
  matchGroupSlug,
}: {
  matchGroupSlug: string;
}) {
  return (
    <main className="min-h-[calc(100vh-var(--header-height))] bg-[#09090b] px-3 py-4 text-zinc-100 sm:px-6">
      <div className="mx-auto w-full max-w-[1120px] space-y-4">
        <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-zinc-900" />
          <div className="mt-4 h-8 w-full max-w-lg animate-pulse rounded bg-zinc-900" />
          <div className="mt-3 text-sm text-zinc-500">{matchGroupSlug}</div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-80 animate-pulse rounded-lg border border-zinc-900 bg-zinc-950" />
          <div className="h-80 animate-pulse rounded-lg border border-zinc-900 bg-zinc-950" />
        </div>
      </div>
    </main>
  );
}

function formatPrice(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${Math.round(value * 100)}c`;
}

function countMarkets(groups: SportsMatchDetail["market_groups"]): number {
  return (groups ?? []).reduce(
    (total, group) => total + (group.markets?.length ?? 0),
    0,
  );
}
