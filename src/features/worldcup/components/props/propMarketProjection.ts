import type { PredictMarket } from "@liberfi.io/react-predict";
import type { WcOutcome, WcProp } from "../../types";

type ProjectableOutcome = WcOutcome & {
  key: string;
  marketSlug: string;
};

function projectableOutcome(
  outcome: WcOutcome,
): ProjectableOutcome | undefined {
  const key = outcome.key?.trim();
  const marketSlug = outcome.marketSlug?.trim();
  if (!key || !marketSlug) return undefined;
  return { ...outcome, key, marketSlug };
}

export function projectWorldCupPropMarkets(
  prop: WcProp,
  title: string,
  label: (outcome: WcOutcome) => string,
): PredictMarket[] {
  if (prop.outcomes.length === 0) return [];

  const outcomes = prop.outcomes.map(projectableOutcome);
  if (outcomes.some((outcome) => outcome === undefined)) return [];

  const byMarket = new Map<string, ProjectableOutcome[]>();
  for (const outcome of outcomes as ProjectableOutcome[]) {
    const group = byMarket.get(outcome.marketSlug) ?? [];
    group.push(outcome);
    byMarket.set(outcome.marketSlug, group);
  }

  for (const group of byMarket.values()) {
    const keys = group.map((outcome) => outcome.key);
    if (new Set(keys).size !== keys.length) return [];
  }

  if (byMarket.size === 1) {
    const [marketSlug, group] = Array.from(byMarket.entries())[0];
    return [
      {
        slug: marketSlug,
        event_slug: prop.slug,
        question: title,
        status: "open",
        source: group[0].marketSource ?? "polymarket",
        outcomes: group.map((outcome) => ({
          key: outcome.key,
          label: label(outcome),
          price: outcome.price,
        })),
      },
    ];
  }

  if (Array.from(byMarket.values()).some((group) => group.length !== 1)) {
    return [];
  }

  return Array.from(byMarket.entries()).map(([marketSlug, [outcome]]) => ({
    slug: marketSlug,
    event_slug: prop.slug,
    question: label(outcome),
    status: "open",
    source: outcome.marketSource ?? "polymarket",
    outcomes: [
      {
        key: outcome.key,
        label: label(outcome),
        price: outcome.price,
      },
    ],
  }));
}
