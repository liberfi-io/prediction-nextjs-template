"use client";

import { cn } from "@liberfi.io/ui";
import { convertPrice, type OddsFormat } from "../odds/convert-price";
import { OddsNumber, type OddsNumberVariant } from "../odds/OddsNumber";

/**
 * A single tappable odds cell: a label (team / Draw / O 2.5) plus the
 * already-formatted price rendered through the animated `OddsNumber`.
 */
export function OddsPill({
  label,
  price,
  format,
  variant = "fade",
  className,
  onClick,
}: {
  label: string;
  price: number;
  format: OddsFormat;
  variant?: OddsNumberVariant;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const formatted = convertPrice(price, format);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/pill flex flex-col items-center justify-center gap-0.5 rounded-[8px] border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 transition-colors hover:border-zinc-600 hover:bg-zinc-800/70 cursor-pointer min-w-0",
        className,
      )}
    >
      <span className="max-w-full truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500 group-hover/pill:text-zinc-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-zinc-100 tabular-nums">
        <OddsNumber value={formatted} variant={variant} />
      </span>
    </button>
  );
}
