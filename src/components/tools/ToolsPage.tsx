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

interface ToolGroup {
  id: string;
  label: string;
  caption: string;
  tools: ToolDef[];
}

/**
 * Tools are grouped into three buckets so the hub reads as a workshop
 * rather than a wall of tiles:
 *   - System         → things that change how Windows / your hardware behave
 *   - Apps & data    → install software, reclaim disk, generate reports
 *   - Privacy & net  → permissions, telemetry, DNS, watch for drift
 *
 * Tile copy follows one shape: short imperative, single sentence, period.
 * Tier locks (Pro / Business) stay on the destination page itself so the
 * user always sees the full toolbox here.
 */
const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "system",
    label: "System",
    caption: "Drivers, services, and core Windows behaviour.",
    tools: [
      {
        id: "drivers",
        title: "Drivers",
        description: "Detect and update GPU, chipset, audio, and network drivers.",
        icon: <Cpu className="w-7 h-7" strokeWidth={2} />,
        accent: "cyan",
      },
      {
        id: "optimize",
        title: "Optimize",
        description: "Apply tier-rated tweaks for privacy, performance, and bloat.",
        icon: <Sparkles className="w-7 h-7" strokeWidth={2} />,
        accent: "magenta",
        windowsOnly: true,
      },
      {
        id: "startup",
        title: "Startup",
        description: "Choose which programs run at boot.",
        icon: <Rocket className="w-7 h-7" strokeWidth={2} />,
        accent: "cyan",
      },
      {
        id: "services",
        title: "Services",
        description: "Manage Windows or systemd services with safe presets.",
        icon: <Cog className="w-7 h-7" strokeWidth={2} />,
        accent: "magenta",
      },
      {
        id: "contextMenu",
        title: "Context menu",
        description: "Restore the classic right-click menu and audit shell extensions.",
        icon: <Menu className="w-7 h-7" strokeWidth={2} />,
        accent: "cyan",
        windowsOnly: true,
      },
    ],
  },
  {
    id: "apps",
    label: "Apps & data",
    caption: "Install software, reclaim disk space, generate reports.",
    tools: [
      {
        id: "apps",
        title: "Apps",
        description: "Batch-install curated essential software.",
        icon: <Package className="w-7 h-7" strokeWidth={2} />,
        accent: "cyan",
      },
      {
        id: "cleanup",
        title: "Cleanup",
        description: "Reclaim disk space — caches, logs, and temp files.",
        icon: <Trash2 className="w-7 h-7" strokeWidth={2} />,
        accent: "magenta",
      },
      {
        id: "report",
        title: "Health report",
        description: "Run a full PC diagnostic and export it as a PDF.",
        icon: <FileChartColumn className="w-7 h-7" strokeWidth={2} />,
        accent: "magenta",
      },
    ],
  },
  {
    id: "privacy",
    label: "Privacy & network",
    caption: "Permissions, telemetry, DNS, and ongoing monitoring.",
    tools: [
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
        description: "Reset DNS, apply presets, and view saved Wi-Fi passwords.",
        icon: <Globe className="w-7 h-7" strokeWidth={2} />,
        accent: "cyan",
      },
      {
        id: "watchdog",
        title: "Watchdog",
        description: "Monitor the background for unauthorised changes.",
        icon: <Eye className="w-7 h-7" strokeWidth={2} />,
        accent: "magenta",
      },
    ],
  },
];

export function ToolsPage({ onNavigate }: ToolsPageProps) {
  const { isWindows } = usePlatform();

  const visibleGroups = TOOL_GROUPS.map((group) => ({
    ...group,
    tools: group.tools.filter((t) => !(t.windowsOnly && !isWindows)),
  })).filter((g) => g.tools.length > 0);

  return (
    <div className="max-w-7xl mx-auto">
      <PageBreadcrumb current="Tools" onBack={() => onNavigate?.("dashboard")} />

      <div className="flex flex-col items-center text-center mb-12">
        <HexIcon size="xl" accent="gradient" perspectiveFloor idSuffix="tools-hero">
          <Wrench className="w-12 h-12" strokeWidth={2} />
        </HexIcon>
        <h1 className="mt-6 text-display font-semibold uppercase tracking-[0.12em] text-text-primary">
          Tools
        </h1>
        <p className="mt-2 text-text-secondary text-body max-w-xl">
          Every individual tool, ready to use. Pick what you need — or run
          Quick Setup to apply the recommended bundle automatically.
        </p>
      </div>

      <div className="space-y-12">
        {visibleGroups.map((group) => (
          <section key={group.id}>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-primary">
                {group.label}
              </h2>
              <p className="text-[11px] text-text-muted hidden sm:block">
                {group.caption}
              </p>
            </div>
            <ActionGrid columns={3}>
              {group.tools.map((tool) => (
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
          </section>
        ))}
      </div>
    </div>
  );
}

export default ToolsPage;
