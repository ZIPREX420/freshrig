// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useEffect, useMemo } from "react";
import {
  Zap,
  Layers,
  Download,
  Wrench,
  RefreshCw,
  Gamepad2,
  ChevronRight,
} from "lucide-react";
import { useHardwareStore } from "../../stores/hardwareStore";
import { ActionTile } from "../ui/ActionTile";
import { ActionGrid } from "../ui/ActionGrid";
import { ProgressRing } from "../ui/ProgressRing";
import { Button } from "../ui/Button";
import { PageBreadcrumb } from "../ui/PageBreadcrumb";
import { HexIcon } from "../ui/HexIcon";
import type { HardwareSummary, DriverIssue } from "../../types/hardware";

interface DashboardProps {
  /** Navigates to other top-level views. Passed through to the action tiles
   *  and the "Open" buttons on each recent-setup row. */
  onNavigate?: (view: string) => void;
}

function calculateScore(summary: HardwareSummary, driverIssues: DriverIssue[]): number {
  let score = 100;
  score -= driverIssues.length * 10;
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  for (const gpu of summary.gpus) {
    if (gpu.driverDate && gpu.driverDate !== "Unknown") {
      const driverDate = new Date(gpu.driverDate);
      if (!isNaN(driverDate.getTime()) && driverDate < sixMonthsAgo) {
        score -= 5;
        break;
      }
    }
  }
  if (summary.gpus.length === 0) score -= 5;
  return Math.max(0, score);
}

function scoreVerdict(score: number): {
  label: string;
  caption: string;
  accent: "cyan" | "magenta" | "success" | "warning" | "error";
} {
  if (score >= 90) {
    return {
      label: "Excellent",
      caption: "Your system performs better than 98% of users.",
      accent: "success",
    };
  }
  if (score >= 70) {
    return {
      label: "Healthy",
      caption: "A few easy wins available — check the recommendations.",
      accent: "cyan",
    };
  }
  if (score >= 50) {
    return {
      label: "Needs attention",
      caption: "Several issues to address. Run Quick Setup.",
      accent: "warning",
    };
  }
  return {
    label: "Critical",
    caption: "Serious problems detected. Recommend Quick Setup now.",
    accent: "error",
  };
}

interface RecentSetup {
  id: string;
  label: string;
  detail: string;
}

const SAMPLE_RECENT: RecentSetup[] = [
  { id: "gaming-2024", label: "Gaming Boost 2024", detail: "Last used 2 days ago" },
  { id: "streaming", label: "Streaming & Editing", detail: "Last used 1 week ago" },
];

export function Dashboard({ onNavigate }: DashboardProps) {
  const { summary, driverIssues, loading, fetchHardware } = useHardwareStore();

  useEffect(() => {
    fetchHardware();
  }, [fetchHardware]);

  const score = useMemo(() => {
    if (!summary) return null;
    return calculateScore(summary, driverIssues);
  }, [summary, driverIssues]);

  const verdict = score !== null ? scoreVerdict(score) : null;
  const isOptimal = score !== null && score >= 90;

  return (
    <div className="max-w-7xl mx-auto">
      <PageBreadcrumb
        current="Dashboard"
        rightSlot={
          <Button variant="primary" size="md" onClick={fetchHardware} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Scanning…" : "Scan system"}
          </Button>
        }
      />

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center mb-12">
        <div>
          <p className="text-text-muted text-[12px] uppercase tracking-[0.18em] mb-3">
            {isOptimal ? "All systems nominal" : "System status"}
          </p>
          <h1
            className={`text-[48px] leading-tight font-semibold mb-3 ${
              isOptimal ? "text-gradient-neon" : "text-text-primary"
            }`}
            style={!isOptimal ? { color: "var(--accent-magenta)" } : undefined}
          >
            {isOptimal ? "Everything under control." : "Some things to address."}
          </h1>
          <p className="text-text-secondary text-[15px] max-w-xl">
            {verdict?.caption ?? "Loading system status…"}
          </p>
        </div>

        <div className="flex flex-col items-center self-center">
          <ProgressRing
            value={score ?? 0}
            size="xl"
            accent={verdict?.accent ?? "cyan"}
            label={
              score !== null ? (
                <span className="flex items-baseline">
                  <span className="text-[44px] leading-none">{score}</span>
                  <span className="text-[16px] text-text-muted ml-1">/100</span>
                </span>
              ) : (
                "—"
              )
            }
            sublabel="System score"
          />
          {verdict && (
            <span
              className="mt-3 text-[12px] uppercase tracking-[0.16em] font-semibold"
              style={{
                color:
                  verdict.accent === "magenta"
                    ? "var(--accent-magenta)"
                    : verdict.accent === "success"
                    ? "var(--success)"
                    : verdict.accent === "warning"
                    ? "var(--warning)"
                    : verdict.accent === "error"
                    ? "var(--error)"
                    : "var(--accent-cyan)",
              }}
            >
              {verdict.label}
            </span>
          )}
        </div>
      </section>

      <section className="mb-12">
        <ActionGrid columns={4}>
          <ActionTile
            icon={<Zap className="w-7 h-7" strokeWidth={2} />}
            title="Quick Setup"
            description="Automatic install of drivers, software, and settings."
            accent="cyan"
            variant="compact"
            idSuffix="dash-quick"
            onClick={() => onNavigate?.("snelsetup")}
          />
          <ActionTile
            icon={<Layers className="w-7 h-7" strokeWidth={2} />}
            title="Custom Setup"
            description="Build your own. Pick exactly what gets installed."
            accent="magenta"
            variant="compact"
            idSuffix="dash-custom"
            onClick={() => onNavigate?.("aangepaste")}
          />
          <ActionTile
            icon={<Download className="w-7 h-7" strokeWidth={2} />}
            title="Import"
            description="Load a previously saved configuration / setup file."
            accent="magenta"
            variant="compact"
            idSuffix="dash-import"
            onClick={() => onNavigate?.("profiles")}
          />
          <ActionTile
            icon={<Wrench className="w-7 h-7" strokeWidth={2} />}
            title="Tools"
            description="Every individual tool, ready to use."
            accent="cyan"
            variant="compact"
            idSuffix="dash-tools"
            onClick={() => onNavigate?.("tools")}
          />
        </ActionGrid>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Recent setups
          </h2>
          <button
            type="button"
            onClick={() => onNavigate?.("profiles")}
            className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[var(--accent-cyan)] hover:text-[var(--accent-cyan-hover)] transition-colors flex items-center gap-1"
          >
            View all
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <ul className="space-y-2">
          {SAMPLE_RECENT.map((setup) => (
            <li
              key={setup.id}
              className="flex items-center gap-3 px-4 py-3 rounded-md bg-bg-card border border-border hover:border-[var(--accent-cyan-rim)] transition-colors"
            >
              <HexIcon size="sm" accent="cyan" idSuffix={`recent-${setup.id}`}>
                <Gamepad2 className="w-3.5 h-3.5" />
              </HexIcon>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium text-text-primary truncate">
                  {setup.label}
                </span>
                <span className="block text-[11px] text-text-muted truncate">
                  {setup.detail}
                </span>
              </span>
              <Button variant="secondary" size="sm" onClick={() => onNavigate?.("profiles")}>
                Open
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default Dashboard;
