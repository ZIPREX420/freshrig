import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

/**
 * Manual vendor chunking. Splits heavy libs into named chunks for:
 *  - smaller initial paint (cold-start ships only the entry graph)
 *  - per-file OS caching (Tauri ships offline, but the WebView2/WebKit
 *    file cache is per-asset; one big bundle invalidates entirely on any
 *    code change)
 *  - per-route memory pressure: charts and crypto only ship when needed
 *
 * IMPORTANT — `manualChunks` cannot evict modules from the entry chunk if
 * they are reachable through eager imports. Anything imported by App.tsx,
 * the Sidebar, the Dashboard, or other always-loaded surfaces stays in
 * the entry regardless of what we return here. To shrink the entry,
 * eager imports themselves must be moved behind a lazy seam.
 *
 * Order matters — first match wins. Specific package matches MUST precede
 * broad fallbacks (notably react-core, which would otherwise swallow
 * react-markdown / react-error-boundary / react-hotkeys-hook). Each
 * package matcher uses a leading `/` to prevent substring collisions
 * (e.g. `framer-motion` would match `framer-motion-utils` if both
 * existed).
 */
function chunkFor(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;

  // Charts: recharts pulls a slice of d3 (d3-array, d3-scale, d3-shape, ...).
  if (id.includes("/recharts/") || id.includes("/d3-")) return "charts";

  // Motion family: framer-motion@12 ships as `framer-motion`, `motion`,
  // `motion-dom`, and `motion-utils` packages. Bracket all four.
  if (
    id.includes("/framer-motion/") ||
    id.includes("/motion/") ||
    id.includes("/motion-dom/") ||
    id.includes("/motion-utils/")
  ) {
    return "motion";
  }

  // Markdown stack: react-markdown drags remark/rehype/micromark/mdast/hast/unified.
  if (
    id.includes("/react-markdown/") ||
    id.includes("/remark-") ||
    id.includes("/rehype-") ||
    id.includes("/micromark") ||
    id.includes("/mdast-") ||
    id.includes("/hast-") ||
    id.includes("/unified/") ||
    id.includes("/unist-util-")
  ) {
    return "markdown";
  }

  if (id.includes("/@zxcvbn-ts/")) return "crypto";
  if (id.includes("/canvas-confetti/")) return "confetti";
  if (id.includes("/@tauri-apps/")) return "tauri";
  if (id.includes("/lucide-react/")) return "icons";
  if (id.includes("/sonner/")) return "toast";
  if (id.includes("/react-hotkeys-hook/")) return "hotkeys";
  if (id.includes("/react-error-boundary/")) return "error-boundary";
  if (id.includes("/zustand/")) return "state";

  // React core LAST — these matchers are broad and would otherwise capture
  // everything react-* above.
  if (
    id.includes("/react-dom/") ||
    id.includes("/react/") ||
    id.includes("/scheduler/")
  ) {
    return "react-vendor";
  }

  return undefined;
}

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    // Vite 8 ships Rolldown. `rollupOptions` is accepted as a compat alias
    // and is currently the documented surface for `manualChunks`. If a
    // future Vite/Rolldown release deprecates it, the predicate above
    // can be reused under `rolldownOptions.output.advancedChunks` directly.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          return chunkFor(id);
        },
      },
    },
    chunkSizeWarningLimit: 1500,
    modulePreload: { polyfill: false },
  },
}));
