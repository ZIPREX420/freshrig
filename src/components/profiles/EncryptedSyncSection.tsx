// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// Encrypted Profile Sync section, rendered on the Profiles page above
// the regular profile grid.
//
// Three actions:
//   * Export — encrypt the active profile to a `.frprofile` blob
//     (passphrase-protected via age + scrypt) at a chosen path.
//   * Import — open a `.frprofile`, decrypt it with a passphrase, then
//     hand the decrypted RigProfile to the existing ImportPreviewDialog.
//   * Cloud detect — scan known cloud-sync folders for `.frprofile`
//     files. Detect-only, never auto-imports.
//
// The whole card is wrapped in <ProFeatureGate mode="overlay"> so non-Pro
// users see an upsell when they hover. The backend commands themselves
// are unrestricted; gating is a UI affordance.

import { useState } from "react";
import { api } from "../../lib";
import {
  open as openFileDialog,
  save as saveFileDialog,
} from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  Cloud,
  FileDown,
  FileUp,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { Card } from "../ui/Card";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import { PassphraseDialog } from "./PassphraseDialog";
import { useProfileStore } from "../../stores/profileStore";
import type { RigProfile } from "../../types/profiles";
import type { DetectedProfile } from "../../types/profileSync";

type PendingAction =
  | { kind: "export"; outputPath: string }
  | { kind: "import"; inputPath: string }
  | null;

function humanizeRelative(iso: string): string {
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

export function EncryptedSyncSection() {
  const activeProfile = useProfileStore((s) => s.activeProfile);
  const setImportPreview = useProfileStore((s) => s.setImportPreview);
  const setShowImportPreview = useProfileStore((s) => s.setShowImportPreview);

  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const [detectLoading, setDetectLoading] = useState(false);
  const [detected, setDetected] = useState<DetectedProfile[] | null>(null);

  const onExportClick = async () => {
    if (!activeProfile) {
      toast.error(
        "Load a profile first — the active profile is what gets encrypted.",
      );
      return;
    }
    try {
      const safeName = activeProfile.metadata.name.replace(
        /[^a-zA-Z0-9_-]+/g,
        "_",
      );
      const path = await saveFileDialog({
        defaultPath: `${safeName || "profile"}.frprofile`,
        filters: [
          { name: "FreshRig encrypted profile", extensions: ["frprofile"] },
        ],
      });
      if (!path) return;
      setPending({ kind: "export", outputPath: path });
    } catch (err) {
      toast.error(`Could not open save dialog: ${err}`);
    }
  };

  const onImportClick = async () => {
    try {
      const picked = await openFileDialog({
        multiple: false,
        filters: [
          { name: "FreshRig encrypted profile", extensions: ["frprofile"] },
        ],
      });
      if (!picked || typeof picked !== "string") return;
      setPending({ kind: "import", inputPath: picked });
    } catch (err) {
      toast.error(`Could not open file picker: ${err}`);
    }
  };

  const startCloudImport = (path: string) => {
    setPending({ kind: "import", inputPath: path });
  };

  const onPassphraseSubmit = async (passphrase: string) => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "export") {
        if (!activeProfile) throw new Error("no active profile");
        await api.exportProfileEncrypted({
          profileJson: JSON.stringify(activeProfile),
          passphrase,
          outputPath: pending.outputPath,
        });
        toast.success(`Encrypted profile saved to ${pending.outputPath}`);
        setPending(null);
      } else {
        const json = await api.importProfileEncrypted({
          inputPath: pending.inputPath,
          passphrase,
        });
        let parsed: RigProfile;
        try {
          parsed = JSON.parse(json) as RigProfile;
        } catch (e) {
          throw new Error(`Decrypted blob is not valid JSON: ${e}`);
        }
        setImportPreview(parsed);
        setShowImportPreview(true);
        setPending(null);
      }
    } catch (err) {
      const msg = String(err);
      toast.error(
        pending.kind === "export"
          ? `Encrypt failed: ${msg}`
          : `Decrypt failed: ${msg}`,
      );
      // Stay on the dialog so the user can retry the passphrase.
    } finally {
      setBusy(false);
    }
  };

  const onDetect = async () => {
    setDetectLoading(true);
    try {
      const list = await api.detectCloudSyncedProfiles();
      setDetected(list);
      if (list.length === 0) {
        toast.info(
          "No .frprofile files found in OneDrive, Dropbox, iCloud or Google Drive.",
        );
      }
    } catch (err) {
      toast.error(`Cloud scan failed: ${err}`);
    } finally {
      setDetectLoading(false);
    }
  };

  return (
    <ProFeatureGate feature="Encrypted Profile Sync" mode="overlay">
      <Card className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent-muted shrink-0">
              <Lock className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                Encrypted Sync
                <span className="text-[10px] font-medium text-accent border border-accent/30 rounded-full px-1.5 py-0.5">
                  PRO
                </span>
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Cloud-safe, passphrase-encrypted{" "}
                <code className="font-mono text-[11px] text-text-primary">
                  .frprofile
                </code>{" "}
                files — age + scrypt.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
            onClick={onExportClick}
            disabled={!activeProfile || busy}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              activeProfile && !busy
                ? "bg-accent text-bg-primary border-transparent hover:bg-accent-hover"
                : "bg-bg-tertiary text-text-muted border-border cursor-not-allowed"
            }`}
            title={
              activeProfile
                ? `Encrypt "${activeProfile.metadata.name}"`
                : "Load a profile first"
            }
          >
            <FileDown className="w-4 h-4" />
            Export encrypted
          </button>
          <button
            onClick={onImportClick}
            disabled={busy}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileUp className="w-4 h-4" />
            Import encrypted
          </button>
          <button
            onClick={onDetect}
            disabled={detectLoading || busy}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {detectLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            Scan cloud folders
          </button>
        </div>

        {/* Active profile hint */}
        {!activeProfile && (
          <p className="text-[11px] text-text-muted">
            Tip: load one of your saved profiles to enable encrypted export.
          </p>
        )}

        {/* Cloud-detected list */}
        {detected !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-secondary">
                Found {detected.length} encrypted profile
                {detected.length === 1 ? "" : "s"} in cloud folders
              </p>
              <button
                onClick={onDetect}
                disabled={detectLoading}
                className="text-[11px] text-text-muted hover:text-text-primary inline-flex items-center gap-1"
              >
                <RefreshCw
                  className={`w-3 h-3 ${detectLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
            {detected.length > 0 && (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                {detected.map((p) => (
                  <li
                    key={p.path}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-bg-tertiary border border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary truncate">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-text-muted truncate font-mono">
                        {p.path}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-text-muted">
                        {humanizeRelative(p.modifiedAt)}
                      </span>
                      <button
                        onClick={() => startCloudImport(p.path)}
                        disabled={busy}
                        className="px-2.5 py-1 rounded-md bg-accent text-bg-primary text-[11px] font-medium hover:bg-accent-hover transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Decrypt & import
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      {pending?.kind === "export" && (
        <PassphraseDialog
          mode="encrypt"
          busy={busy}
          onClose={() => !busy && setPending(null)}
          onSubmit={onPassphraseSubmit}
        />
      )}
      {pending?.kind === "import" && (
        <PassphraseDialog
          mode="decrypt"
          busy={busy}
          onClose={() => !busy && setPending(null)}
          onSubmit={onPassphraseSubmit}
        />
      )}
    </ProFeatureGate>
  );
}
