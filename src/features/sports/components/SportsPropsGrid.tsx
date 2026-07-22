import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@liberfi.io/ui";

/** Provides the responsive two-column grid boundary shared by props content. */
export function SportsPropsGrid({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("sports-props-grid -mx-2", className)} {...props}>
      <style>{`
        .sports-props-grid .sports-props-card-grid,
        .sports-props-grid .sports-props-skeleton-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        @media (max-width: 767px) {
          .sports-props-grid .sports-props-card-grid,
          .sports-props-grid .sports-props-skeleton-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
