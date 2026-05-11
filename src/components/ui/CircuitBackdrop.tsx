// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useMemo } from "react";

export type CircuitBackdropAccent = "cyan" | "magenta" | "dual";
export type CircuitBackdropDensity = "sparse" | "normal" | "dense";

export interface CircuitBackdropProps {
  /** Tint of the circuit lines. `dual` paints cyan on the left half, magenta
   *  on the right — matches the splash mockup's two-tone vibe. */
  accent?: CircuitBackdropAccent;
  density?: CircuitBackdropDensity;
  className?: string;
}

/**
 * Full-bleed circuit-board / data-stream backdrop. Pure SVG, no images.
 * Renders behind splash / welcome content and inside hero hex containers
 * (when scaled down via clipPath). Pointer-events disabled so it never
 * interferes with foreground interaction.
 *
 * Visual recipe (matches mockup-1 splash):
 *   - Vertical "data rain" lines of varying length + opacity
 *   - Horizontal connector segments at random heights
 *   - Cluster of trace nodes (small filled circles) where connectors join
 *   - Subtle gradient mask: brightest at left & right edges, dimmer in centre
 *
 * Sized to fill its parent (`width: 100%; height: 100%; absolute inset-0`).
 */
export function CircuitBackdrop({
  accent = "dual",
  density = "normal",
  className = "",
}: CircuitBackdropProps) {
  // Deterministic per-render. (accent, density) is the full input set —
  // memoize so the backdrop doesn't churn on every parent state change.
  const { verticalLines, horizontalSegments, nodes } = useMemo(() => {
    const lineCount = density === "dense" ? 60 : density === "sparse" ? 20 : 38;
    const nodeCount = density === "dense" ? 28 : density === "sparse" ? 10 : 18;

    const rand = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const cyanColor = "var(--accent-cyan)";
    const magentaColor = "var(--accent-magenta)";
    const colorAt = (x: number) => {
      if (accent === "cyan") return cyanColor;
      if (accent === "magenta") return magentaColor;
      return x < 50 ? cyanColor : magentaColor;
    };

    const verticalLines = Array.from({ length: lineCount }).map((_, i) => {
      const x = (i / (lineCount - 1)) * 100;
      const y1 = rand(i * 1.7) * 30;
      const y2 = y1 + 30 + rand(i * 2.3) * 50;
      const opacity = 0.08 + rand(i * 3.1) * 0.18;
      return { x, y1, y2, opacity, color: colorAt(x), key: `v-${i}` };
    });

    const horizontalSegments = Array.from({ length: Math.floor(lineCount / 3) }).map(
      (_, i) => {
        const y = 5 + rand(i * 5.7) * 90;
        const x1 = rand(i * 7.3) * 70;
        const x2 = x1 + 8 + rand(i * 4.9) * 22;
        const opacity = 0.10 + rand(i * 11.7) * 0.18;
        return { y, x1, x2, opacity, color: colorAt((x1 + x2) / 2), key: `h-${i}` };
      },
    );

    const nodes = Array.from({ length: nodeCount }).map((_, i) => {
      const x = rand(i * 13.7) * 100;
      const y = rand(i * 17.3) * 100;
      const r = 0.18 + rand(i * 19.1) * 0.32;
      const opacity = 0.30 + rand(i * 23.7) * 0.40;
      return { x, y, r, opacity, color: colorAt(x), key: `n-${i}` };
    });

    return { verticalLines, horizontalSegments, nodes };
  }, [accent, density]);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 50%, black 50%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 50%, black 50%, transparent 100%)",
        }}
      >
        {verticalLines.map((l) => (
          <line
            key={l.key}
            x1={l.x}
            y1={l.y1}
            x2={l.x}
            y2={l.y2}
            stroke={l.color}
            strokeWidth={0.18}
            opacity={l.opacity}
          />
        ))}
        {horizontalSegments.map((s) => (
          <line
            key={s.key}
            x1={s.x1}
            y1={s.y}
            x2={s.x2}
            y2={s.y}
            stroke={s.color}
            strokeWidth={0.18}
            opacity={s.opacity}
          />
        ))}
        {nodes.map((n) => (
          <circle
            key={n.key}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.color}
            opacity={n.opacity}
          />
        ))}
      </svg>
    </div>
  );
}
