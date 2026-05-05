// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  /** Status indicator on the right of the title (e.g., a StatusPill). */
  status?: ReactNode;
  /** Action buttons on the far right (e.g., refresh, settings). */
  actions?: ReactNode;
  /** Optional one-line subtitle below the title. */
  subtitle?: string;
  className?: string;
}

export function SectionHeader({
  icon: Icon,
  title,
  status,
  actions,
  subtitle,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {Icon && (
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-subtle ring-1 ring-accent-ring shrink-0">
          <Icon className="w-4 h-4 text-accent" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[15px] font-semibold text-text-primary leading-tight">{title}</h3>
          {status}
        </div>
        {subtitle && (
          <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
