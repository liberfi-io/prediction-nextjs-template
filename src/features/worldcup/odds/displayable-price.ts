export const MIN_DISPLAYABLE_BUY_PRICE = 0.001;
const PRICE_EPSILON = 1e-9;

export function displayableBuyPrice(price: number | null | undefined): number | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (price <= MIN_DISPLAYABLE_BUY_PRICE + PRICE_EPSILON) return null;
  return price;
}
