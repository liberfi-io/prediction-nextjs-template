export function mergeSportsDeepLinkParams(input: {
  redirectTo: string;
  searchParams: URLSearchParams;
  knownMarketSlugs?: Set<string>;
}): string {
  const base = "http://local";
  const url = new URL(input.redirectTo, base);
  const market = input.searchParams.get("market");
  const outcome = input.searchParams.get("outcome");

  if (
    market &&
    (!input.knownMarketSlugs || input.knownMarketSlugs.has(market))
  ) {
    url.searchParams.set("market", market);
  }

  if (outcome === "yes" || outcome === "no") {
    url.searchParams.set("outcome", outcome);
  }

  return `${url.pathname}${url.search}`;
}
