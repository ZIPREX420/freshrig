// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Privacy Drift panel — captures a baseline of every privacy-relevant
// registry value and surfaces what Windows has changed under the user
// since then (e.g. a feature update flipping Recall back on).
//
// Lives as the "Drift" tab inside PrivacyPage.

import { useCallback, useEffect, useState } from "react";
import { errMessage } from "../../lib";
import {
  Camera,
  ChevronDown,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Card } from "../ui/Card";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import { useLicenseStore } from "../../stores/licenseStore";
import type { DriftEntry, DriftSeverity, PrivacyBaseline } from "../../types/privacyDrift";

const MONITORED_PATHS: Array<{ path: string; setting: string; severity: DriftSeverity }> = [
  { path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection\\AllowTelemetry", setting: "Telemetry level", severity: "High" },
  { path: "HKLM\\SYSTEM\\CurrentControlSet\\Services\\DiagTrack\\Start", setting: "DiagTrack service start", severity: "High" },
  { path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System\\UploadUserActivities", setting: "Upload activities to Microsoft", severity: "High" },
  { path: "HKCU\\Software\\Policies\\Microsoft\\Windows\\WindowsAI\\AllowRecallEnablement", setting: "Windows Recall", severity: "High" },
  { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo\\Enabled", setting: "Advertising ID enabled", severity: "Medium" },
  { path: "HKCU\\...\\ContentDeliveryManager\\SubscribedContent-338389Enabled", setting: "Tailored: suggested content", severity: "Medium" },
  { path: "HKCU\\...\\ContentDeliveryManager\\SubscribedContent-338388Enabled", setting: "Tailored: Start suggestions", severity: "Medium" },
  { path: "HKCU\\...\\ContentDeliveryManager\\SubscribedContent-338393Enabled", setting: "Tailored: tips & tricks", severity: "Medium" },
  { path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System\\PublishUserActivities", setting: "Publish user activities", severity: "Medium" },
  { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced\\Start_TrackProgs", setting: "Track app launches", severity: "Medium" },
  { path: "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System\\AllowClipboardHistory", setting: "Clipboard history", severity: "Medium" },
  { path: "HKCU\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot\\TurnOffWindowsCopilot", setting: "Windows Copilot disabled", severity: "Medium" },
  { path: "HKCU\\Software\\Microsoft\\Speech_OneCore\\Settings\\OnlineSpeechPrivacy\\HasAccepted", setting: "Online speech recognition", severity: "Medium" },
  { path: "HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer\\DisableSearchBoxSuggestions", setting: "Search box suggestions", severity: "Low" },
  { path: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search\\BingSearchEnabled", setting: "Bing in Start search", severity: "Low" },
  { path: "HKCU\\Software\\Microsoft\\InputPersonalization\\RestrictImplicitInkCollection", setting: "Restrict ink collection", severity: "Low" },
  { path: "HKCU\\Software\\Microsoft\\InputPersonalization\\RestrictImplicitTextCollection", setting: "Restrict text collection", severity: "Low" },
];

const severityMeta: Record<DriftSeverity, { label: string; tone: string; dot: string }> = {
  High: {
    label: "High",
    tone: "bg-[var(--error)]/15 text-[var(--error)] border-[var(--error)]/20",
    dot: "bg-[var(--error)]",
  },
  Medium: {
    label: "Medium",
    tone: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/20",
    dot: "bg-[var(--warning)]",
  },
  Low: {
    label: "Low",
    tone: "bg-[var(--text-muted)]/15 text-[var(--text-muted)] border-[var(--text-muted)]/20",
    dot: "bg-[var(--text-muted)]",
  },
};

function humanizeRelative(iso: string | null): string {
  if (!iso) return "Never";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "Unknown";
  const diff = Date.now() - then;
  if (diff < 0) return "Just now";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function PrivacyDriftPanel() {
  const [baseline, setBaseline] = useState<PrivacyBaseline | null>(null);
  const [drift, setDrift] = useState<DriftEntry[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const [showMonitored, setShowMonitored] = useState(false);
  const isPro = useLicenseStore((s) => s.isPro());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await invoke<DriftEntry[]>("check_privacy_drift");
      setDrift(list);
    } catch (e) {
      toast.error(errMessage(e, "Failed to check drift"));
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Initial load: read whatever's on disk for both baseline (via fresh
  // capture-or-empty hint) and drift list.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCapture = async () => {
    setCreating(true);
    try {
      const b = await invoke<PrivacyBaseline>("create_privacy_baseline");
      setBaseline(b);
      setDrift([]);
      toast.success("Baseline captured. We'll alert you if anything drifts.");
    } catch (e) {
      toast.error(errMessage(e, "Failed to capture baseline"));
    } finally {
      setCreating(false);
    }
  };

  const onReapply = async () => {
    setReapplying(true);
    try {
      await invoke("reapply_privacy_baseline", { isPro });
      toast.success("Reapplied baseline values. Refreshing drift.");
      await refresh();
    } catch (e) {
      const msg = errMessage(e, "Failed to reapply baseline");
      if (msg === "PRO_REQUIRED") {
        toast.error("One-click reapply is a Pro feature.");
      } else {
        toast.error(msg);
      }
    } finally {
      setReapplying(false);
    }
  };

  const onExport = async () => {
    try {
      const path = await saveFileDialog({
        defaultPath: "freshrig-privacy-baseline.json",
        filters: [{ name: "FreshRig baseline", extensions: ["json"] }],
      });
      if (!path) return;
      await invoke("export_baseline", { targetPath: path });
      toast.success("Baseline exported.");
    } catch (e) {
      toast.error(errMessage(e, "Failed to export baseline"));
    }
  };

  const onImport = async () => {
    try {
      const path = await openFileDialog({
        multiple: false,
        filters: [{ name: "FreshRig baseline", extensions: ["json"] }],
      });
      if (!path || typeof path !== "string") return;
      const b = await invoke<PrivacyBaseline>("import_baseline", { path });
      setBaseline(b);
      toast.success("Baseline imported. Checking drift…");
      await refresh();
    } catch (e) {
      toast.error(errMessage(e, "Failed to import baseline"));
    }
  };

  const driftCount = drift?.length ?? 0;
  const hasBaseline = baseline !== null || (drift !== null && !creating);

  return (
    <div className="space-y-6">
      {/* Baseline card */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--accent-subtle)] shrink-0">
            <Camera className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">
                  Baseline snapshot
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  {baseline
                    ? `Captured ${humanizeRelative(baseline.createdAt)} on Windows build ${baseline.windowsBuild}`
                    : hasBaseline
                      ? "Loading baseline…"
                      : "No baseline yet. Capture one to start drift detection."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onCapture}
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {baseline ? "Recapture" : "Capture baseline"}
                </button>
                {baseline && (
                  <>
                    <button
                      onClick={onExport}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      onClick={onImport}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Import
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Drift table */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] shrink-0">
              {driftCount === 0 ? (
                <ShieldCheck className="w-5 h-5 text-[var(--success)]" />
              ) : (
                <RefreshCw className="w-5 h-5 text-[var(--warning)]" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {drift === null
                  ? "Checking…"
                  : driftCount === 0
                    ? "No drift detected"
                    : `${driftCount} setting${driftCount === 1 ? "" : "s"} drifted`}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {driftCount === 0
                  ? "Current registry state matches your baseline."
                  : "Windows changed these privacy values since your baseline."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] disabled:opacity-50 transition-colors"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
            {driftCount > 0 && (
              <ProFeatureGate feature="one-click drift reapply" mode="badge">
                <button
                  onClick={onReapply}
                  disabled={reapplying}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--accent)] text-[var(--bg-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                >
                  {reapplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Reapply all
                </button>
              </ProFeatureGate>
            )}
          </div>
        </div>

        {driftCount > 0 && (
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-tertiary)]">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-[var(--text-muted)]">Setting</th>
                  <th className="text-left px-4 py-2 font-medium text-[var(--text-muted)]">Was</th>
                  <th className="text-left px-4 py-2 font-medium text-[var(--text-muted)]">Now</th>
                  <th className="text-left px-4 py-2 font-medium text-[var(--text-muted)]">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {drift!.map((d) => {
                  const sev = severityMeta[d.severity];
                  return (
                    <tr key={d.registryPath}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text-primary)]">{d.settingName}</div>
                        <div className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5 truncate max-w-[420px]" title={d.registryPath}>
                          {d.registryPath}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                        {d.baselineValue ?? <span className="italic text-[var(--text-muted)]">absent</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                        {d.currentValue ?? <span className="italic text-[var(--text-muted)]">absent</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${sev.tone}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} aria-hidden="true" />
                          {sev.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Transparency: what we monitor */}
      <Card>
        <button
          onClick={() => setShowMonitored((v) => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              What we monitor
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {MONITORED_PATHS.length} registry values across Telemetry, Advertising, Activity, AI/Copilot, Search, and Input.
            </p>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${showMonitored ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {showMonitored && (
          <ul className="mt-4 space-y-1.5 text-xs">
            {MONITORED_PATHS.map((m) => (
              <li key={m.path} className="flex items-start gap-2">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${severityMeta[m.severity].dot}`} aria-hidden="true" />
                <div className="min-w-0">
                  <span className="text-[var(--text-primary)]">{m.setting}</span>
                  <span className="font-mono text-[var(--text-muted)] ml-2 break-all">{m.path}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
