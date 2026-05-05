// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";

interface MetricChipProps {
  label: string;
  value: ReactNode;
  /** Tint the chip when the value warrants attention. */
  state?: "default" | "warning" | "error";
  /** 0..1 progress fill behind the value (e.g., 0.42 for 42% disk used). */
  progress?: number;
  /** Sparkline samples (8-20 numbers) — drawn as a 24px-tall mini chart. */
  sparkline?: number[];
  /** Optional sub-text. */
  sub?: string;
  className?: string;
}

const stateStyles: Record<NonNullable<MetricChipProps["state"]>, { bar: string; valueClass: string }> = {
  default: { bar: "bg-accent",  valueClass: "text-text-primary" },
  warning: { bar: "bg-warning", valueClass: "text-warning" },
  error:   { bar: "bg-error",   valueClass: "text-error" },
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-6 mt-1.5 opacity-60">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={points}
      />
    </svg>
  );
}

export function MetricChip({
  label,
  value,
  state = "default",
  progress,
  sparkline,
  sub,
  className = "",
}: MetricChipProps) {
  const style = stateStyles[state];
  const progressPct = progress != null ? Math.max(0, Math.min(1, progress)) * 100 : null;

  return (
    <div
      className={`relative overflow-hidden bg-bg-card border border-border rounded-lg px-3.5 py-2.5 min-w-[140px] ${className}`}
      style={{ boxShadow: "var(--shadow-inner-rim)" }}
    >
      <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-[17px] font-semibold tabular leading-tight mt-0.5 ${style.valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5 truncate">{sub}</p>}
      {sparkline && sparkline.length > 1 && (
        <Sparkline
          data={sparkline}
          color={state === "warning" ? "var(--warning)" : state === "error" ? "var(--error)" : "var(--accent)"}
        />
      )}
      {progressPct != null && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04]">
          <div
            className={`h-full ${style.bar} transition-all duration-700 ease-out`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
