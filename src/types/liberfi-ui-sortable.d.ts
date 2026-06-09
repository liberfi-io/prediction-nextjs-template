import type { PropsWithChildren, ReactElement } from "react";

declare module "@liberfi.io/ui" {
  type SortDirection = "asc" | "desc";

  export function Sortable(
    props: PropsWithChildren<{
      /** Current sort direction. `undefined` means unsorted. */
      sort?: SortDirection;
      /** Called when the user clicks to change sort. */
      onSortChange?: (sort?: SortDirection) => void | Promise<void>;
      /** Sort directions to show and cycle through. Defaults to `["desc", "asc"]`. */
      directions?: readonly SortDirection[];
    }>,
  ): ReactElement;
}
