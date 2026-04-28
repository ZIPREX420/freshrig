import { useEffect, useState } from "react";
import { useHardwareStore } from "../../stores/hardwareStore";
import { APP_NAME, APP_TAGLINE } from "../../config/app";
import { SystemOverviewCard } from "./SystemOverviewCard";
import { GpuCard } from "./GpuCard";
import { DiskCard } from "./DiskCard";
import { NetworkCard } from "./NetworkCard";
import { DriverIssuesCard } from "./DriverIssuesCard";
import { HealthScore } from "./HealthScore";
import { CircuitBoard, Volume2, FileText } from "lucide-react";
import { HardwareCard } from "./HardwareCard";
import { ReportPage } from "../report/ReportPage";
import { SmartHealthCard } from "./SmartHealthCard";

export function Dashboard() {
  const { summary, driverIssues, loading, error, fetchHardware } = useHardwareStore();
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    fetchHardware();
  }, [fetchHardware]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
            <span className="text-error text-2xl">!</span>
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Failed to load hardware data</h3>
          <p className="text-sm text-text-secondary max-w-md text-center mb-4">{error}</p>
          <button
            onClick={fetchHardware}
            className="px-4 py-2 rounded-md bg-accent text-bg-primary text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <Header />

      {/* Diagnostic Report CTA */}
      <div className="flex items-center justify-between bg-gradient-to-r from-accent/10 to-amber-500/10 border border-accent/20 rounded-xl px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">Diagnostic Health Report</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Full SMART, battery, security, and driver analysis — save as PDF.
          </p>
        </div>
        <button
          onClick={() => setShowReport(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-bg-primary text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <FileText className="w-4 h-4" /> Generate Report
        </button>
      </div>

      {showReport && <ReportPage onClose={() => setShowReport(false)} />}

      {/* System Overview + Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-6">
        <SystemOverviewCard summary={summary} />
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex items-center justify-center">
          <HealthScore summary={summary} driverIssues={driverIssues} />
        </div>
      </div>

      {/* Driver Issues (only shown if any) */}
      <DriverIssuesCard issues={driverIssues} />

      {/* SMART Disk Health */}
      <SmartHealthCard />

      {/* Hardware Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <GpuCard gpus={summary.gpus} />
        <DiskCard disks={summary.disks} />
        <NetworkCard adapters={summary.networkAdapters} />

        {/* Motherboard Card */}
        <HardwareCard title="Motherboard" icon={CircuitBoard} status="good">
          <div className="space-y-1.5 text-xs">
            <DataRow label="Manufacturer" value={summary.motherboard.manufacturer} />
            <DataRow label="Product" value={summary.motherboard.product} />
            <DataRow label="BIOS" value={summary.motherboard.biosVersion} />
            <DataRow label="Serial" value={summary.motherboard.serialNumber} />
          </div>
        </HardwareCard>

        {/* Audio Card */}
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
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">{APP_NAME}</h1>
      <p className="text-sm text-text-secondary mt-1">{APP_TAGLINE}</p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-secondary font-mono truncate ml-4" title={value}>{value}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Header />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-6">
        <div className="h-40 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse" />
        <div className="h-40 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse" />
        ))}
      </div>
    </div>
  );
}
