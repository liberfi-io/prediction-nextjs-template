/**
 * Polymarket-compatible odds formatter.
 *
 * Ported from the reverse-engineered Polymarket bundle (see
 * `.plans/worldcup/research/01-odds-format-source.md`). A probability/price
 * `p ∈ (0,1)` is converted into one of 8 display formats. The math mirrors
 * Polymarket's `convertPrice` so our numbers match theirs 1:1.
 */

export const ODDS_FORMATS = [
  "price",
  "percentage",
  "decimal",
  "american",
  "fractional",
  "hongKong",
  "indonesian",
  "malaysian",
] as const;

export type OddsFormat = (typeof ODDS_FORMATS)[number];

export const ODDS_FORMAT_LABELS: Record<OddsFormat, string> = {
  price: "Price",
  percentage: "Percentage",
  decimal: "Decimal",
  american: "American",
  fractional: "Fractional",
  hongKong: "Hong Kong",
  indonesian: "Indonesian",
  malaysian: "Malaysian",
};

const parsePrice = (v: unknown): number | null => {
  if (v === 0) return 0;
  if (!v) return null;
  if (typeof v === "string") {
    const t = parseFloat(v);
    return Number.isNaN(t) ? null : t;
  }
  return v as number;
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const fmt = (x: number, n = 2): string =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: n,
    maximumFractionDigits: n,
    useGrouping: false,
  }).format(x);

/** Indonesian / Malaysian sign rule: negatives keep "-", positives have no "+". */
const signed2 = (v: number, n = 2): string =>
  v < 0 ? `-${fmt(Math.abs(v), n)}` : fmt(Math.abs(v), n);

/** Integer cents from a price (price is aligned to the tick so trunc is safe). */
const centsInt = (p: number): number => Math.trunc(Math.round(p * 1e4) / 100);

const americanFromPrice = (p: number, decimals = 0): string | null => {
  const n = parsePrice(p);
  if (n == null || Number.isNaN(n)) return null;
  if (n === 0) return "0";
  if (n >= 1) return "-100";
  const r = 100 * n;
  if (r < 50) {
    const v = (100 * (100 - r)) / r;
    return v > 0 ? `+${v.toFixed(decimals)}` : `${v.toFixed(decimals)}`;
  }
  return `-${((100 * r) / (100 - r)).toFixed(decimals)}`;
};

const hongKongFromPrice = (p: number): number | null => {
  const t = parsePrice(p);
  if (t == null || Number.isNaN(t) || t === 0) return null;
  return t >= 1 ? 0 : (1 - t) / t;
};

const indonesianFromPrice = (p: number): number | null => {
  const hk = hongKongFromPrice(p);
  if (hk === null) return null;
  return hk >= 1 ? hk : hk === 0 ? 0 : -1 / hk;
};

const malaysianFromPrice = (p: number): number | null => {
  const hk = hongKongFromPrice(p);
  if (hk === null) return null;
  return hk <= 1 ? hk : -1 / hk;
};

const fractionalFromPrice = (p: number): string | null => {
  const t = parsePrice(p);
  if (t == null || Number.isNaN(t)) return null;
  if (t >= 1) return "0/1";
  let num = Math.round((1 - t) * 1e4);
  let den = Math.round(t * 1e4);
  const g = gcd(num, den) || 1;
  num /= g;
  den /= g;
  return `${num}/${den}`;
};

/**
 * Convert a price/probability `p ∈ (0,1)` to a display string.
 *
 * @param p          Probability/price in [0,1].
 * @param outputMode One of the 8 supported odds formats.
 * @param precision  Decimal precision for decimal odds (2 default, 3 for fine ticks).
 */
export function convertPrice(
  p: number,
  outputMode: OddsFormat,
  precision = 2,
): string {
  switch (outputMode) {
    case "american":
      return americanFromPrice(p, 0) ?? `${centsInt(p)}¢`;
    case "decimal": {
      const t = parsePrice(p);
      if (t == null || t === 0) return `${centsInt(p)}¢`;
      return fmt(1 / t, precision === 3 ? 3 : 2);
    }
    case "percentage":
      return `${centsInt(p)}%`;
    case "fractional":
      return fractionalFromPrice(p) ?? `${centsInt(p)}¢`;
    case "hongKong": {
      const v = hongKongFromPrice(p);
      return v === null ? `${centsInt(p)}¢` : fmt(v, 2);
    }
    case "indonesian": {
      const v = indonesianFromPrice(p);
      return v === null ? `${centsInt(p)}¢` : signed2(v);
    }
    case "malaysian": {
      const v = malaysianFromPrice(p);
      return v === null ? `${centsInt(p)}¢` : signed2(v);
    }
    case "price":
    default:
      return `${centsInt(p)}¢`;
  }
}

/**
 * A numeric line value (spread handicap, totals line) is shown verbatim with a
 * leading sign for spreads. Unlike `convertPrice`, this is the betting *line*,
 * not the price, and is never reformatted across odds formats.
 */
export function formatLine(value: number, withSign = true): string {
  const fixed = Math.abs(value) % 1 === 0 ? value.toFixed(1) : value.toString();
  if (!withSign) return fixed;
  return value > 0 ? `+${fixed}` : fixed;
}
