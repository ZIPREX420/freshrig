// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { forwardRef } from "react";
import type { HTMLAttributes } from "react";

export type CardVariant = "default" | "elevated" | "glass" | "hero";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Hover-glow + subtle Y-translate when true. Used for "click for details" affordance. */
  interactive?: boolean;
  /** Visual variant.
   *  - default:  flat card with inset top-edge highlight (current Card)
   *  - elevated: drop-shadow for floating panels
   *  - glass:    backdrop-blur for modals/floating panes
   *  - hero:     cyan→magenta gradient border + soft neon glow (lead card)
   */
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  default:  "bg-bg-card border border-border rounded-lg",
  elevated: "bg-bg-elevated border border-border rounded-lg",
  glass:    "bg-bg-card/70 backdrop-blur-md border border-[var(--accent-cyan-rim)]/30 rounded-lg",
  // `neon-edge` (defined in styles.css) paints a 1px gradient border via the
  // padding-box / border-box trick so the cyan→magenta edge is crisp on any
  // background — matches the showcase cards in the reference shots.
  hero:     "neon-edge relative overflow-hidden rounded-lg",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = "", interactive = false, variant = "default", children, ...props },
  ref,
) {
  const innerRim = "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
  const elev =
    variant === "elevated"
      ? "shadow-[0_16px_32px_rgba(0,0,0,0.6),0_4px_8px_rgba(0,0,0,0.4)]"
      : variant === "hero"
      ? "shadow-[0_0_32px_-8px_var(--accent-cyan-glow),0_0_24px_-6px_var(--accent-magenta-glow)]"
      : "";
  const interactiveClasses = interactive
    ? "card-glow-hover cursor-pointer"
    : "transition-colors duration-150 hover:border-border-hover";

  return (
    <div
      ref={ref}
      className={`${variantClasses[variant]} ${innerRim} ${elev} ${interactiveClasses} ${className}`}
      {...props}
    >
      {variant === "hero" && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[var(--accent-cyan-soft)] via-transparent to-[var(--accent-magenta-soft)] pointer-events-none"
        />
      )}
      <div className={variant === "hero" ? "relative" : ""}>{children}</div>
    </div>
  );
});
