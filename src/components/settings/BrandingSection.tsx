// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
//
// White-label branding section, rendered inside SettingsPage. Gated to
// Pro Business via <ProFeatureGate tier="business" mode="overlay">. The
// branding is injected into the printable health report (logo top-left,
// shop_name + phone in the header band, custom_url + "Powered by" footer).

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  Briefcase,
  ImageIcon,
  Loader2,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import { useLicenseStore } from "../../stores/licenseStore";
import { type Branding, DEFAULT_BRANDING } from "../../types/branding";

export function BrandingSection() {
  const isBusiness = useLicenseStore((s) => s.isBusiness());
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke<Branding>("get_branding")
      .then((b) => {
        setBranding(b);
      })
      .catch(() => {
        // Keep defaults on first run.
      })
      .finally(() => setLoaded(true));
  }, []);

  const onPickLogo = async () => {
    try {
      const picked = await openFileDialog({
        multiple: false,
        filters: [{ name: "Logo image", extensions: ["png", "jpg", "jpeg", "svg"] }],
      });
      if (!picked || typeof picked !== "string") return;
      try {
        await invoke("validate_logo", { path: picked });
      } catch (err) {
        toast.error(`Logo rejected: ${err}`);
        return;
      }
      setBranding((b) => ({ ...b, logoPath: picked }));
    } catch (err) {
      toast.error(`Could not open file picker: ${err}`);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await invoke("set_branding", { branding, isPro: isBusiness });
      toast.success("Branding saved");
    } catch (err) {
      toast.error(`Save failed: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const onClearLogo = () => setBranding((b) => ({ ...b, logoPath: null }));

  return (
    <ProFeatureGate feature="White-Label Branding" tier="business" mode="overlay">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-blue-400" />
          White-Label Branding
        </h2>
        <div className="bg-bg-card border border-border rounded-lg p-5 space-y-5">
          {/* Logo */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary">Shop logo</label>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center overflow-hidden shrink-0">
                {branding.logoPath ? (
                  <img
                    src={`asset://localhost/${encodeURIComponent(branding.logoPath)}`}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-text-muted" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={onPickLogo}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {branding.logoPath ? "Replace" : "Upload"}
                  </button>
                  {branding.logoPath && (
                    <button
                      onClick={onClearLogo}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-error hover:bg-error/10 border border-error/20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
                {branding.logoPath && (
                  <p className="text-[11px] text-text-muted font-mono break-all">
                    {branding.logoPath}
                  </p>
                )}
                <p className="text-[11px] text-text-muted">
                  PNG, JPG, or SVG. Max 2 MB.
                </p>
              </div>
            </div>
          </div>

          {/* Shop info grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Shop name *"
              value={branding.shopName}
              onChange={(v) => setBranding((b) => ({ ...b, shopName: v }))}
              placeholder="Acme PC Repair"
            />
            <Field
              label="Phone *"
              value={branding.phone}
              onChange={(v) => setBranding((b) => ({ ...b, phone: v }))}
              placeholder="+1 555 0123"
            />
            <Field
              label="Email"
              value={branding.email ?? ""}
              onChange={(v) => setBranding((b) => ({ ...b, email: v || null }))}
              placeholder="hello@acme.example"
            />
            <Field
              label="Custom URL"
              value={branding.customUrl ?? ""}
              onChange={(v) => setBranding((b) => ({ ...b, customUrl: v || null }))}
              placeholder="https://acme.example"
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Primary color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={branding.primaryColorHex || "#00d4aa"}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, primaryColorHex: e.target.value }))
                }
                className="w-12 h-9 rounded border border-border cursor-pointer bg-bg-tertiary"
              />
              <input
                type="text"
                value={branding.primaryColorHex}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, primaryColorHex: e.target.value }))
                }
                placeholder="#00d4aa"
                className="w-32 px-2 py-1.5 rounded-md bg-bg-tertiary border border-border text-xs text-text-primary font-mono focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
          </div>

          {/* Hide Powered by */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={branding.hidePoweredBy}
              onChange={(e) =>
                setBranding((b) => ({ ...b, hidePoweredBy: e.target.checked }))
              }
              className="accent-accent"
            />
            <span className="text-xs text-text-secondary">
              Hide &ldquo;Powered by FreshRig&rdquo; in printable reports
            </span>
          </label>

          {/* Live preview */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">Report header preview</p>
            <div
              className="rounded-lg border border-border p-4 flex items-center gap-3"
              style={{ background: branding.primaryColorHex || "#00d4aa", color: "#0a0a0f" }}
            >
              {branding.logoPath ? (
                <img
                  src={`asset://localhost/${encodeURIComponent(branding.logoPath)}`}
                  alt="Logo"
                  className="w-10 h-10 object-contain bg-white/80 rounded p-0.5"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-10 h-10 bg-black/20 rounded flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
              )}
              <div>
                <p className="font-semibold text-sm">
                  {branding.shopName || "Your shop name"}
                </p>
                <p className="text-xs opacity-80">{branding.phone || "Your phone"}</p>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2 border-t border-border">
            <button
              onClick={onSave}
              disabled={!loaded || saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-bg-primary text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save branding
            </button>
          </div>
        </div>
      </section>
    </ProFeatureGate>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
      />
    </div>
  );
}
