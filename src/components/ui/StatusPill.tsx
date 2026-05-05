// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type StatusPillKind = "success" | "warning" | "error" | "info" | "neutral" | "accent";
export type StatusPillSize = "xs" | "sm" | "md";

interface StatusPillProps {
  kind?: StatusPillKind;
  size?: StatusPillSize;
  icon?: LucideIcon;
  mono?: boolean;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

const kindStyles: Record<StatusPillKind, string> = {
  success: "bg-success-soft text-success ring-success-rim",
  warning: "bg-warning-soft text-warning ring-warning-rim",
  error:   "bg-error-soft text-error ring-error-rim",
  info:    "bg-info-soft text-info ring-info-rim",
  neutral: "bg-white/[0.04] text-text-secondary ring-border",
  accent:  "bg-accent-subtle text-accent ring-accent-ring",
};

const sizeStyles: Record<StatusPillSize, string> = {
  xs: "text-[10px] px-1.5 py-[1px] gap-1 leading-tight",
  sm: "text-[11px] px-2 py-0.5 gap-1.5",
  md: "text-xs px-2.5 py-1 gap-1.5",
};

const iconSizes: Record<StatusPillSize, string> = {
  xs: "w-3 h-3",
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
};

export function StatusPill({
  kind = "neutral",
  size = "sm",
  icon: Icon,
  mono = false,
  pulse = false,
  children,
  className = "",
}: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded ring-1 ring-inset ${kindStyles[kind]} ${sizeStyles[size]} ${mono ? "font-mono tracking-wider" : ""} ${className}`}
    >
      {pulse && (
        <span
          aria-hidden="true"
          className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse-soft`}
        />
      )}
      {Icon && <Icon className={iconSizes[size]} />}
      {children}
    </span>
  );
}
