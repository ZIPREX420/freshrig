// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";

export type HealthRingSize = "sm" | "md" | "lg" | "xl";

interface HealthRingProps {
  /** 0..100 */
  value: number;
  /** Visual size. sm=64px, md=96px, lg=128px, xl=192px. */
  size?: HealthRingSize;
  /** Override the ring color. If omitted, color is derived from value (green/yellow/red). */
  color?: "auto" | "success" | "warning" | "error" | "accent";
  /** Center label override. Defaults to the numeric value. */
  label?: ReactNode;
  /** Sub-label under the value (e.g., "/ 100"). */
  sublabel?: ReactNode;
  /** ARIA label for screen readers. */
  ariaLabel?: string;
  className?: string;
}

const sizes: Record<HealthRingSize, { px: number; stroke: number; valueClass: string; sublabelClass: string }> = {
  sm: { px:  64, stroke:  5, valueClass: "text-base font-semibold",   sublabelClass: "text-[9px]" },
  md: { px:  96, stroke:  6, valueClass: "text-2xl font-semibold",     sublabelClass: "text-[10px]" },
  lg: { px: 128, stroke:  8, valueClass: "text-[32px] font-semibold",  sublabelClass: "text-xs" },
  xl: { px: 192, stroke: 10, valueClass: "text-[56px] font-semibold leading-none", sublabelClass: "text-xs" },
};

function autoColor(value: number): string {
  if (value >= 80) return "var(--success)";
  if (value >= 50) return "var(--warning)";
  return "var(--error)";
}

function tokenForColor(color: HealthRingProps["color"], value: number): string {
  if (!color || color === "auto") return autoColor(value);
  if (color === "accent") return "var(--accent)";
  return `var(--${color})`;
}

export function HealthRing({
  value,
  size = "md",
  color = "auto",
  label,
  sublabel,
  ariaLabel,
  className = "",
}: HealthRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const cfg = sizes[size];
  const radius = (cfg.px - cfg.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const strokeColor = tokenForColor(color, clamped);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: cfg.px, height: cfg.px }}>
      <svg
        className="-rotate-90"
        width={cfg.px}
        height={cfg.px}
        viewBox={`0 0 ${cfg.px} ${cfg.px}`}
        role="img"
        aria-label={ariaLabel ?? `Health ring: ${clamped} of 100`}
      >
        <circle
          cx={cfg.px / 2}
          cy={cfg.px / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={cfg.stroke}
        />
        <circle
          cx={cfg.px / 2}
          cy={cfg.px / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out, stroke 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`tabular ${cfg.valueClass}`} style={{ color: strokeColor }}>
          {label ?? clamped}
        </span>
        {sublabel && (
          <span className={`text-text-muted mt-0.5 ${cfg.sublabelClass}`}>{sublabel}</span>
        )}
      </div>
    </div>
  );
}
