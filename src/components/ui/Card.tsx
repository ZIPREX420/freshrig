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
   *  - hero:     accent left rail + subtle accent gradient corner (use for the lead card on a page)
   */
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  default:  "bg-bg-card border border-border rounded-xl",
  elevated: "bg-bg-elevated border border-border rounded-xl",
  glass:    "bg-bg-card/80 backdrop-blur-md border border-border rounded-xl",
  hero:     "relative overflow-hidden bg-bg-card border border-border rounded-xl",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = "", interactive = false, variant = "default", children, ...props },
  ref,
) {
  const innerRim = "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
  const elev = variant === "elevated" ? "shadow-[0_4px_12px_rgba(0,0,0,0.5),0_2px_4px_rgba(0,0,0,0.3)]" : "";
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
        <>
          <span
            aria-hidden="true"
            className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full bg-accent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-accent-subtle to-transparent pointer-events-none opacity-60"
          />
        </>
      )}
      <div className={variant === "hero" ? "relative" : ""}>{children}</div>
    </div>
  );
});
