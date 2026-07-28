import type { MarketDataResourceInput } from "@liberfi.io/react-predict";
import {
  initialSportsMarketDataResources,
  sportsMarketDataOwnerKey,
  updateSportsMarketDataResources,
} from "./sportsResources";

function resource(key: string): MarketDataResourceInput {
  return {
    key,
    structureETag: `W/"${key}"`,
    structurePath: `/api/v1/sports/matches?cursor=${key}`,
    structure: {
      representation_schema_version: 1,
      initial_quotes_contract_enabled: true,
      items: [],
    },
    watch: { quote_markets: [] },
  };
}

describe("sports market data resource generations", () => {
  it("appends pagination generations once and replaces route generations", () => {
    const initial = initialSportsMarketDataResources({
      matches: resource("matches:first"),
      props: resource("props:first"),
    });
    const appended = updateSportsMarketDataResources(
      initial,
      "matches",
      resource("matches:next"),
      "append",
    );
    const deduplicated = updateSportsMarketDataResources(
      appended,
      "matches",
      resource("matches:next"),
      "append",
    );
    const replaced = updateSportsMarketDataResources(
      deduplicated,
      "matches",
      resource("matches:new-route"),
      "replace",
    );

    expect(appended.matches.map(({ key }) => key)).toEqual([
      "matches:first",
      "matches:next",
    ]);
    expect(deduplicated.matches).toHaveLength(2);
    expect(replaced.matches.map(({ key }) => key)).toEqual([
      "matches:new-route",
    ]);
    expect(replaced.props.map(({ key }) => key)).toEqual(["props:first"]);
  });

  it("changes the resource owner generation with route identity", () => {
    const hydration = { matches: resource("matches:first") };
    const initial = sportsMarketDataOwnerKey({
      section: "sports",
      lang: "en",
      filters: { view: "live" },
      hydration,
    });

    expect(
      sportsMarketDataOwnerKey({
        section: "sports",
        lang: "en",
        filters: {
          view: "live",
          taxonomy_type: "sport",
          taxonomy_slug: "soccer",
        },
        hydration,
      }),
    ).not.toBe(initial);
  });
});
