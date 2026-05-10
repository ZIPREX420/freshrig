// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";

export type ProgressRingAccent = "cyan" | "magenta" | "success" | "warning" | "error";
export type ProgressRingSize = "sm" | "md" | "lg" | "xl";

export interface ProgressRingProps {
  /** 0–100 progress value. Ignored when `indeterminate` is true. */
  value?: number;
  /** Visual size preset. xl = page-centerpiece (mockup-2 health score / scan). */
  size?: ProgressRingSize;
  /** Ring colour. */
  accent?: ProgressRingAccent;
  /** Indeterminate scanning mode — value ignored, dashed arc rotates. */
  indeterminate?: boolean;
  /** Centre label override. Defaults to "{value}%" when value is set. */
  label?: ReactNode;
  /** Below-centre sublabel ("UITSTEKEND", "Scannen…"). */
  sublabel?: ReactNode;
  className?: string;
}

const SIZE_PX: Record<ProgressRingSize, number> = {
  sm: 64,
  md: 96,
  lg: 144,
  xl: 200,
};

const STROKE_WIDTH: Record<ProgressRingSize, number> = {
  sm: 5,
  md: 6,
  lg: 7,
  xl: 8,
};

const LABEL_PX: Record<ProgressRingSize, number> = {
  sm: 14,
  md: 22,
  lg: 32,
  xl: 44,
};

const SUBLABEL_PX: Record<ProgressRingSize, number> = {
  sm: 9,
  md: 10,
  lg: 11,
  xl: 12,
};

/**
 * Animated circular gauge — used for the dashboard health score (98/100,
 * mockup-2 top-right) and the Snelsetup scan progress (76% scanning,
 * mockup-2 bottom-left). Distinct from the dashboard `HealthRing` which is
 * static / score-only; this one supports indeterminate scanning + colour-
 * shifts mid-scan.
 */
export function ProgressRing({
  value = 0,
  size = "lg",
  accent = "cyan",
  indeterminate = false,
  label,
  sublabel,
  className = "",
}: ProgressRingProps) {
  const px = SIZE_PX[size];
  const strokeW = STROKE_WIDTH[size];
  const r = (px - strokeW) / 2;
  const circumference = 2 * Math.PI * r;
  const clampedValue = Math.max(0, Math.min(100, value));
  // Indeterminate: short rotating dash. Determinate: arc length proportional to value.
  const dashLen = indeterminate ? circumference * 0.25 : (clampedValue / 100) * circumference;
  const dashGap = circumference - dashLen;

  const stroke =
    accent === "magenta"
      ? "var(--accent-magenta)"
      : accent === "success"
      ? "var(--success)"
      : accent === "warning"
      ? "var(--warning)"
      : accent === "error"
      ? "var(--error)"
      : "var(--accent-cyan)";

  const glow =
    accent === "magenta"
      ? "drop-shadow(0 0 12px var(--accent-magenta-glow))"
      : accent === "success"
      ? "drop-shadow(0 0 12px rgba(34, 227, 164, 0.45))"
      : accent === "warning"
      ? "drop-shadow(0 0 12px rgba(255, 181, 71, 0.45))"
      : accent === "error"
      ? "drop-shadow(0 0 12px rgba(255, 77, 109, 0.45))"
      : "drop-shadow(0 0 12px var(--accent-cyan-glow))";

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} aria-hidden="true">
        {/* Track — faint full ring */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeW}
        />
        {/* Tick marks every 30deg — subtle, reinforces the "instrument panel" feel */}
        {size !== "sm" &&
          Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180 - Math.PI / 2;
            const x1 = px / 2 + (r - strokeW * 0.6) * Math.cos(angle);
            const y1 = px / 2 + (r - strokeW * 0.6) * Math.sin(angle);
            const x2 = px / 2 + (r + strokeW * 0.4) * Math.cos(angle);
            const y2 = px / 2 + (r + strokeW * 0.4) * Math.sin(angle);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--border-hover)"
                strokeWidth={1}
                opacity={0.6}
              />
            );
          })}
        {/* Animated progress arc */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${dashLen} ${dashGap}`}
          transform={`rotate(-90 ${px / 2} ${px / 2})`}
          style={{
            filter: glow,
            transition: indeterminate ? "none" : "stroke-dasharray 600ms ease-out",
          }}
          className={indeterminate ? "animate-scan-rotate" : ""}
        />
      </svg>
      {/* Centre label stack */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
        style={{ color: stroke }}
      >
        <span
          className="font-semibold tabular leading-none"
          style={{ fontSize: LABEL_PX[size] }}
        >
          {label ?? (indeterminate ? "…" : `${Math.round(clampedValue)}%`)}
        </span>
        {sublabel && (
          <span
            className="mt-1 font-mono uppercase tracking-[0.16em] text-text-muted"
            style={{ fontSize: SUBLABEL_PX[size] }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
