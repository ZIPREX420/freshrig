// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useEffect, useState } from "react";
import { useHardwareStore } from "../../stores/hardwareStore";
import { GpuCard } from "./GpuCard";
import { DiskCard } from "./DiskCard";
import { NetworkCard } from "./NetworkCard";
import { DriverIssuesCard } from "./DriverIssuesCard";
import { HardwareCard } from "./HardwareCard";
import { SmartHealthCard } from "./SmartHealthCard";
import { DashboardHero } from "./DashboardHero";
import { SystemMetricsBar } from "./SystemMetricsBar";
import { ActionStrip } from "./ActionStrip";
import { ReportPage } from "../report/ReportPage";
import { CircuitBoard, Volume2 } from "lucide-react";
import type { HardwareSummary, DriverIssue } from "../../types/hardware";

interface DashboardProps {
  /** Optional callback used by the hero/action strip to navigate the
   *  parent app to other pages. App.tsx wires this up so action chips
   *  like "Fix N drivers" can deep-link to the Drivers page. */
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

export function Dashboard({ onNavigate }: DashboardProps) {
  const { summary, driverIssues, loading, error, fetchHardware } = useHardwareStore();
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    fetchHardware();
  }, [fetchHardware]);

  if (loading && !summary) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={fetchHardware} />;
  if (!summary) return null;

  const score = calculateScore(summary, driverIssues);

  const handleHeroAction = (action: "report" | "drivers" | "refresh") => {
    if (action === "report") setShowReport(true);
    else if (action === "drivers") onNavigate?.("drivers");
    else if (action === "refresh") fetchHardware();
  };

  return (
    <div className="space-y-6">
      {/* HERO */}
      <DashboardHero
        summary={summary}
        driverIssues={driverIssues}
        healthScore={score}
        onAction={handleHeroAction}
      />

      {/* LIVE METRICS BAR */}
      <SystemMetricsBar summary={summary} />

      {/* ACTION STRIP — only renders when there's something to act on */}
      <ActionStrip
        driverIssues={driverIssues}
        onShowDrivers={() => onNavigate?.("drivers")}
      />

      {/* DRIVER ISSUES (richer detail than the strip; kept for now) */}
      <DriverIssuesCard issues={driverIssues} />

      {/* SMART DISK HEALTH */}
      <SmartHealthCard />

      {/* HARDWARE GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <GpuCard gpus={summary.gpus} />
        <DiskCard disks={summary.disks} />
        <NetworkCard adapters={summary.networkAdapters} />

        <HardwareCard title="Motherboard" icon={CircuitBoard} status="good">
          <div className="space-y-1.5 text-xs">
            <DataRow label="Manufacturer" value={summary.motherboard.manufacturer} />
            <DataRow label="Product"      value={summary.motherboard.product} />
            <DataRow label="BIOS"         value={summary.motherboard.biosVersion} />
            <DataRow label="Serial"       value={summary.motherboard.serialNumber} />
          </div>
        </HardwareCard>

        <HardwareCard title="Audio" icon={Volume2} status="good">
          <div className="space-y-3">
            {summary.audioDevices.map((device, i) => (
              <div key={i} className="space-y-1">
                <p className="text-sm text-text-primary truncate" title={device.name}>{device.name}</p>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Status</span>
                  <span className={`font-medium ${device.status === "OK" ? "text-success" : "text-text-secondary"}`}>
                    {device.status}
                  </span>
                </div>
              </div>
            ))}
            {summary.audioDevices.length === 0 && (
              <p className="text-xs text-text-muted">No audio devices detected</p>
            )}
          </div>
        </HardwareCard>
      </div>

      {showReport && <ReportPage onClose={() => setShowReport(false)} />}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted shrink-0">{label}</span>
      <span className="text-text-secondary font-mono tabular truncate text-right" title={value}>{value}</span>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-error-soft border border-error-rim flex items-center justify-center mb-4">
          <span className="text-error text-2xl">!</span>
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to load hardware data</h3>
        <p className="text-sm text-text-secondary max-w-md text-center mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-md bg-accent text-bg-base text-sm font-medium hover:bg-accent-hover transition-colors active:scale-[0.97] duration-100"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

/** Premium loading skeleton — shimmer instead of flat pulse. */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-[180px] rounded-xl skeleton-shimmer border border-border" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[78px] rounded-lg skeleton-shimmer border border-border" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl skeleton-shimmer border border-border" />
        ))}
      </div>
    </div>
  );
}
