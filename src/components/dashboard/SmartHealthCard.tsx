// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// SMART Disk Health card on the Dashboard. Shows per-disk status from
// `read_smart_data`, lets the user open a Trend modal (last 30 readings
// from history, drawn with recharts), and lets Pro users enable a 6h
// scheduled background check.

import { useCallback, useEffect, useState } from "react";
import { errMessage } from "../../lib";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  HardDrive,
  Loader2,
  Save,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../ui/Card";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import { useLicenseStore } from "../../stores/licenseStore";
import type { SmartReading, SmartStatus } from "../../types/smart";

const statusMeta: Record<
  SmartStatus,
  { label: string; tone: string; dot: string; icon: typeof CheckCircle2 }
> = {
  Ok: {
    label: "Healthy",
    tone: "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/20",
    dot: "bg-[var(--success)]",
    icon: CheckCircle2,
  },
  Caution: {
    label: "Caution",
    tone: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/20",
    dot: "bg-[var(--warning)]",
    icon: AlertTriangle,
  },
  Critical: {
    label: "Critical",
    tone: "bg-[var(--error)]/15 text-[var(--error)] border-[var(--error)]/20",
    dot: "bg-[var(--error)]",
    icon: XCircle,
  },
  Unknown: {
    label: "Unknown",
    tone: "bg-[var(--text-muted)]/15 text-[var(--text-muted)] border-[var(--text-muted)]/20",
    dot: "bg-[var(--text-muted)]",
    icon: HardDrive,
  },
};

export function SmartHealthCard() {
  const [readings, setReadings] = useState<SmartReading[] | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [installCmd, setInstallCmd] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [trendDiskId, setTrendDiskId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const isPro = useLicenseStore((s) => s.isPro());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await invoke<boolean>("check_smartctl_available");
      setAvailable(ok);
      if (!ok) {
        const cmd = await invoke<string>("get_smart_install_command");
        setInstallCmd(cmd);
        setReadings([]);
        return;
      }
      const list = await invoke<SmartReading[]>("read_smart_data");
      setReadings(list);
      // Save snapshot to history so the trend chart has data.
      void invoke("save_smart_history", { readings: list }).catch(() => {});
    } catch (e) {
      toast.error(errMessage(e, "SMART check failed"));
      setReadings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCopyInstall = async () => {
    try {
      await navigator.clipboard.writeText(installCmd);
      toast.success("Install command copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const onSchedule = async () => {
    setScheduling(true);
    try {
      const msg = await invoke<string>("enable_smart_schedule", { isPro });
      toast.success(msg);
    } catch (e) {
      const msg = errMessage(e, "Failed to schedule");
      if (msg === "PRO_REQUIRED") {
        toast.error("Scheduled monitoring is a Pro feature.");
      } else {
        toast.error(msg);
      }
    } finally {
      setScheduling(false);
    }
  };

  // ───── render ─────

  if (available === false) {
    return (
      <Card>
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] shrink-0">
            <HardDrive className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">SMART Disk Health</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5 mb-3">
              Install <code className="font-mono text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">smartctl</code> to enable disk health monitoring.
            </p>
            <div className="flex items-center gap-2 p-2 rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] font-mono text-xs">
              <code className="flex-1 truncate text-[var(--text-secondary)]">{installCmd}</code>
              <button
                onClick={onCopyInstall}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ClipboardCopy className="w-3 h-3" />
                Copy
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const disks = readings ?? [];

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--accent-subtle)] shrink-0">
              <HardDrive className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">SMART Disk Health</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {loading
                  ? "Reading…"
                  : disks.length === 0
                    ? "No drives reported by smartctl."
                    : `${disks.length} drive${disks.length === 1 ? "" : "s"} monitored.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Refresh
            </button>
            <ProFeatureGate feature="scheduled SMART monitoring" mode="badge">
              <button
                onClick={onSchedule}
                disabled={scheduling}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
              >
                {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                Set up monitoring
              </button>
            </ProFeatureGate>
          </div>
        </div>

        {disks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {disks.map((d) => {
              const meta = statusMeta[d.overallStatus];
              const Icon = meta.icon;
              return (
                <div
                  key={d.diskId}
                  className="flex flex-col gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${meta.dot.replace("bg-", "text-")}`} aria-hidden="true" />
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${meta.tone}`}>
                      {meta.label}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-[var(--text-muted)]">{d.diskType}</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate" title={d.model}>
                      {d.model || d.diskId}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)] truncate">{d.diskId}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                    {d.temperatureC !== null && (
                      <span>{d.temperatureC}°C</span>
                    )}
                    {d.powerOnHours !== null && (
                      <span>{Math.round(d.powerOnHours / 24).toLocaleString()} days on</span>
                    )}
                    <button
                      onClick={() => setTrendDiskId(d.diskId)}
                      className="ml-auto inline-flex items-center gap-1 text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Trend
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {trendDiskId && <TrendModal diskId={trendDiskId} onClose={() => setTrendDiskId(null)} />}
    </>
  );
}

function TrendModal({ diskId, onClose }: { diskId: string; onClose: () => void }) {
  const [series, setSeries] = useState<SmartReading[] | null>(null);

  useEffect(() => {
    invoke<SmartReading[]>("get_smart_trend", { diskId, lastN: 30 })
      .then(setSeries)
      .catch(() => setSeries([]));
  }, [diskId]);

  const data = (series ?? []).map((r) => ({
    t: r.capturedAt.slice(5, 16).replace("T", " "),
    temp: r.temperatureC ?? null,
    flagged: r.attributes.filter((a) => a.flagged).length,
  }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trend-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 id="trend-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Trend: <span className="font-mono text-sm">{diskId}</span>
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Last 30 readings — temperature and flagged-attribute count.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close trend"
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {series === null && (
          <div className="flex items-center justify-center h-48 text-[var(--text-muted)]">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
        {series !== null && series.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] py-12 text-center">
            No history yet — trends populate as the scheduled task runs (or after a few manual refreshes).
          </p>
        )}
        {series !== null && series.length > 0 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="temp" stroke="var(--accent)" strokeWidth={2} dot={false} name="°C" />
                <Line type="monotone" dataKey="flagged" stroke="var(--warning)" strokeWidth={2} dot={false} name="Flagged attrs" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
