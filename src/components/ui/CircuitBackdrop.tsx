// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useMemo } from "react";

export type CircuitBackdropAccent = "cyan" | "magenta" | "dual";
export type CircuitBackdropDensity = "sparse" | "normal" | "dense";

export interface CircuitBackdropProps {
  /** Tint of the circuit lines. `dual` paints cyan on the left half, magenta
   *  on the right — matches the splash mockup's two-tone vibe. */
  accent?: CircuitBackdropAccent;
  density?: CircuitBackdropDensity;
  /** When true, renders a dark city skyline silhouette at the bottom of the
   *  backdrop — the signature visual from the mockup hero sections. */
  showCityscape?: boolean;
  className?: string;
}

/**
 * Full-bleed circuit-board / data-stream backdrop. Pure SVG, no images.
 * Renders behind splash / welcome content and inside hero hex containers.
 * Pointer-events disabled so it never interferes with foreground interaction.
 *
 * Visual recipe (matches mockup-1 splash):
 *   - Vertical "data rain" lines of varying length + opacity
 *   - Horizontal connector segments at random heights
 *   - Cluster of trace nodes (small filled circles) where connectors join
 *   - Optional city skyline silhouette at the bottom (showCityscape=true)
 *   - Subtle gradient mask: brightest at left & right edges, dimmer in centre
 */
