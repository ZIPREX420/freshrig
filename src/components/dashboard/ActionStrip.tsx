// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DriverIssue } from "../../types/hardware";

interface ActionItem {
  id: string;
  icon: LucideIcon;
  tone: "warning" | "error" | "info";
  title: string;
  cta: string;
  onClick: () => void;
}

interface ActionStripProps {
  driverIssues: DriverIssue[];
  onShowDrivers: () => void;
}

const toneStyles = {
  warning: { bg: "bg-warning-soft", rim: "border-warning-rim", icon: "text-warning" },
  error:   { bg: "bg-error-soft",   rim: "border-error-rim",   icon: "text-error" },
  info:    { bg: "bg-info-soft",    rim: "border-info-rim",    icon: "text-info" },
};

export function ActionStrip({ driverIssues, onShowDrivers }: ActionStripProps) {
  const items: ActionItem[] = [];

  if (driverIssues.length > 0) {
    items.push({
      id: "driver-issues",
      icon: AlertTriangle,
      tone: "warning",
      title: `${driverIssues.length} driver issue${driverIssues.length === 1 ? "" : "s"} detected`,
      cta: "Show details",
      onClick: onShowDrivers,
    });
  }

  // Future: insert disk warnings, update banners, drift alerts here.

  if (items.length === 0) return null;

  return (
    <section aria-label="Items needing attention" className="space-y-2 animate-fade-in">
      {items.map((item) => {
        const Icon = item.icon;
        const styles = toneStyles[item.tone];
        return (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${styles.bg} border ${styles.rim} hover:bg-white/[0.04] transition-colors text-left active:scale-[0.997] duration-100`}
          >
            <Icon className={`w-4 h-4 ${styles.icon} shrink-0`} />
            <p className="flex-1 text-sm text-text-primary truncate">{item.title}</p>
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary group-hover:text-text-primary">
              {item.cta} <ChevronRight className="w-3 h-3" />
            </span>
          </button>
        );
      })}
    </section>
  );
}
