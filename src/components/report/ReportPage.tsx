import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  X,
  Printer,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Cpu,
  HardDrive,
  Battery,
  Shield,
  AlertTriangle,
  CheckCircle,
  Activity,
  FileText,
} from "lucide-react";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import { APP_NAME, APP_VERSION } from "../../config/app";
import type { ReportData, Grade, DriveHealth } from "../../types/report";

interface ReportPageProps {
  /**
   * Optional close handler. When provided, the report renders as a fixed
   * fullscreen modal with an X button (used by the Dashboard quick-action).
   * When omitted, the report renders inline as a routed page (used by the
   * sidebar's "Health Report" entry).
   */
  onClose?: () => void;
}

const GRADE_COLORS: Record<Grade, { bg: string; text: string; label: string }> = {
  A: { bg: "#22c55e", text: "#052e16", label: "Excellent" },
  B: { bg: "#00d4aa", text: "#042420", label: "Good" },
  C: { bg: "#f59e0b", text: "#1f1300", label: "Fair" },
  D: { bg: "#fb923c", text: "#1e0f00", label: "Needs Attention" },
  F: { bg: "#ef4444", text: "#1f0000", label: "Critical" },
};

const DRIVE_HEALTH_COLORS: Record<DriveHealth, string> = {
  OK: "text-success",
  Warning: "text-amber-500",
  Fail: "text-error",
  Unknown: "text-text-muted",
};

export function ReportPage({ onClose }: ReportPageProps) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<ReportData>("generate_health_report", { appVersion: APP_VERSION })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // When opened via Dashboard's quick action, ReportPage renders as a modal
  // takeover. When opened from the sidebar (no onClose), it renders inline so
  // the AppLayout sidebar stays visible and the user can navigate elsewhere.
  const isModal = typeof onClose === "function";
  const containerClass = isModal
    ? "fixed inset-0 z-[80] bg-bg-primary overflow-y-auto report-page"
    : "report-page";

  return (
    <div className={containerClass}>
      <PrintStyles />
      <ProFeatureGate feature="Diagnostic Report" mode="overlay">
        <div className={isModal ? "max-w-4xl mx-auto px-6 py-6 space-y-5" : "max-w-4xl mx-auto space-y-5"}>
          <TopBar report={report} onClose={onClose} />

          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {report && <ReportBody report={report} />}

          <PrintFooter />
        </div>
      </ProFeatureGate>
    </div>
  );
}

