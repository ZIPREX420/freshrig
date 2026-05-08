// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Outlined-neon system. `primary` is the cyan call-to-action (matches the
// reference "START NU" / "SNELSETUP STARTEN" buttons — dark fill, cyan rim,
// inner glow). `danger` adopts the magenta side. `secondary`/`ghost` stay
// quieter for chrome and inline actions so the eye still finds the primary.
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent-cyan-soft)] hover:bg-[color-mix(in_srgb,var(--accent-cyan)_18%,transparent)] " +
    "text-[var(--accent-cyan)] hover:text-[var(--accent-cyan-hover)] " +
    "border border-[var(--accent-cyan-rim)] " +
    "shadow-[0_0_0_1px_var(--accent-cyan-rim),0_0_16px_-4px_var(--accent-cyan-glow)] " +
    "hover:shadow-[0_0_0_1px_var(--accent-cyan-rim),0_0_24px_-2px_var(--accent-cyan-glow)] " +
    "font-semibold tracking-wide",
  secondary:
    "bg-white/[0.03] hover:bg-white/[0.08] text-text-primary border border-border hover:border-border-hover",
  ghost:
    "hover:bg-white/[0.04] text-text-secondary hover:text-text-primary",
  danger:
    "bg-[var(--accent-magenta-soft)] hover:bg-[color-mix(in_srgb,var(--accent-magenta)_18%,transparent)] " +
    "text-[var(--accent-magenta)] hover:text-[var(--accent-magenta-hover)] " +
    "border border-[var(--accent-magenta-rim)] " +
    "shadow-[0_0_0_1px_var(--accent-magenta-rim),0_0_16px_-4px_var(--accent-magenta-glow)] " +
    "hover:shadow-[0_0_0_1px_var(--accent-magenta-rim),0_0_24px_-2px_var(--accent-magenta-glow)] " +
    "font-semibold",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-md gap-1.5",
  md: "px-4 py-2 text-sm rounded-md gap-1.5",
  lg: "px-6 py-2.5 text-[15px] rounded-md gap-2 font-medium",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", variant = "primary", size = "md", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center transition-all duration-150 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
