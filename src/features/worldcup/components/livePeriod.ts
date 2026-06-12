import type { WcMatch } from "../types";

type Translate = (key: `extend.${string}`) => string;

const PERIOD_LABEL_KEYS: Record<string, string> = {
  "1H": "firstHalf",
  "2H": "secondHalf",
  HT: "halfTime",
};

function translatePeriod(period: string | undefined, t: Translate): string | undefined {
  if (!period) return undefined;

  const labelKey = PERIOD_LABEL_KEYS[period.toUpperCase()];
  if (!labelKey) return period;

  const translationKey = `extend.worldcup.period.${labelKey}` as const;
  const label = t(translationKey);
  return label && label !== translationKey ? label : period;
}

export function formatLivePeriodLabel(match: WcMatch, t: Translate): string | undefined {
  const state = match.liveState;
  if (!state) return match.livePeriod;

  const period = translatePeriod(state.period, t);
  if (period && state.elapsed) return `${period} · ${state.elapsed}'`;
  return period ?? match.livePeriod;
}
