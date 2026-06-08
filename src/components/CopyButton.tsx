"use client";

/**
 * Small copy-to-clipboard icon button.
 *
 * Mirrors the address-copy interaction used in the header account / balance
 * panel: a clipboard icon that swaps to a check mark for ~2s after copying, and
 * stops click propagation so it can live inside interactive rows / cards
 * without triggering their selection.
 */

import { useCallback, useState } from "react";
import { cn } from "@liberfi.io/ui";

export function CopyButton({
  value,
  title = "Copy",
  className,
  size = 12,
}: {
  value: string;
  title?: string;
  className?: string;
  size?: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard may be unavailable (insecure context); ignore.
      }
    },
    [value],
  );

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={handleCopy}
      className={cn(
        "cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700/60 hover:text-white",
        className,
      )}
    >
      {copied ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );
}
