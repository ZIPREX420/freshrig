// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { ChevronRight } from "lucide-react";
import { Hexagon } from "lucide-react";
import { HexIcon } from "../ui/HexIcon";

export type SidebarSystemCardVariant = "compact" | "expanded";
export type SystemHealthState = "optimal" | "warning" | "critical" | "unknown";

export interface SidebarSystemCardProps {
  /** `compact`  = mockup-1 sidebar bottom: just a hex + status label + last scan
   *  `expanded` = mockup-2 sidebar bottom: full system overview with OS, CPU,
   *               GPU, RAM rows + DETAILS button. */
  variant?: SidebarSystemCardVariant;
  /** Top-line status. Drives the hex accent + label. */
  health?: SystemHealthState;
  /** Free-text last-scan timestamp ("Vandaag, 10:42" / "Today, 10:42"). */
  lastScanLabel?: string;
  /** OS short name ("Windows 11 Pro 24H2"). Used in expanded mode. */
  osName?: string;
  /** CPU model short ("AMD Ryzen 7 7800X3D"). Used in expanded mode. */
  cpu?: string;
  /** GPU model short ("NVIDIA RTX 4070 SUPER"). Used in expanded mode. */
  gpu?: string;
  /** RAM short ("32 GB DDR5"). Used in expanded mode. */
  ram?: string;
  /** Click handler for the DETAILS button (expanded) or the whole card
   *  (compact). Typically navigates to the dashboard / hardware view. */
  onDetailsClick?: () => void;
}

const HEALTH_TEXT: Record<SystemHealthState, string> = {
  optimal: "System optimal",
  warning: "Attention needed",
  critical: "Action required",
  unknown: "Status unknown",
};

const HEALTH_ACCENT: Record<SystemHealthState, "cyan" | "magenta"> = {
  optimal: "cyan",
  warning: "magenta",
  critical: "magenta",
  unknown: "cyan",
};

/**
 * Bottom-of-sidebar status / system card. Two variants matching the two
 * mockup sheets:
 *   - compact  = just a small hex + the system status label + last scan time
 *   - expanded = full hardware spec list (OS / CPU / GPU / RAM) + details CTA
 *
 * Designed to live inside the sidebar's flex-column footer; render directly
 * after the secondary nav. The component takes care of its own padding +
 * top border so it slots in without sidebar-side adjustments.
 */
export function SidebarSystemCard({
  variant = "compact",
  health = "optimal",
  lastScanLabel,
  osName,
  cpu,
  gpu,
  ram,
  onDetailsClick,
}: SidebarSystemCardProps) {
  const accent = HEALTH_ACCENT[health];
  const statusLabel = HEALTH_TEXT[health];

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onDetailsClick}
        disabled={!onDetailsClick}
        className="w-full flex items-center gap-3 px-4 py-3 mx-2 mb-3 rounded-md bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent-cyan-rim)] hover:bg-[var(--bg-card-hover)] transition-colors text-left disabled:cursor-default disabled:hover:border-[var(--border)] disabled:hover:bg-[var(--bg-card)]"
      >
        <HexIcon size="sm" accent={accent} idSuffix="sidebar-status">
          <Hexagon className="w-3.5 h-3.5" strokeWidth={2.5} />
        </HexIcon>
        <span className="flex-1 min-w-0">
          <span
            className={`block text-[11px] font-semibold uppercase tracking-[0.1em] truncate ${
              accent === "magenta"
                ? "text-[var(--accent-magenta)]"
                : "text-[var(--accent-cyan)]"
            }`}
          >
            {statusLabel}
          </span>
          {lastScanLabel && (
            <span className="block text-[10px] text-text-muted truncate mt-0.5">
              Last scan: {lastScanLabel}
            </span>
          )}
        </span>
      </button>
    );
  }

  // Expanded variant: full system overview
  return (
    <div className="mx-2 mb-3 rounded-md bg-[var(--bg-card)] border border-[var(--border)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
        <HexIcon size="sm" accent={accent} idSuffix="sidebar-overview">
          <Hexagon className="w-3.5 h-3.5" strokeWidth={2.5} />
        </HexIcon>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary truncate">
            System overview
          </span>
          {osName && (
            <span className="block text-[10.5px] text-text-primary font-mono truncate mt-0.5">
              {osName}
            </span>
          )}
        </span>
      </div>
      <dl className="px-4 py-3 space-y-1.5">
        {cpu && <SpecRow label="CPU" value={cpu} />}
        {gpu && <SpecRow label="GPU" value={gpu} />}
        {ram && <SpecRow label="RAM" value={ram} />}
      </dl>
      {onDetailsClick && (
        <button
          type="button"
          onClick={onDetailsClick}
          className="group w-full flex items-center justify-between px-4 py-2.5 text-[10.5px] uppercase tracking-[0.14em] font-semibold text-text-secondary hover:text-text-primary border-t border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          <span>Details</span>
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10.5px]">
      <dt className="font-mono text-text-muted uppercase tracking-[0.08em] shrink-0">
        {label}
      </dt>
      <dd className="font-mono text-text-secondary truncate text-right" title={value}>
        {value}
      </dd>
    </div>
  );
}
