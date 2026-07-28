import { act, render, waitFor } from "@testing-library/react";
import type {
  MarketDataResourceInput,
  MarketDataResourceState,
} from "@liberfi.io/react-predict";
import { SportsShell } from "./SportsShell";

const mockUnmountedResourceKeys: string[] = [];

jest.mock("@liberfi.io/react-predict", () => {
  const actual = jest.requireActual("@liberfi.io/react-predict");
  const React = jest.requireActual("react") as typeof import("react");
  return {
    ...actual,
    useMarketDataResource: (input: MarketDataResourceInput) => {
      React.useEffect(
        () => () => {
          mockUnmountedResourceKeys.push(input.key);
        },
        [input.key],
      );
      return React.useMemo(
        () =>
          ({
            key: input.key,
            generation: 1,
            phase: "live",
            initialQuotes: input.initialQuotes,
          }) satisfies MarketDataResourceState,
        [input.initialQuotes, input.key],
      );
    },
  };
});

jest.mock("../i18n/LocalizedTaxonomyLabel", () => ({
  LocalizedTaxonomyLabel: ({ node }: { node: { slug: string } }) => (
    <span>{node.slug}</span>
  ),
}));

jest.mock("../../worldcup/odds/OddsNumber", () => ({
  OddsNumber: ({ value }: { value: string | number }) => <span>{value}</span>,
}));

describe("SportsShell market data generations", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockUnmountedResourceKeys.length = 0;
    delete (global as { fetch?: typeof fetch }).fetch;
  });

  it("unmounts the old owner and ignores its late paginated response", async () => {
    let resolveOldPage: (value: unknown) => void = () => undefined;
    const oldPage = new Promise((resolve) => {
      resolveOldPage = resolve;
    });
    global.fetch = jest.fn().mockImplementationOnce(() => oldPage);

    const initialResource = resource("matches:first");
    const view = render(
      <SportsShell
        section="sports"
        filters={{ view: "live" }}
        marketDataCapability={{ enabled: true }}
        marketDataResources={{ matches: initialResource }}
        data={{
          matches: [],
          props: [],
          taxonomy: null,
          match_pagination: {
            has_more: true,
            next_cursor: "late-cursor",
            limit: 20,
          },
        }}
      />,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    view.rerender(
      <SportsShell
        section="sports"
        filters={{
          view: "live",
          taxonomy_type: "sport",
          taxonomy_slug: "soccer",
        }}
        marketDataCapability={{ enabled: true }}
        marketDataResources={{ matches: resource("matches:soccer") }}
        data={{ matches: [], props: [], taxonomy: null }}
      />,
    );
    await waitFor(() =>
      expect(mockUnmountedResourceKeys).toContain("matches:first"),
    );
    const oldSignal = jest.mocked(global.fetch).mock.calls[0]?.[1]?.signal;
    expect(oldSignal?.aborted).toBe(true);

    await act(async () => {
      resolveOldPage({
        ok: true,
        json: async () => ({
          items: [
            {
              match_group_slug: "late-match",
              section: "sports",
              title: "Late match",
            },
          ],
          has_more: false,
          next_cursor: null,
          limit: 20,
        }),
      });
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(view.queryByText("Late match")).toBeNull();
  });
});

const emptyStructure = {
  representation_schema_version: 1 as const,
  initial_quotes_contract_enabled: true,
  items: [],
};

function resource(key: string): MarketDataResourceInput {
  return {
    key,
    structureETag: `W/"${key}"`,
    structurePath: "/api/v1/sports/matches",
    structure: emptyStructure,
    watch: { quote_markets: [] },
  };
}
