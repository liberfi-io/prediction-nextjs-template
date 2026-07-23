import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@liberfi.io/ui";

export const SPORTS_PROPS_MOBILE_MEDIA_QUERY = "(max-width: 767px)";
export const SPORTS_PROPS_DESKTOP_COLUMNS = 2;
export const SPORTS_PROP_CARD_HEIGHT_CLASS = "min-h-0 md:min-h-[248px]";
export const SPORTS_PROPS_DESKTOP_ROW_ESTIMATE = 264;
export const SPORTS_PROPS_MOBILE_ROW_ESTIMATE = 240;

/** Provides the responsive two-column grid boundary shared by props content. */
export function SportsPropsGrid({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("sports-props-grid -mx-2", className)} {...props}>
      <style>{`
        .sports-props-grid .sports-props-card-grid {
          grid-template-columns: repeat(${SPORTS_PROPS_DESKTOP_COLUMNS}, minmax(0, 1fr)) !important;
        }
        @media ${SPORTS_PROPS_MOBILE_MEDIA_QUERY} {
          .sports-props-grid .sports-props-card-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
