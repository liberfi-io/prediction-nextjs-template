export const MIN_DISPLAYABLE_BUY_PRICE = 0.001;

export function displayableBuyPrice(price: number | null | undefined): number | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (price <= MIN_DISPLAYABLE_BUY_PRICE) return null;
  return price;
}
