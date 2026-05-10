// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";

export type ActionGridColumns = 2 | 3 | 4;

export interface ActionGridProps {
  /** ActionTile children. Number of columns is responsive but capped here. */
  children: ReactNode;
  /** Maximum columns at the widest breakpoint. 3 = mockup-1 home (3-up).
   *  4 = mockup-2 dashboard (4-up). 2 = compact two-column listings. */
  columns?: ActionGridColumns;
  className?: string;
}

const COLUMN_CLASSES: Record<ActionGridColumns, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * Responsive grid wrapper for `<ActionTile>` children. Defaults to 3 columns
 * at lg breakpoint, matching the mockup-1 home screen. Override via `columns`.
 *
 * Items collapse 1-up on mobile, 2-up on tablet (sm), and the chosen `columns`
 * count on large viewports. Equal-height rows via grid; gap matches the
 * surrounding hero stack.
 */
export function ActionGrid({ children, columns = 3, className = "" }: ActionGridProps) {
  return (
    <div className={`grid gap-4 ${COLUMN_CLASSES[columns]} ${className}`}>{children}</div>
  );
}
