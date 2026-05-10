// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

export interface PageBreadcrumbProps {
  /** Current page label — shown after the back-arrow, uppercase, letter-spaced. */
  current: string;
  /** Optional handler for the back arrow. When omitted, no arrow renders
   *  (use this on hub pages where there's nowhere to go back to). */
  onBack?: () => void;
  /** Optional right-aligned slot — typically a single primary action button
   *  ("SYSTEEM SCANNEN" in the mockup). */
  rightSlot?: ReactNode;
  className?: string;
}

/**
 * Top-of-page breadcrumb: back arrow + current page label, optional right
 * slot. Mirrors the "< SNELSETUP" header in mockup-1's subpage screens.
 *
 * Positioned at the top of the page content area (inside the main scroll
 * region). Pairs naturally with `PageShell`'s `title` slot — use one or
 * the other, not both.
 */
export function PageBreadcrumb({
  current,
  onBack,
  rightSlot,
  className = "",
}: PageBreadcrumbProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 mb-8 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-colors active:scale-[0.97]"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-text-secondary truncate">
          {current}
        </span>
      </div>
      {rightSlot && <div className="flex items-center gap-2 shrink-0">{rightSlot}</div>}
    </div>
  );
}
