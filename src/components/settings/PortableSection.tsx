// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// "Create USB Portable" section, gated to Pro Business via ProFeatureGate.
// Lets a shop tech copy the running FreshRig executable + their branding +
// license to a USB stick so they can plug it into a customer machine and
// run without installing anything.

import { useState } from "react";
import { api } from "../../lib";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Loader2, Usb } from "lucide-react";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import { useLicenseStore } from "../../stores/licenseStore";

export function PortableSection() {
  const isBusiness = useLicenseStore((s) => s.isBusiness());
  const [busy, setBusy] = useState(false);
  const [lastTarget, setLastTarget] = useState<string | null>(null);

  const onCreate = async () => {
    try {
      const picked = await openFolderDialog({ directory: true, multiple: false });
      if (!picked || typeof picked !== "string") return;
      setBusy(true);
      try {
        await api.bootstrapPortableDir({
          targetPath: picked,
          isBusiness,
        });
        setLastTarget(picked);
        toast.success(`Portable FreshRig copied to ${picked}. Plug into customer machine and run.`);
      } catch (err) {
        toast.error(`Bootstrap failed: ${err}`);
      } finally {
        setBusy(false);
      }
    } catch (err) {
      toast.error(`Could not open folder picker: ${err}`);
    }
  };

  return (
    <ProFeatureGate feature="USB Portable Mode" tier="business" mode="overlay">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Usb className="w-4 h-4 text-blue-400" />
          USB Portable Mode
        </h2>
        <div className="bg-bg-card border border-border rounded-lg p-5 space-y-3">
          <p className="text-sm text-text-secondary">
            Copy a runnable FreshRig (with your branding and license) to a USB
            stick or external folder. Plug into any Windows/Linux/macOS machine
            and run — no installation required.
          </p>
          <button
            onClick={onCreate}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-bg-primary text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Usb className="w-4 h-4" />}
            {busy ? "Copying…" : "Create USB Portable"}
          </button>
          {lastTarget && (
            <p className="text-xs text-text-muted font-mono break-all">
              Last bootstrapped: {lastTarget}
            </p>
          )}
          <p className="text-[11px] text-text-muted">
            The portable build is created by copying the currently-running
            executable. Run this on the OS you intend to deploy on.
          </p>
        </div>
      </section>
    </ProFeatureGate>
  );
}
