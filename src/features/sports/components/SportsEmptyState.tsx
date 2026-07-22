import { EmptyIcon } from "@liberfi.io/ui";

/** Renders the shared empty state used by sports lists. */
export function SportsEmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <EmptyIcon
        data-testid="sports-empty-state-icon"
        width={32}
        height={32}
        className="text-zinc-600"
      />
      <span className="text-sm text-zinc-500">{label}</span>
    </div>
  );
}
