"use client";

import { useEffect } from "react";
import { cn } from "@liberfi.io/ui";

/**
 * Lightweight mobile bottom sheet (action sheet) used by the World Cup detail
 * page. Slides up from the bottom over a dimmed backdrop, exposes a drag
 * handle, and is dismissed by tapping the backdrop. Visual treatment matches
 * the app's existing mobile balance sheet so the family stays consistent.
 *
 * Rendered as `fixed inset-0` so it overlays the app footer while open. Body
 * scroll is locked while open to avoid background scroll bleed.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={cn(
          "relative w-full max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom duration-200",
          className,
        )}
        style={{
          borderRadius: "16px 16px 0 0",
          border: "1px solid rgba(39,39,42,1)",
          borderBottom: "none",
          background: "rgba(24,24,27,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex justify-center bg-[rgba(24,24,27,1)] pb-1 pt-3">
          <div className="h-1 w-9 rounded-full bg-zinc-700" />
        </div>
        {children}
      </div>
    </div>
  );
}
