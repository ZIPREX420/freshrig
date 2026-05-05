// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";

interface PageShellProps {
  /** Page title — rendered as the page-level h1. */
  title: string;
  /** One-line subtitle below the title (optional). */
  subtitle?: string;
  /** Right-aligned slot for primary actions (buttons, refresh, etc). */
  actions?: ReactNode;
  /** Optional status indicator next to the title (e.g., StatusPill). */
  status?: ReactNode;
  /** Body content. */
  children: ReactNode;
  /** Extra class on the outer wrapper. */
  className?: string;
}

/**
 * Standard page scaffold: header (title + status + actions) + body.
 * Every page should wrap its content in <PageShell> so margins, gaps, and
 * the title/actions row stay consistent across the whole app.
 */
export function PageShell({ title, subtitle, actions, status, children, className = "" }: PageShellProps) {
  return (
    <div className={`space-y-6 animate-fade-in-soft ${className}`}>
      <header className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] font-semibold text-text-primary leading-tight tracking-tight">{title}</h1>
            {status}
          </div>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
