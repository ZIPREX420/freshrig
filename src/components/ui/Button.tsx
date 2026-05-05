// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent hover:bg-accent-hover text-black font-medium shadow-[var(--shadow-card)]",
  secondary:
    "bg-white/[0.06] hover:bg-white/[0.10] text-text-primary border border-border hover:border-border-hover",
  ghost:
    "hover:bg-white/[0.04] text-text-secondary hover:text-text-primary",
  danger:
    "bg-error/90 hover:bg-error text-white font-medium",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-md gap-1.5",
  md: "px-4 py-2 text-sm rounded-lg gap-1.5",
  lg: "px-6 py-2.5 text-[15px] rounded-lg gap-2 font-medium",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = "", variant = "primary", size = "md", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center transition-colors duration-150 active:scale-[0.97] duration-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
