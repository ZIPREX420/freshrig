// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";
import { Check } from "lucide-react";

export interface HexStep {
  /** Stable id, used for React keys + onStepClick payloads. */
  id: string;
  /** Short label below the hex (e.g. "SCANNEN", "SELECTEREN"). */
  label: string;
  /** Optional icon to swap in instead of the step number. */
  icon?: ReactNode;
}

export interface HexStepperProps {
  /** Ordered steps. Mockup-2 uses 5 of them — array length is unbounded but
   *  >6 will start to crowd visually. */
  steps: HexStep[];
  /** Index of the current (in-progress) step. Steps before it render as
   *  "complete"; steps after as "pending". */
  current: number;
  /** Optional click handler — receives the step id. Useful for "go back to
   *  step 2" navigation. Disabled when undefined. */
  onStepClick?: (stepId: string, index: number) => void;
  className?: string;
}

type StepStatus = "complete" | "current" | "pending";

/**
 * Horizontal hexagonal step indicator. Mirrors the 5-step wizard at the top
 * of mockup-2's Snelsetup and Aangepaste setup screens.
 *
 * Layout: row of hex-shaped step badges, each with a number (or icon when
 * complete) inside, and a label below. Connecting lines between hexes show
 * progress — solid cyan up to and including the current step, faint border
 * after.
 *
 * Accessibility: rendered as `<ol>` with each step a `<li>`. When
 * `onStepClick` is provided, completed and current steps become buttons.
 */
export function HexStepper({
  steps,
  current,
  onStepClick,
  className = "",
}: HexStepperProps) {
  return (
    <ol className={`flex items-start justify-between gap-2 ${className}`}>
      {steps.map((step, i) => {
        const status: StepStatus =
          i < current ? "complete" : i === current ? "current" : "pending";
        const isLast = i === steps.length - 1;
        return (
          <li
            key={step.id}
            className="flex-1 flex items-center min-w-0"
          >
            <StepHex
              index={i + 1}
              label={step.label}
              status={status}
              icon={step.icon}
              onClick={
                onStepClick && status !== "pending"
                  ? () => onStepClick(step.id, i)
                  : undefined
              }
            />
            {!isLast && <Connector active={i < current} />}
          </li>
        );
      })}
    </ol>
  );
}

function StepHex({
  index,
  label,
  status,
  icon,
  onClick,
}: {
  index: number;
  label: string;
  status: StepStatus;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const isClickable = !!onClick;
  // Stroke + fill + glow per status.
  const palette =
    status === "current"
      ? {
          stroke: "var(--accent-cyan)",
          fill: "var(--accent-cyan-soft)",
          text: "var(--accent-cyan)",
          glow: "drop-shadow(0 0 12px var(--accent-cyan-glow))",
        }
      : status === "complete"
      ? {
          stroke: "var(--accent-cyan-rim)",
          fill: "var(--accent-cyan-soft)",
          text: "var(--accent-cyan)",
          glow: "none",
        }
      : {
          stroke: "var(--border)",
          fill: "transparent",
          text: "var(--text-muted)",
          glow: "none",
        };

  const Tag: "button" | "div" = isClickable ? "button" : "div";

  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      <Tag
        type={isClickable ? "button" : undefined}
        onClick={onClick}
        className={`relative flex items-center justify-center w-12 h-12 transition-transform ${
          isClickable
            ? "cursor-pointer hover:scale-[1.06] active:scale-[0.98]"
            : ""
        }`}
        style={{ filter: palette.glow }}
        aria-current={status === "current" ? "step" : undefined}
      >
        <svg
          viewBox="0 0 64 64"
          width={48}
          height={48}
          aria-hidden="true"
          className="absolute inset-0"
        >
          <polygon
            points="32,4 56,18 56,46 32,60 8,46 8,18"
            fill={palette.fill}
            stroke={palette.stroke}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        </svg>
        <span
          className="relative font-semibold text-[13px]"
          style={{ color: palette.text }}
        >
          {status === "complete" ? (
            <Check className="w-4 h-4" strokeWidth={3} aria-hidden="true" />
          ) : (
            icon ?? index
          )}
        </span>
      </Tag>
      <span
        className={`text-[10.5px] uppercase tracking-[0.12em] font-semibold text-center truncate max-w-[110px] ${
          status === "current"
            ? "text-text-primary"
            : status === "complete"
            ? "text-text-secondary"
            : "text-text-muted"
        }`}
      >
        {index}. {label}
      </span>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex-1 h-px mx-1 mt-6"
      style={{
        background: active
          ? "linear-gradient(to right, var(--accent-cyan-rim), var(--accent-cyan))"
          : "var(--border)",
      }}
    />
  );
}
