// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import {
  Cpu,
  Package,
  Sparkles,
  Trash2,
  Shield,
  Globe,
  Cog,
  Menu,
  Eye,
  Rocket,
  FileChartColumn,
  Wrench,
} from "lucide-react";
import { ActionTile } from "../ui/ActionTile";
import { ActionGrid } from "../ui/ActionGrid";
import { HexIcon } from "../ui/HexIcon";
import { PageBreadcrumb } from "../ui/PageBreadcrumb";
import { usePlatform } from "../../hooks/usePlatform";

interface ToolsPageProps {
  onNavigate?: (view: string) => void;
}

interface ToolDef {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: "cyan" | "magenta";
  windowsOnly?: boolean;
}

const TOOLS: ToolDef[] = [
  {
    id: "drivers",
    title: "Drivers",
    description: "Detect and update GPU, chipset, audio, network drivers.",
    icon: <Cpu className="w-7 h-7" strokeWidth={2} />,
    accent: "cyan",
  },
  {
    id: "apps",
    title: "Apps",
    description: "Install essential and curated software in batches.",
    icon: <Package className="w-7 h-7" strokeWidth={2} />,
    accent: "cyan",
  },
  {
    id: "optimize",
    title: "Optimize",
    description: "Tier-rated tweaks for privacy, performance, bloat.",
    icon: <Sparkles className="w-7 h-7" strokeWidth={2} />,
    accent: "magenta",
    windowsOnly: true,
  },
  {
    id: "startup",
    title: "Startup Manager",
    description: "Control which programs run when you boot.",
    icon: <Rocket className="w-7 h-7" strokeWidth={2} />,
    accent: "cyan",
  },
  {
    id: "cleanup",
    title: "Cleanup",
    description: "Reclaim disk space — caches, logs, temp files.",
    icon: <Trash2 className="w-7 h-7" strokeWidth={2} />,
    accent: "magenta",
  },
  {
    id: "privacy",
    title: "Privacy",
    description: "Audit app permissions and lock down telemetry.",
    icon: <Shield className="w-7 h-7" strokeWidth={2} />,
    accent: "magenta",
  },
  {
    id: "network",
    title: "Network",
    description: "DNS reset, presets, saved Wi-Fi password viewer.",
    icon: <Globe className="w-7 h-7" strokeWidth={2} />,
    accent: "cyan",
  },
  {
    id: "services",
    title: "Services",
    description: "Manage Windows / systemd services with safe presets.",
    icon: <Cog className="w-7 h-7" strokeWidth={2} />,
    accent: "magenta",
  },
  {
    id: "contextMenu",
    title: "Context menu",
    description: "Restore the classic menu, manage shell extensions.",
    icon: <Menu className="w-7 h-7" strokeWidth={2} />,
    accent: "cyan",
    windowsOnly: true,
  },
  {
    id: "watchdog",
    title: "Watchdog",
    description: "Background monitor for unauthorised changes.",
    icon: <Eye className="w-7 h-7" strokeWidth={2} />,
    accent: "magenta",
  },
  {
    id: "report",
    title: "Health report",
    description: "Comprehensive PC diagnostic — exportable as PDF.",
    icon: <FileChartColumn className="w-7 h-7" strokeWidth={2} />,
    accent: "magenta",
  },
];

/**
 * Tools hub — a single page that re-buckets every "feature" page (Drivers,
 * Apps, Optimize, etc.) into a clean grid of `ActionTile`s. Lets the main
 * sidebar stay short (5–7 items) per the mockups while keeping every
 * existing surface one click away.
 *
 * Tiles are platform-aware: Windows-only tools are hidden on Linux / macOS.
 * Tier locks (Pro / Business) stay on the destination page itself — we
 * deliberately don't re-paywall here, so users see the full toolbox.
 */
export function ToolsPage({ onNavigate }: ToolsPageProps) {
  const { isWindows } = usePlatform();
  const visibleTools = TOOLS.filter((t) => !(t.windowsOnly && !isWindows));

  return (
    <div className="max-w-7xl mx-auto">
      <PageBreadcrumb current="Tools" onBack={() => onNavigate?.("dashboard")} />

      <div className="flex flex-col items-center text-center mb-10">
        <HexIcon size="xl" accent="gradient" perspectiveFloor idSuffix="tools-hero">
          <Wrench className="w-12 h-12" strokeWidth={2} />
        </HexIcon>
        <h1 className="mt-6 text-display font-semibold uppercase tracking-[0.12em] text-text-primary">
          Tools
        </h1>
        <p className="mt-2 text-text-secondary text-body max-w-xl">
          Every individual tool, ready to use. Pick what you need — or use
          Quick Setup to run the recommended bundle automatically.
        </p>
      </div>

      <ActionGrid columns={3}>
        {visibleTools.map((tool) => (
          <ActionTile
            key={tool.id}
            icon={tool.icon}
            title={tool.title}
            description={tool.description}
            accent={tool.accent}
            variant="compact"
            idSuffix={`tool-${tool.id}`}
            onClick={() => onNavigate?.(tool.id)}
          />
        ))}
      </ActionGrid>
    </div>
  );
}

export default ToolsPage;