export function CircuitBackdrop({
  accent = "dual",
  density = "normal",
  showCityscape = false,
  className = "",
}: CircuitBackdropProps) {
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

      {/* City skyline silhouette — rendered as a second overlapping SVG so it
          uses a normal aspect ratio (16:9-ish) rather than the stretched
          preserveAspectRatio="none" of the circuit layer above.
          The skyline sits at the bottom third, dark silhouette with a faint
          neon rim glow at the roofline — matching the mockup aesthetic. */}
      {showCityscape && (
        <svg
          viewBox="0 0 1200 400"
          preserveAspectRatio="xMidYMax meet"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0"
        >
          <defs>
            {/* Roofline glow: thin band of the accent colour along the top
                edge of the skyline, fades quickly to transparent. */}
            <linearGradient id="skyline-glow-cyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.22" />
              <stop offset="35%" stopColor="var(--accent-cyan)" stopOpacity="0.06" />
              <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="skyline-glow-magenta" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-magenta)" stopOpacity="0.16" />
              <stop offset="35%" stopColor="var(--accent-magenta)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="var(--accent-magenta)" stopOpacity="0" />
            </linearGradient>
            {/* Dark fill for the building mass — slightly lighter than bg-base
                so the buildings read as distinct shapes without being garish. */}
            <linearGradient id="skyline-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a0c15" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#05060a" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* --- Background city layer (distant, lower, denser) --- */}
          {/* Spans full width at a lower horizon line (~y=230) */}
          <path
            d="
              M0,400 L0,290
              L20,290 L20,270 L35,270 L35,255 L50,255 L50,270
              L65,270 L65,260 L80,260 L80,245 L95,245 L95,260
              L115,260 L115,248 L130,248 L130,238 L145,238 L145,250
              L160,250 L160,235 L175,235 L175,242 L190,242 L190,228
              L205,228 L205,238 L220,238 L220,225 L235,225 L235,215
              L250,215 L250,228 L265,228 L265,220 L280,220 L280,235
              L295,235 L295,222 L310,222 L310,212 L325,212 L325,225
              L340,225 L340,218 L355,218 L355,230 L370,230 L370,218
              L385,218 L385,208 L400,208 L400,220 L415,220 L415,210
              L430,210 L430,225 L445,225 L445,215 L460,215 L460,222
              L475,222 L475,210 L490,210 L490,218 L505,218 L505,230
              L520,230 L520,218 L535,218 L535,208 L550,208 L550,225
              L565,225 L565,215 L580,215 L580,228 L595,228 L595,218
              L610,218 L610,232 L625,232 L625,220 L640,220 L640,210
              L655,210 L655,225 L670,225 L670,215 L685,215 L685,228
              L700,228 L700,220 L715,220 L715,208 L730,208 L730,220
              L745,220 L745,232 L760,232 L760,222 L775,222 L775,212
              L790,212 L790,228 L805,228 L805,218 L820,218 L820,205
              L835,205 L835,218 L850,218 L850,230 L865,230 L865,218
              L880,218 L880,208 L895,208 L895,225 L910,225 L910,235
              L925,235 L925,222 L940,222 L940,215 L955,215 L955,230
              L970,230 L970,240 L985,240 L985,252 L1000,252 L1000,240
              L1015,240 L1015,255 L1030,255 L1030,265 L1045,265 L1045,278
              L1060,278 L1060,268 L1075,268 L1075,258 L1090,258 L1090,272
              L1105,272 L1105,285 L1120,285 L1120,295 L1135,295 L1135,285
              L1150,285 L1150,298 L1165,298 L1165,290 L1180,290 L1180,300
              L1200,300 L1200,400 Z
            "
            fill="url(#skyline-fill)"
            opacity="0.55"
          />

          {/* Glow band along the distant roofline */}
          <path
            d="
              M0,400 L0,290
              L20,290 L20,270 L35,270 L35,255 L50,255 L50,270
              L65,270 L65,260 L80,260 L80,245 L95,245 L95,260
              L115,260 L115,248 L130,248 L130,238 L145,238 L145,250
              L160,250 L160,235 L175,235 L175,242 L190,242 L190,228
              L205,228 L205,238 L220,238 L220,225 L235,225 L235,215
              L250,215 L250,228 L265,228 L265,220 L280,220 L280,235
              L295,235 L295,222 L310,222 L310,212 L325,212 L325,225
              L340,225 L340,218 L355,218 L355,230 L370,230 L370,218
              L385,218 L385,208 L400,208 L400,220 L415,220 L415,210
              L430,210 L430,225 L445,225 L445,215 L460,215 L460,222
              L475,222 L475,210 L490,210 L490,218 L505,218 L505,230
              L520,230 L520,218 L535,218 L535,208 L550,208 L550,225
              L565,225 L565,215 L580,215 L580,228 L595,228 L595,218
              L610,218 L610,232 L625,232 L625,220 L640,220 L640,210
              L655,210 L655,225 L670,225 L670,215 L685,215 L685,228
              L700,228 L700,220 L715,220 L715,208 L730,208 L730,220
              L745,220 L745,232 L760,232 L760,222 L775,222 L775,212
              L790,212 L790,228 L805,228 L805,218 L820,218 L820,205
              L835,205 L835,218 L850,218 L850,230 L865,230 L865,218
              L880,218 L880,208 L895,208 L895,225 L910,225 L910,235
              L925,235 L925,222 L940,222 L940,215 L955,215 L955,230
              L970,230 L970,240 L985,240 L985,252 L1000,252 L1000,240
              L1015,240 L1015,255 L1030,255 L1030,265 L1045,265 L1045,278
              L1060,278 L1060,268 L1075,268 L1075,258 L1090,258 L1090,272
              L1105,272 L1105,285 L1120,285 L1120,295 L1135,295 L1135,285
              L1150,285 L1150,298 L1165,298 L1165,290 L1180,290 L1180,300
              L1200,300 L1200,400 Z
            "
            fill="url(#skyline-glow-cyan)"
            opacity="0.7"
          />

          {/* --- Foreground city layer (taller, closer, higher contrast) --- */}
          <path
            d="
              M0,400 L0,340
              L18,340 L18,310 L18,295 L30,295 L30,275 L42,275 L42,260
              L54,260 L54,240 L66,240 L66,256 L75,256 L75,240
              L88,240 L88,268 L98,268 L98,252 L110,252 L110,238
              L122,238 L122,220 L134,220 L134,208 L146,208 L146,195
              L158,195 L158,182 L170,182 L170,170 L176,170 L176,158
              L184,158 L184,170 L190,170 L190,185 L202,185 L202,195
              L214,195 L214,208 L226,208 L226,192 L238,192 L238,178
              L250,178 L250,165 L258,165 L258,152 L266,152 L266,140
              L274,140 L274,128 L282,128 L282,118 L290,118 L290,108
              L296,108 L296,98  L302,98  L302,88  L308,88  L308,78
              L314,78  L314,88  L320,88  L320,100 L326,100 L326,112
              L332,112 L332,125 L340,125 L340,115 L348,115 L348,105
              L356,105 L356,118 L364,118 L364,130 L372,130 L372,118
              L380,118 L380,108 L388,108 L388,120 L396,120 L396,135
              L404,135 L404,148 L412,148 L412,162 L420,162 L420,176
              L428,176 L428,188 L436,188 L436,175 L444,175 L444,162
              L452,162 L452,148 L460,148 L460,138 L468,138 L468,125
              L476,125 L476,112 L484,112 L484,100 L490,100 L490,90
              L496,90  L496,80  L502,80  L502,72  L508,72  L508,64
              L514,64  L514,74  L520,74  L520,86  L526,86  L526,98
              L532,98  L532,112 L540,112 L540,125 L548,125 L548,138
              L556,138 L556,152 L564,152 L564,165 L572,165 L572,155
              L580,155 L580,145 L588,145 L588,132 L596,132 L596,120
              L604,120 L604,108 L610,108 L610,98  L616,98  L616,88
              L622,88  L622,78  L628,78  L628,70  L634,70  L634,62
              L640,62  L640,74  L646,74  L646,86  L652,86  L652,100
              L660,100 L660,115 L668,115 L668,130 L676,130 L676,145
              L684,145 L684,158 L692,158 L692,170 L700,170 L700,182
              L708,182 L708,192 L716,192 L716,178 L724,178 L724,165
              L732,165 L732,152 L740,152 L740,140 L748,140 L748,128
              L754,128 L754,118 L760,118 L760,108 L766,108 L766,98
              L772,98  L772,90  L778,90  L778,82  L784,82  L784,74
              L790,74  L790,86  L796,86  L796,98  L802,98  L802,112
              L810,112 L810,128 L818,128 L818,145 L826,145 L826,158
              L834,158 L834,170 L842,170 L842,185 L850,185 L850,196
              L860,196 L860,208 L872,208 L872,222 L884,222 L884,238
              L896,238 L896,252 L908,252 L908,265 L920,265 L920,278
              L932,278 L932,290 L944,290 L944,305 L956,305 L956,318
              L968,318 L968,330 L980,330 L980,340 L992,340 L992,352
              L1004,352 L1004,340 L1016,340 L1016,328 L1028,328 L1028,315
              L1040,315 L1040,328 L1052,328 L1052,340 L1064,340 L1064,352
              L1076,352 L1076,340 L1088,340 L1088,352 L1100,352 L1100,340
              L1112,340 L1112,355 L1124,355 L1124,368 L1136,368 L1136,355
              L1148,355 L1148,368 L1160,368 L1160,380 L1172,380 L1172,368
              L1184,368 L1184,380 L1200,380 L1200,400 Z
            "
            fill="url(#skyline-fill)"
            opacity="0.88"
          />

          {/* Roofline accent glow — right half in magenta for dual mode */}
          <path
            d="
              M0,400 L0,340
              L18,340 L18,310 L18,295 L30,295 L30,275 L42,275 L42,260
              L54,260 L54,240 L66,240 L66,256 L75,256 L75,240
              L88,240 L88,268 L98,268 L98,252 L110,252 L110,238
              L122,238 L122,220 L134,220 L134,208 L146,208 L146,195
              L158,195 L158,182 L170,182 L170,170 L176,170 L176,158
              L184,158 L184,170 L190,170 L190,185 L202,185 L202,195
              L214,195 L214,208 L226,208 L226,192 L238,192 L238,178
              L250,178 L250,165 L258,165 L258,152 L266,152 L266,140
              L274,140 L274,128 L282,128 L282,118 L290,118 L290,108
              L296,108 L296,98  L302,98  L302,88  L308,88  L308,78
              L314,78  L314,88  L320,88  L320,100 L326,100 L326,112
              L332,112 L332,125 L340,125 L340,115 L348,115 L348,105
              L356,105 L356,118 L364,118 L364,130 L372,130 L372,118
              L380,118 L380,108 L388,108 L388,120 L396,120 L396,135
              L404,135 L404,148 L412,148 L412,162 L420,162 L420,176
              L428,176 L428,188 L436,188 L436,175 L444,175 L444,162
              L452,162 L452,148 L460,148 L460,138 L468,138 L468,125
              L476,125 L476,112 L484,112 L484,100 L490,100 L490,90
              L496,90  L496,80  L502,80  L502,72  L508,72  L508,64
              L514,64  L514,74  L520,74  L520,86  L526,86  L526,98
              L532,98  L532,112 L540,112 L540,125 L548,125 L548,138
              L556,138 L556,152 L564,152 L564,165 L572,165 L572,155
              L580,155 L580,145 L588,145 L588,132 L596,132 L596,120
              L604,120 L604,108 L610,108 L610,98  L616,98  L616,88
              L622,88  L622,78  L628,78  L628,70  L634,70  L634,62
              L640,62  L640,74  L646,74  L646,86  L652,86  L652,100
              L660,100 L660,115 L668,115 L668,130 L676,130 L676,145
              L684,145 L684,158 L692,158 L692,170 L700,170 L700,182
              L708,182 L708,192 L716,192 L716,178 L724,178 L724,165
              L732,165 L732,152 L740,152 L740,140 L748,140 L748,128
              L754,128 L754,118 L760,118 L760,108 L766,108 L766,98
              L772,98  L772,90  L778,90  L778,82  L784,82  L784,74
              L790,74  L790,86  L796,86  L796,98  L802,98  L802,112
              L810,112 L810,128 L818,128 L818,145 L826,145 L826,158
              L834,158 L834,170 L842,170 L842,185 L850,185 L850,196
              L860,196 L860,208 L872,208 L872,222 L884,222 L884,238
              L896,238 L896,252 L908,252 L908,265 L920,265 L920,278
              L932,278 L932,290 L944,290 L944,305 L956,305 L956,318
              L968,318 L968,330 L980,330 L980,340 L992,340 L992,352
              L1004,352 L1004,340 L1016,340 L1016,328 L1028,328 L1028,315
              L1040,315 L1040,328 L1052,328 L1052,340 L1064,340 L1064,352
              L1076,352 L1076,340 L1088,340 L1088,352 L1100,352 L1100,340
              L1112,340 L1112,355 L1124,355 L1124,368 L1136,368 L1136,355
              L1148,355 L1148,368 L1160,368 L1160,380 L1172,380 L1172,368
              L1184,368 L1184,380 L1200,380 L1200,400 Z
            "
            fill={accent === "magenta" ? "url(#skyline-glow-magenta)" : "url(#skyline-glow-cyan)"}
            opacity="0.9"
          />

          {/* Tiny window lights — scattered glowing dots on building faces.
              Gives the impression of a lived-in cityscape at night. */}
          {[
            [290, 125, "cyan"], [302, 115, "cyan"], [314, 105, "cyan"],
            [278, 135, "cyan"], [308, 98, "cyan"],
            [502, 88, "cyan"],  [508, 80, "cyan"], [496, 96, "cyan"],
            [514, 78, "cyan"],  [526, 105, "cyan"],
            [628, 85, "magenta"], [634, 76, "magenta"], [640, 70, "magenta"],
            [646, 92, "magenta"], [622, 94, "magenta"],
            [760, 125, "magenta"], [772, 110, "magenta"], [778, 98, "magenta"],
            [766, 118, "magenta"],
            [148, 210, "cyan"], [160, 200, "cyan"], [170, 190, "cyan"],
            [840, 178, "magenta"], [850, 205, "magenta"], [862, 218, "magenta"],
          ].map(([x, y, color], i) => (
            <circle
              key={`w-${i}`}
              cx={x as number}
              cy={y as number}
              r={1.5}
              fill={color === "cyan" ? "var(--accent-cyan)" : "var(--accent-magenta)"}
              opacity={0.35 + (i % 5) * 0.06}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
