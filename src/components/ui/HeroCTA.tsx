// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { ChevronRight } from "lucide-react";

export type HeroCTAAccent = "cyan" | "magenta";

export interface HeroCTAProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button accent. cyan = primary safe action ("START NU", "SNELSETUP STARTEN").
   *  magenta = creative / pro / commit ("AANGEPASTE SETUP MAKEN", "Upgrade"). */
  accent?: HeroCTAAccent;
  /** Hide the trailing chevron — rare; default behaviour matches the mockups. */
  hideArrow?: boolean;
  /** Take full container width (default true — these are page-level CTAs). */
  fullWidth?: boolean;
}

/**
 * Page-level outlined neon pill button.
 *
 * Visually distinct from the inline `<Button>`:
 *   - 56–64px tall with wider letter-spacing
 *   - Transparent fill, 1.5× heavier neon glow ring than inline buttons
 *   - Centred uppercase label + trailing chevron baked in
 *   - Spans full container width by default
 *
 * Used as the section / page conclusion CTA — "START NU" on the splash,
 * "SNELSETUP STARTEN" at the bottom of the Quick Setup page, etc. There
 * should typically be exactly one of these visible at a time per surface.
 */
export const HeroCTA = forwardRef<HTMLButtonElement, HeroCTAProps>(function HeroCTA(
  {
    accent = "cyan",
    hideArrow = false,
    fullWidth = true,
    className = "",
    children,
    ...props
  },
  ref,
) {
  const palette =
    accent === "magenta"
      ? {
          text: "text-[var(--accent-magenta)] hover:text-[var(--accent-magenta-hover)]",
          border: "border-[var(--accent-magenta-rim)]",
          shadow:
            "shadow-[var(--shadow-hero-cta-magenta)] hover:shadow-[var(--shadow-hero-cta-magenta-hover)]",
          fill: "hover:bg-[var(--accent-magenta-soft)]",
        }
      : {
          text: "text-[var(--accent-cyan)] hover:text-[var(--accent-cyan-hover)]",
          border: "border-[var(--accent-cyan-rim)]",
          shadow:
            "shadow-[var(--shadow-hero-cta-cyan)] hover:shadow-[var(--shadow-hero-cta-cyan-hover)]",
          fill: "hover:bg-[var(--accent-cyan-soft)]",
        };

  return (
    <button
      ref={ref}
      className={[
        "group inline-flex items-center justify-center gap-3",
        fullWidth ? "w-full" : "",
        "px-8 py-4 min-h-[56px]",
        "rounded-md border bg-transparent",
        "text-sm font-semibold uppercase tracking-[0.18em]",
        "transition-all duration-200 active:scale-[0.99]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
        palette.text,
        palette.border,
        palette.shadow,
        palette.fill,
        className,
      ].join(" ")}
      {...props}
    >
      <span className="relative">{children}</span>
      {!hideArrow && (
        <ChevronRight
          className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
          aria-hidden="true"
        />
      )}
    </button>
  );
});
