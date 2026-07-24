// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Bulk profile deployment modal. Operator selects:
//   1. A profile (from the existing profiles list)
//   2. An output directory (USB/external drive)
//   3. The list of target machines (passed in from FleetDashboard)
// Backend writes one deploy bundle per machine via `create_deployment_bundle`.

import { useEffect, useState } from "react";
import { api } from "../../lib";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import {
  ChevronDown,
  FolderOpen,
  Loader2,
  Package,
  Upload,
  X,
} from "lucide-react";
import { useLicenseStore } from "../../stores/licenseStore";
import type { Machine } from "../../types/fleet";
import type { ProfileSummary } from "../../types/profiles";

interface BulkDeployPanelProps {
  machines: Machine[];
  onClose: () => void;
}

export function BulkDeployPanel({ machines, onClose }: BulkDeployPanelProps) {
  const isBusiness = useLicenseStore((s) => s.isBusiness());
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [outputDir, setOutputDir] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [lastResult, setLastResult] = useState<{ outputDir: string; count: number } | null>(null);

  useEffect(() => {
    api.listProfiles()
      .then(setProfiles)
      .catch(() => {
        // Profiles command is Windows-only — leave list empty silently.
      });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, busy]);

  const onPickFolder = async () => {
    const picked = await openFolderDialog({ directory: true, multiple: false });
    if (picked && typeof picked === "string") setOutputDir(picked);
  };

  const onDeploy = async () => {
    if (!selectedFile || !outputDir) {
      toast.error("Pick a profile and an output folder first.");
      return;
    }
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setBusy(true);
    try {
      const profile = await api.loadProfile({
        filePath: selectedFile,
      });
      const profileId = profile.metadata.name.replace(/[^a-zA-Z0-9_-]+/g, "_");
      const result = await api.createDeploymentBundle({
        profileId,
        profileJson: JSON.stringify(profile),
        targetMachines: machines,
        outputDir,
        isBusiness,
      });
      setLastResult({ outputDir: result.outputDir, count: result.machineCount });
      toast.success(`Deployed to ${result.machineCount} machine(s)`);
    } catch (err) {
      toast.error(`Bulk deploy failed: ${err}`);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-bg-elevated border border-border rounded-xl shadow-elevated w-full max-w-lg mx-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary inline-flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-400" />
            Bulk deploy
          </h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors disabled:opacity-60"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-text-secondary">
            One folder per machine will be written under your output directory.
            Each folder is self-contained: portable executable + profile JSON +
            launcher script.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Profile</label>
            <div className="relative">
              <select
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-8 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50"
              >
                <option value="" disabled>
                  Select a profile…
                </option>
                {profiles.map((p) => (
                  <option key={p.filePath} value={p.filePath}>
                    {p.name} ({p.appCount} apps)
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
            {profiles.length === 0 && (
              <p className="text-[11px] text-text-muted">
                No profiles yet — create one on the Profiles page first.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Output folder</label>
            <div className="flex items-center gap-2">
              <input
                value={outputDir}
                readOnly
                placeholder="Pick a folder on the USB drive…"
                className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <button
                onClick={onPickFolder}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Browse
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-text-secondary">
              Target machines ({machines.length})
            </p>
            <ul className="max-h-32 overflow-y-auto space-y-1">
              {machines.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-bg-tertiary text-xs"
                >
                  <span className="text-text-primary">{m.ownerName}</span>
                  <span className="text-text-muted font-mono">{m.hostname}</span>
                </li>
              ))}
            </ul>
          </div>

          {lastResult && (
            <div className="px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1.5">
              <p>
                Deployed to {lastResult.count} machine{lastResult.count === 1 ? "" : "s"}.
              </p>
              <button
                onClick={() => openPath(lastResult.outputDir).catch(() => {})}
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                <FolderOpen className="w-3 h-3" />
                Open folder
              </button>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onDeploy}
            disabled={busy || !selectedFile || !outputDir}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              busy || !selectedFile || !outputDir
                ? "bg-bg-tertiary text-text-muted cursor-not-allowed"
                : "bg-accent text-bg-primary hover:bg-accent-hover"
            }`}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            {busy
              ? "Generating…"
              : confirm
                ? `Confirm — ${machines.length} machine${machines.length === 1 ? "" : "s"}`
                : "Generate bundle"}
          </button>
        </footer>
      </div>
    </div>
  );
}
