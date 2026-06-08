import { cn } from "@liberfi.io/ui";

/**
 * Deterministic gradient avatar keyed off an arbitrary seed (typically a wallet
 * address). The same seed always yields the same three-stop HSL gradient, so a
 * wallet looks identical wherever it appears (header account button, smart-money
 * leaderboard rows, wallet detail header). Shared so those surfaces stay in sync.
 */
export function GradientAvatar({
  seed,
  size = 32,
  className,
}: {
  seed?: string;
  size?: number;
  className?: string;
}) {
  const hash = seed
    ? seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : 0;
  const c1 = `hsl(${(hash * 37) % 360}, 70%, 60%)`;
  const c2 = `hsl(${(hash * 73) % 360}, 65%, 45%)`;
  const c3 = `hsl(${(hash * 113) % 360}, 75%, 55%)`;

  return (
    <div
      className={cn("rounded-lg shadow-inner flex-shrink-0", className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`,
      }}
    />
  );
}
