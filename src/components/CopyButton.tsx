"use client";

/**
 * Copy-to-clipboard primitives.
 *
 * Mirrors the address-copy interaction used in the header account / balance
 * panel: a clipboard icon that swaps to a check mark for ~2s after copying, and
 * stops click propagation so it can live inside interactive rows / cards
 * without triggering their selection.
 *
 * - {@link CopyButton} renders just the icon button.
 * - {@link CopyInline} wraps a label (e.g. an address) together with the icon
 *   into a single clickable region, so the whole address — not only the small
 *   icon — copies on click.
 */

import { useCallback, useState } from "react";
import { cn, toast } from "@liberfi.io/ui";
import { useTranslation } from "@liberfi.io/i18n";

/** Shared copy state + handler. Returns the `copied` flag and a click handler. */
function useCopy(value: string, copiedMessage?: string) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(copiedMessage ?? t("extend.referral.copied", { defaultValue: "Copied" }));
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard may be unavailable (insecure context); ignore.
      }
    },
    [copiedMessage, t, value],
  );
  return { copied, copy };
}

/** Clipboard / check glyph. */
function CopyGlyph({ copied, size }: { copied: boolean; size: number }) {
  return copied ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function CopyButton({
  value,
  title = "Copy",
  className,
  size = 12,
  copiedMessage,
}: {
  value: string;
  title?: string;
  className?: string;
  size?: number;
  copiedMessage?: string;
}) {
  const { copied, copy } = useCopy(value, copiedMessage);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={copy}
      className={cn(
        "cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700/60 hover:text-white",
        className,
      )}
    >
      <CopyGlyph copied={copied} size={size} />
    </button>
  );
}

/**
 * Clickable copy region wrapping a label (children) plus the copy icon. The
 * whole region copies on click — a larger target than the icon alone — and
 * stops propagation so it can sit inside an interactive row / card without
 * triggering its selection.
 */
export function CopyInline({
  value,
  title = "Copy",
  className,
  size = 12,
  copiedMessage,
  children,
}: {
  value: string;
  title?: string;
  className?: string;
  size?: number;
  copiedMessage?: string;
  children: React.ReactNode;
}) {
  const { copied, copy } = useCopy(value, copiedMessage);
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      aria-label={title}
      onClick={copy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") copy(e);
      }}
      className={cn(
        "group/copy inline-flex min-w-0 cursor-pointer items-center gap-1 outline-none",
        className,
      )}
    >
      {children}
      <span className="shrink-0 text-zinc-500 transition-colors group-hover/copy:text-zinc-200">
        <CopyGlyph copied={copied} size={size} />
      </span>
    </span>
  );
}
