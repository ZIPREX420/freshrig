// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { HexIcon } from "./HexIcon";
import type { HexAccent } from "./HexIcon";

export type ActionTileVariant = "compact" | "tall";

export interface ActionTileProps {
  /** Lucide icon shown inside the hex thumbnail. */
  icon: ReactNode;
  /** Title — short, uppercase, identifies the action ("SNELSETUP"). */
  title: string;
  /** 1–2 line description sitting below the title. */
  description?: string;
  /** Click handler — typically onNavigate("quickSetup"). */
  onClick?: () => void;
  /** Hex thumbnail accent. cyan = primary safe, magenta = creative / pro. */
  accent?: HexAccent;
  /** `compact` (mockup-2 dashboard, 4-up grid, smaller hex) vs `tall`
   *  (mockup-1 home, 3-up grid, larger hex). */
  variant?: ActionTileVariant;
  /** When set, replaces the default chevron with a custom right-side slot. */
  rightSlot?: ReactNode;
  /** Disambiguates SVG IDs when multiple ActionTiles render together. */
  idSuffix?: string;
  className?: string;
}

/**
 * Big, neon-rimmed action card with a centred hex thumbnail. Used as the
 * primary navigation-into-flow affordance on Home / Dashboard / hub pages.
 *
 * Visual recipe (from mockup-1 top-right + mockup-2 dashboard):
 *   - Outlined 1px rim with subtle accent-tinted shadow
 *   - Centered hex icon (cyan or magenta)
 *   - Centered title (uppercase, letter-spaced)
 *   - Centered description (1–2 muted lines)
 *   - Trailing chevron in the bottom-right corner
 *   - On hover: rim brightens, slight upward translate, glow intensifies
 */
export function ActionTile({
  icon,
  title,
  description,
  onClick,
  accent = "cyan",
  variant = "tall",
  rightSlot,
  idSuffix = "",
  className = "",
}: ActionTileProps) {
  const palette =
    accent === "magenta"
      ? {
          rim: "border-[var(--accent-magenta-rim)]",
          shadow:
            "shadow-[0_0_0_1px_var(--accent-magenta-rim),0_0_24px_-8px_var(--accent-magenta-glow)]",
          hoverShadow:
            "hover:shadow-[0_0_0_1px_var(--accent-magenta-rim),0_0_40px_-4px_var(--accent-magenta-glow)]",
        }
      : {
          rim: "border-[var(--accent-cyan-rim)]",
          shadow:
            "shadow-[0_0_0_1px_var(--accent-cyan-rim),0_0_24px_-8px_var(--accent-cyan-glow)]",
          hoverShadow:
            "hover:shadow-[0_0_0_1px_var(--accent-cyan-rim),0_0_40px_-4px_var(--accent-cyan-glow)]",
        };

  const padding = variant === "compact" ? "p-5" : "p-7";
  const hexSize = variant === "compact" ? "lg" : "xl";
  const titleSize = variant === "compact" ? "text-[13px]" : "text-[15px]";
  const descSize = variant === "compact" ? "text-[12px]" : "text-[13px]";
  const minHeight = variant === "compact" ? "min-h-[200px]" : "min-h-[260px]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative flex flex-col items-center justify-between text-center",
        "rounded-lg border bg-[var(--bg-card)]",
        "transition-all duration-200",
        "hover:bg-[var(--bg-card-hover)] hover:-translate-y-0.5",
        "active:translate-y-0 active:scale-[0.99]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
        accent === "magenta"
          ? "focus-visible:ring-[var(--accent-magenta-rim)]"
          : "focus-visible:ring-[var(--accent-cyan-rim)]",
        padding,
        minHeight,
        palette.rim,
        palette.shadow,
        palette.hoverShadow,
        "cursor-pointer",
        className,
      ].join(" ")}
    >
      <span className="flex flex-col items-center gap-4 mt-2">
        <HexIcon
          size={hexSize}
          accent={accent}
          perspectiveFloor
          idSuffix={`${idSuffix}-tile`}
        >
          {icon}
        </HexIcon>
        <span className="flex flex-col items-center gap-1.5 px-2">
          <span
            className={`font-semibold uppercase tracking-[0.14em] text-text-primary ${titleSize}`}
          >
            {title}
          </span>
          {description && (
            <span className={`text-text-secondary leading-relaxed ${descSize}`}>
              {description}
            </span>
          )}
        </span>
      </span>
      <span className="absolute bottom-3 right-3 text-text-muted group-hover:text-text-primary transition-colors">
        {rightSlot ?? <ChevronRight className="w-4 h-4" aria-hidden="true" />}
      </span>
    </button>
  );
}
