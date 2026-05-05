// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";

interface DataRowProps {
  label: string;
  /** Plain string value, OR pass children for richer content (e.g., a StatusPill). */
  value?: string;
  children?: ReactNode;
  /** Use tabular monospace for numeric/version data. Default true. */
  mono?: boolean;
  /** Optional title attribute on the value (for full text on hover when truncated). */
  title?: string;
  className?: string;
}

export function DataRow({
  label,
  value,
  children,
  mono = true,
  title,
  className = "",
}: DataRowProps) {
  return (
    <div className={`flex items-center justify-between gap-3 text-xs ${className}`}>
      <span className="text-text-muted shrink-0">{label}</span>
      {children ? (
        <span className="text-text-secondary truncate text-right">{children}</span>
      ) : (
        <span
          className={`text-text-secondary truncate text-right ${mono ? "font-mono tabular" : ""}`}
          title={title ?? value}
        >
          {value}
        </span>
      )}
    </div>
  );
}