function TopBar({ report, onClose }: { report: ReportData | null; onClose?: () => void }) {
  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    if (!report) return;
    const summary = buildTextSummary(report);
    navigator.clipboard
      .writeText(summary)
      .then(() => toast.success("Summary copied"))
      .catch(() => toast.error("Copy failed"));
  };

  return (
    <div className="flex items-center justify-between print-hidden">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-accent" />
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            Diagnostic Health Report
          </h1>
          <p className="text-xs text-text-muted">
            {APP_NAME} v{APP_VERSION}
            {report && ` — Generated ${new Date(report.generatedAt).toLocaleString()}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          disabled={!report}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors disabled:opacity-50"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy Summary
        </button>
        <button
          onClick={handlePrint}
          disabled={!report}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-accent text-bg-primary font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          <Printer className="w-3.5 h-3.5" />
          Print / Save PDF
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-3 print-hidden">
      <RefreshCw className="w-8 h-8 text-accent animate-spin" />
      <p className="text-sm text-text-secondary">Analyzing your system...</p>
      <p className="text-xs text-text-muted">This can take up to 10 seconds.</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-3 print-hidden">
      <AlertTriangle className="w-8 h-8 text-error" />
      <p className="text-sm text-text-primary font-medium">Failed to generate report</p>
      <p className="text-xs text-text-secondary max-w-md text-center">{message}</p>
    </div>
  );
}

function ReportBody({ report }: { report: ReportData }) {
  return (
    <div className="space-y-5">
      <GradeHero report={report} />
      <SummaryChips report={report} />

      <Section title="System & Hardware" icon={Cpu} defaultOpen>
        <SystemHardware report={report} />
      </Section>

      <Section title="Storage Health" icon={HardDrive} defaultOpen>
        <StorageTable report={report} />
      </Section>

      {report.battery && (
        <Section title="Battery Health" icon={Battery} defaultOpen>
          <BatteryBlock battery={report.battery} />
        </Section>
      )}

      <Section title="Security Posture" icon={Shield} defaultOpen>
        <SecurityChecklist report={report} />
      </Section>

      <Section title="Drivers" icon={AlertTriangle} defaultOpen>
        <DriverBlock report={report} />
      </Section>

      <Section title="Reliability & Software" icon={Activity} defaultOpen>
        <ReliabilityBlock report={report} />
      </Section>
    </div>
  );
}

function GradeHero({ report }: { report: ReportData }) {
  const grade = report.overallGrade as Grade;
  const color = GRADE_COLORS[grade] ?? GRADE_COLORS.F;
  return (
    <div className="report-card flex items-center gap-6 bg-bg-card border border-border rounded-xl px-6 py-5">
      <div
        className="flex flex-col items-center justify-center w-[120px] h-[120px] rounded-full shrink-0"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        <span className="text-[56px] leading-none font-bold">{grade}</span>
        <span className="text-xs font-medium opacity-80">{report.overallScore}/100</span>
      </div>
      <div className="flex-1">
        <p className="text-xs text-text-muted uppercase tracking-wider">
          Overall Health
        </p>
        <h2 className="text-xl font-semibold text-text-primary mt-0.5">{color.label}</h2>
        <p className="text-sm text-text-secondary mt-2">
          {gradeNarrative(grade, report)}
        </p>
      </div>
    </div>
  );
}

function gradeNarrative(grade: Grade, report: ReportData): string {
  const issues: string[] = [];
  if (report.drives.some((d) => d.healthStatus === "Fail"))
    issues.push("a failing storage drive");
  if (report.drives.some((d) => d.healthStatus === "Warning"))
    issues.push("a warning on a storage drive");
  if (!report.security.antivirusEnabled) issues.push("no active antivirus");
  if (!report.security.firewallEnabled) issues.push("firewall disabled");
  if (report.battery && report.battery.healthPercent < 70)
    issues.push("degraded battery");
  if (report.drivers.withErrors > 0) issues.push(`${report.drivers.withErrors} driver issues`);
  if (!report.system.windowsActivated) issues.push("Windows not activated");

  if (issues.length === 0) {
    return "No critical issues detected. Your system is in great shape.";
  }
  if (grade === "A" || grade === "B") {
    return `Minor issues detected: ${issues.join(", ")}.`;
  }
  return `Issues requiring attention: ${issues.join(", ")}.`;
}

function SummaryChips({ report }: { report: ReportData }) {
  const chips = [
    report.system.osName,
    `Uptime: ${report.system.uptimeHours}h`,
    report.hardware.cpuName,
    `${report.hardware.ramTotalGb.toFixed(0)} GB RAM`,
    report.hardware.gpus[0] ?? "No GPU",
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span
          key={c}
          className="text-xs px-2.5 py-1 rounded-full bg-bg-card border border-border text-text-secondary"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  defaultOpen,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="report-card bg-bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-bg-tertiary transition-colors print-hidden"
      >
        <Icon className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-text-primary flex-1">{title}</h3>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      <div className="hidden print:block px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
        </h3>
      </div>
      {open && <div className="px-5 py-4 border-t border-border print:border-t-0">{children}</div>}
      <div className="hidden print:block px-5 py-4">{children}</div>
    </div>
  );
}

function SystemHardware({ report }: { report: ReportData }) {
  const { system, hardware } = report;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      <DataRow label="Hostname" value={system.hostname} />
      <DataRow
        label="Windows"
        value={`${system.osName} (build ${system.osBuild})`}
      />
      <DataRow
        label="Activation"
        value={system.windowsActivated ? "Activated" : "Not activated"}
        danger={!system.windowsActivated}
      />
      <DataRow label="Uptime" value={`${system.uptimeHours} hours`} />
      <DataRow label="CPU" value={`${hardware.cpuName} (${hardware.cpuCores}c / ${hardware.cpuThreads}t)`} />
      <DataRow label="RAM" value={`${hardware.ramTotalGb.toFixed(0)} GB (${hardware.ramSlots.length} slot${hardware.ramSlots.length === 1 ? "" : "s"})`} />
      <DataRow label="Motherboard" value={hardware.motherboard || "Unknown"} />
      <DataRow label="GPU" value={hardware.gpus.join(", ") || "None"} />
    </div>
  );
}

function StorageTable({ report }: { report: ReportData }) {
  if (report.drives.length === 0) {
    return <p className="text-xs text-text-muted">No drives detected.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-text-muted uppercase tracking-wider">
          <tr>
            <th className="text-left py-1.5 pr-3 font-medium">Drive</th>
            <th className="text-right py-1.5 px-3 font-medium">Size</th>
            <th className="text-center py-1.5 px-3 font-medium">Health</th>
            <th className="text-right py-1.5 px-3 font-medium">Temp</th>
            <th className="text-right py-1.5 px-3 font-medium">Hours</th>
            <th className="text-right py-1.5 px-3 font-medium">Wear</th>
          </tr>
        </thead>
        <tbody>
          {report.drives.map((d, i) => (
            <tr key={i} className="border-t border-border/50">
              <td className="py-2 pr-3 text-text-primary font-mono truncate max-w-[240px]" title={d.model}>
                {d.model}
              </td>
              <td className="text-right py-2 px-3 text-text-secondary">
                {d.sizeGb} GB
              </td>
              <td className={`text-center py-2 px-3 font-medium ${DRIVE_HEALTH_COLORS[d.healthStatus]}`}>
                {d.healthStatus}
              </td>
              <td className="text-right py-2 px-3 text-text-secondary">
                {d.temperatureC != null ? `${d.temperatureC}°C` : "—"}
              </td>
              <td className="text-right py-2 px-3 text-text-secondary">
                {d.powerOnHours != null ? d.powerOnHours : "—"}
              </td>
              <td className="text-right py-2 px-3 text-text-secondary">
                {d.wearPercentage != null ? `${d.wearPercentage}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BatteryBlock({ battery }: { battery: NonNullable<ReportData["battery"]> }) {
  const pct = battery.healthPercent;
  const barColor =
    pct >= 80 ? "bg-success" : pct >= 60 ? "bg-amber-500" : "bg-error";
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-text-secondary">Battery Health</span>
          <span className="text-text-primary font-semibold">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <DataRow
          label="Design Capacity"
          value={`${(battery.designCapacityMwh / 1000).toFixed(1)} Wh`}
        />
        <DataRow
          label="Current Capacity"
          value={`${(battery.fullChargeCapacityMwh / 1000).toFixed(1)} Wh`}
        />
        <DataRow label="Cycle Count" value={`${battery.cycleCount}`} />
      </div>
    </div>
  );
}

function SecurityChecklist({ report }: { report: ReportData }) {
  const items: { label: string; ok: boolean; detail?: string }[] = [
    {
      label: "Antivirus active",
      ok: report.security.antivirusEnabled,
      detail: report.security.antivirusName ?? "None detected",
    },
    {
      label: "Antivirus definitions up to date",
      ok: report.security.antivirusUpToDate,
    },
    { label: "Windows Firewall enabled", ok: report.security.firewallEnabled },
    {
      label: "BitLocker drive encryption",
      ok: report.security.bitlockerStatus === "Enabled",
      detail: report.security.bitlockerStatus,
    },
    {
      label: "TPM present and enabled",
      ok: report.security.tpmPresent && report.security.tpmEnabled,
    },
    { label: "Windows activated", ok: report.system.windowsActivated },
  ];
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          {it.ok ? (
            <CheckCircle className="w-4 h-4 text-success shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-error shrink-0" />
          )}
          <span className={it.ok ? "text-text-primary" : "text-text-secondary"}>
            {it.label}
          </span>
          {it.detail && <span className="text-xs text-text-muted ml-auto">{it.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

function DriverBlock({ report }: { report: ReportData }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <DataRow label="Total drivers" value={`${report.drivers.total}`} />
        <DataRow
          label="With errors"
          value={`${report.drivers.withErrors}`}
          danger={report.drivers.withErrors > 0}
        />
      </div>
      {report.drivers.errorDevices.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-text-muted mb-1.5 uppercase tracking-wider">
            Devices with driver errors
          </p>
          <ul className="space-y-1 text-xs text-error font-mono">
            {report.drivers.errorDevices.slice(0, 10).map((d, i) => (
              <li key={i}>• {d}</li>
            ))}
            {report.drivers.errorDevices.length > 10 && (
              <li className="text-text-muted">
                ...and {report.drivers.errorDevices.length - 10} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReliabilityBlock({ report }: { report: ReportData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
      <DataRow
        label="Reliability Index"
        value={
          report.reliabilityIndex != null
            ? `${report.reliabilityIndex.toFixed(2)} / 10.0`
            : "n/a"
        }
      />
      <DataRow label="Installed Software" value={`${report.softwareCount}`} />
      <DataRow
        label="Startup Items"
        value={`${report.startupEnabledCount} enabled / ${report.startupCount} total`}
      />
    </div>
  );
}

function DataRow({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span
        className={`font-medium truncate text-right ${
          danger ? "text-error" : "text-text-primary"
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function PrintFooter() {
  return (
    <div className="hidden print:block text-center text-[10px] text-text-muted border-t border-border pt-3 mt-6">
      Generated by {APP_NAME} v{APP_VERSION} — {APP_NAME} is not affiliated with Microsoft Corporation.
    </div>
  );
}

function buildTextSummary(report: ReportData): string {
  const lines: string[] = [];
  lines.push(`${APP_NAME} Health Report — ${report.generatedAt.slice(0, 10)}`);
  lines.push(`Overall: ${report.overallGrade} (${report.overallScore}/100)`);
  lines.push(
    `System: ${report.system.osName} (build ${report.system.osBuild}) — ${
      report.system.windowsActivated ? "activated" : "NOT activated"
    }`,
  );
  lines.push(
    `CPU: ${report.hardware.cpuName} (${report.hardware.cpuCores}c/${report.hardware.cpuThreads}t)`,
  );
  lines.push(`RAM: ${report.hardware.ramTotalGb.toFixed(0)} GB`);
  if (report.hardware.gpus.length > 0) lines.push(`GPU: ${report.hardware.gpus.join(", ")}`);
  if (report.drives.length > 0) {
    lines.push("Storage:");
    for (const d of report.drives) {
      const parts: string[] = [`${d.healthStatus}`];
      if (d.temperatureC != null) parts.push(`${d.temperatureC}°C`);
      if (d.wearPercentage != null) parts.push(`${d.wearPercentage}% wear`);
      if (d.powerOnHours != null) parts.push(`${d.powerOnHours}h`);
      lines.push(`  - ${d.model} ${d.sizeGb} GB: ${parts.join(", ")}`);
    }
  }
  if (report.battery) {
    lines.push(
      `Battery: ${report.battery.healthPercent}% health, ${report.battery.cycleCount} cycles`,
    );
  } else {
    lines.push("Battery: n/a (desktop)");
  }
  lines.push(
    `Security: AV ${report.security.antivirusEnabled ? "on" : "OFF"}, Firewall ${report.security.firewallEnabled ? "on" : "OFF"}, BitLocker ${report.security.bitlockerStatus}, TPM ${report.security.tpmPresent && report.security.tpmEnabled ? "active" : "inactive"}`,
  );
  lines.push(
    `Drivers: ${report.drivers.total} loaded, ${report.drivers.withErrors} with errors`,
  );
  if (report.reliabilityIndex != null) {
    lines.push(`Reliability: ${report.reliabilityIndex.toFixed(2)}/10`);
  }
  return lines.join("\n");
}

function PrintStyles() {
  const css = useMemo(
    () => `
@media print {
  @page { size: A4; margin: 15mm; }
  html, body { background: white !important; color: black !important; }
  .report-page { background: white !important; overflow: visible !important; position: static !important; }
  .print-hidden { display: none !important; }
  .print\\:block { display: block !important; }
  .report-card { page-break-inside: avoid; border: 1px solid #ccc !important; background: white !important; box-shadow: none !important; }
  .report-card h1, .report-card h2, .report-card h3 { color: black !important; }
}
`,
    [],
  );
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
