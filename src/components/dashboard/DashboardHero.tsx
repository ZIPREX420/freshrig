// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useMemo } from "react";
import { Card } from "../ui/Card";
import { HealthRing } from "../ui/HealthRing";
import { StatusPill } from "../ui/StatusPill";
import { ChevronRight, FileText, RefreshCw, AlertTriangle, Wrench } from "lucide-react";
import type { HardwareSummary, DriverIssue } from "../../types/hardware";
import { APP_VERSION } from "../../config/app";

interface DashboardHeroProps {
  summary: HardwareSummary;
  driverIssues: DriverIssue[];
  healthScore: number;
  onAction: (action: "report" | "drivers" | "refresh") => void;
}

interface QuickAction {
  id: "report" | "drivers" | "refresh";
  label: string;
  icon: typeof FileText;
}

function pickQuickActions(driverIssues: DriverIssue[]): QuickAction[] {
  const actions: QuickAction[] = [];
  if (driverIssues.length > 0) {
    actions.push({ id: "drivers", label: `Fix ${driverIssues.length} driver${driverIssues.length === 1 ? "" : "s"}`, icon: Wrench });
  }
  actions.push({ id: "report", label: "Generate health report", icon: FileText });
  actions.push({ id: "refresh", label: "Refresh hardware scan", icon: RefreshCw });
  return actions.slice(0, 3);
}

function statusCopy(score: number, driverIssues: DriverIssue[]): { headline: string; sub: string; tone: "success" | "warning" | "error" } {
  if (driverIssues.length > 0) {
    return {
      headline: `${driverIssues.length} driver issue${driverIssues.length === 1 ? "" : "s"} need attention`,
      sub: "Resolve them before installing apps for best stability.",
      tone: "warning",
    };
  }
  if (score >= 80) {
    return {
      headline: "Your rig is healthy",
      sub: "Hardware is detected, drivers look current, no warnings.",
      tone: "success",
    };
  }
  if (score >= 50) {
    return {
      headline: "Some issues detected",
      sub: "Take a quick look at the items below before continuing.",
      tone: "warning",
    };
  }
  return {
    headline: "Your rig needs attention",
    sub: "Multiple issues detected — start with the action strip below.",
    tone: "error",
  };
}

function networkBadge(summary: HardwareSummary): string {
  const online = summary.networkAdapters.filter((a) => /up|connected/i.test(a.connectionStatus));
  if (online.length === 0) return "Offline";
  const fastest = Math.max(...online.map((a) => a.speedMbps));
  if (fastest > 0) return `Online · ${fastest >= 1000 ? `${(fastest / 1000).toFixed(1)} Gbps` : `${fastest} Mbps`}`;
  return "Online";
}

export function DashboardHero({ summary, driverIssues, healthScore, onAction }: DashboardHeroProps) {
  const quickActions = useMemo(() => pickQuickActions(driverIssues), [driverIssues]);
  const status = useMemo(() => statusCopy(healthScore, driverIssues), [healthScore, driverIssues]);
  const motherboardLabel = `${summary.motherboard.manufacturer} ${summary.motherboard.product}`.trim() || "Unknown rig";
  const network = networkBadge(summary);

  return (
    <Card variant="hero" className="px-6 py-5">
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_auto_1fr] gap-6 items-center">
        {/* Greeting + status + quick actions */}
        <div className="space-y-3 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            {summary.system.hostname}
          </p>
          <div>
            <h1 className="text-[26px] font-semibold text-text-primary leading-tight tracking-tight">
              {status.headline}
            </h1>
            <p className="text-sm text-text-secondary mt-1.5">{status.sub}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  onClick={() => onAction(a.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary bg-white/[0.04] hover:bg-white/[0.08] hover:text-text-primary border border-border hover:border-border-hover transition-colors active:scale-[0.97] duration-100"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {a.label}
                  <ChevronRight className="w-3 h-3 opacity-60" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Health ring centerpiece */}
        <div className="flex justify-center">
          <HealthRing
            value={healthScore}
            size="xl"
            sublabel="System Readiness"
            ariaLabel={`System health: ${healthScore} out of 100. ${status.headline}.`}
          />
        </div>

        {/* System nameplate */}
        <div className="space-y-2.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-text-primary leading-tight truncate" title={motherboardLabel}>
              {motherboardLabel}
            </h2>
          </div>
          <div className="space-y-1.5">
            <NameplateRow label="OS" value={`${summary.system.osVersion} · Build ${summary.system.osBuild}`} />
            <NameplateRow label="CPU" value={`${summary.cpu.cores}C/${summary.cpu.threads}T @ ${summary.cpu.maxClockMhz} MHz`} />
            <NameplateRow label="RAM" value={`${summary.system.totalRamGb.toFixed(1)} GB`} />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            <StatusPill kind={status.tone} size="xs" pulse>{network}</StatusPill>
            <StatusPill kind="neutral" size="xs" mono>v{APP_VERSION}</StatusPill>
            {driverIssues.length > 0 && (
              <StatusPill kind="warning" size="xs" icon={AlertTriangle}>
                {driverIssues.length} driver issue{driverIssues.length === 1 ? "" : "s"}
              </StatusPill>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function NameplateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[10px] uppercase tracking-wider text-text-muted w-9 shrink-0">{label}</span>
      <span className="text-text-secondary font-mono tabular truncate" title={value}>{value}</span>
    </div>
  );
}
