import type {
  PredictEvent,
  PredictMarket,
  PredictPage,
} from "@liberfi.io/react-predict";

import { filterTradableEventsPage } from "./filterPredictEvents";

function eventFixture(overrides: Partial<PredictEvent>): PredictEvent {
  return {
    id: 1,
    slug: "test-event",
    title: "Test event",
    status: "open",
    markets: [],
    ...overrides,
  } as PredictEvent;
}

describe("filterTradableEventsPage", () => {
  it("keeps open events and removes closed markets", () => {
    const page = {
      items: [
        eventFixture({
          markets: [
            { id: 11, status: "open" } as unknown as PredictMarket,
            { id: 12, status: "closed" } as unknown as PredictMarket,
          ],
        }),
        eventFixture({ id: 2, status: "closed" }),
      ],
    } as unknown as PredictPage<PredictEvent>;

    const result = filterTradableEventsPage(page);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.markets).toHaveLength(1);
    expect(result.items[0]?.markets?.[0]?.id).toBe(11);
  });
});
