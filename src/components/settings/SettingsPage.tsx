import { useState } from "react";
import {
  Settings,
  Package,
  Palette,
  Database,
  FolderOpen,
  Trash2,
  RotateCcw,
  FileDown,
  Check,
  Info,
  RefreshCw,
  Download,
  Crown,
  HardDrive,
  Usb,
} from "lucide-react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSettingsStore, type AccentColor } from "../../stores/settingsStore";
import { useProfileStore } from "../../stores/profileStore";
import { useUpdateStore } from "../../stores/updateStore";
import { useLicenseStore } from "../../stores/licenseStore";
import { APP_NAME, APP_VERSION } from "../../config/app";
import type { AppCategory } from "../../types/apps";
import { BrandingSection } from "./BrandingSection";
import { PortableSection } from "./PortableSection";
import { IntegrationsSection } from "./IntegrationsSection";

const ACCENT_PRESETS: { value: AccentColor; label: string; swatch: string }[] = [
  { value: "teal", label: "Teal", swatch: "#00d4aa" },
  { value: "blue", label: "Blue", swatch: "#3b82f6" },
  { value: "purple", label: "Purple", swatch: "#a855f7" },
  { value: "orange", label: "Orange", swatch: "#f97316" },
  { value: "rose", label: "Rose", swatch: "#f43f5e" },
  { value: "green", label: "Green", swatch: "#22c55e" },
];

const CATEGORIES: { value: AppCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Browser", label: "Browsers" },
  { value: "Gaming", label: "Gaming" },
  { value: "Communication", label: "Communication" },
  { value: "Development", label: "Development" },
  { value: "Media", label: "Media" },
  { value: "Productivity", label: "Productivity" },
  { value: "Utilities", label: "Utilities" },
  { value: "Security", label: "Security" },
  { value: "Runtime", label: "Runtimes" },
];

interface SettingsPageProps {
  onNavigate: (view: string) => void;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const { settings, setSetting, setAccentColor, resetSettings, isPortable } = useSettingsStore();
  const { fetchProfiles } = useProfileStore();
  const { status: updateStatus, newVersion, checkForUpdates, downloadAndInstall } = useUpdateStore();
  const { licenseKey, validatedAt, customerName, isPro, activate, clearLicense } = useLicenseStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [licenseInput, setLicenseInput] = useState("");
  const [activating, setActivating] = useState(false);

  const handleClearProfiles = async () => {
    try {
      const profiles = await invoke<{ filePath: string }[]>("list_profiles");
      for (const p of profiles) {
        await invoke("delete_profile", { filePath: p.filePath });
      }
      await fetchProfiles();
      toast.success("All profiles cleared");
    } catch (err) {
      toast.error(`Failed: ${err}`);
    }
    setConfirmClear(false);
  };

  const handleResetSettings = async () => {
    await resetSettings();
    toast.success("Settings reset to defaults");
    setConfirmReset(false);
  };

  const handleExportDiagnostics = async () => {
    try {
      const hw = await invoke<Record<string, unknown>>("get_hardware_summary");
      const lines = [
        `${APP_NAME} Diagnostic Report`,
        `Version: ${APP_VERSION}`,
        `Date: ${new Date().toISOString()}`,
        `OS: ${navigator.userAgent}`,
        "",
        "Hardware Summary:",
        JSON.stringify(hw, null, 2),
        "",
        "Settings:",
        JSON.stringify(settings, null, 2),
      ];
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Diagnostic info copied to clipboard");
    } catch (err) {
      toast.error(`Failed: ${err}`);
    }
  };

  const handleOpenProfilesDir = async () => {
    try {
      await openUrl("file:///C:/Users");
      toast.info("Profiles are stored in: %APPDATA%\\com.freshrig.app\\profiles");
    } catch {
      toast.info("Profiles directory: %APPDATA%\\com.freshrig.app\\profiles");
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-muted">
          <Settings className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Configure {APP_NAME} to your liking
          </p>
        </div>
      </div>

      {/* Section: General */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">General</h2>
        <div className="bg-bg-card border border-border rounded-lg divide-y divide-border">
          <SettingRow label="App Name" description="Application identifier">
            <span className="text-sm text-text-secondary font-mono">{APP_NAME}</span>
          </SettingRow>
          <SettingRow label="Default install behavior" description="How apps are installed via winget">
            <select
              value={settings.defaultInstallBehavior}
              onChange={(e) => setSetting("defaultInstallBehavior", e.target.value as "silent" | "interactive")}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
            >
              <option value="silent">Silent</option>
              <option value="interactive">Interactive</option>
            </select>
          </SettingRow>
          <SettingRow label="Show hardware info in profiles" description="Include hardware snapshot when saving profiles">
            <Toggle
              checked={settings.showHardwareInProfiles}
              onChange={(v) => setSetting("showHardwareInProfiles", v)}
            />
          </SettingRow>
          <SettingRow label="Check for updates on startup" description="Automatically check for new versions">
            <Toggle
              checked={settings.checkForUpdates}
              onChange={(v) => setSetting("checkForUpdates", v)}
            />
          </SettingRow>
          <SettingRow
            label="Mode"
            description={isPortable ? "Running from portable directory" : "Installed via NSIS installer"}
          >
            <div className="flex items-center gap-1.5 text-sm text-text-secondary">
              {isPortable ? (
                <>
                  <Usb className="w-4 h-4 text-accent" />
                  <span>Portable</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4" />
                  <span>Installed</span>
                </>
              )}
            </div>
          </SettingRow>
        </div>
      </section>

      {/* Section: App Updates */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Download className="w-4 h-4" />
          App Updates
        </h2>
        <div className="bg-bg-card border border-border rounded-lg divide-y divide-border">
          <SettingRow label="Current version" description={`FreshRig v${APP_VERSION}`}>
            <span className="text-sm text-text-secondary font-mono">v{APP_VERSION}</span>
          </SettingRow>
          <SettingRow
            label="Check for updates"
            description={
              isPortable
                ? "Auto-updates are not available in portable mode"
                : updateStatus === "checking"
                  ? "Checking..."
                  : updateStatus === "up-to-date"
                    ? "You're up to date"
                    : updateStatus === "available"
                      ? `Update available: v${newVersion}`
                      : updateStatus === "error"
                        ? "Failed to check for updates"
                        : "Click to check now"
            }
          >
            <div className="flex items-center gap-2">
              {updateStatus === "available" && (
                <button
                  onClick={downloadAndInstall}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-accent text-bg-primary hover:bg-accent-hover transition-colors"
                >
                  Update Now
                </button>
              )}
              <button
                onClick={() => checkForUpdates(false)}
                disabled={updateStatus === "checking"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${updateStatus === "checking" ? "animate-spin" : ""}`}
                />
                {updateStatus === "checking" ? "Checking..." : "Check Now"}
              </button>
            </div>
          </SettingRow>
        </div>
      </section>

      {/* Section: App Catalog */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4" />
          App Catalog
        </h2>
        <div className="bg-bg-card border border-border rounded-lg divide-y divide-border">
          <SettingRow label="Default category" description="Category shown when opening the catalog">
            <select
              value={settings.defaultCategory}
              onChange={(e) => setSetting("defaultCategory", e.target.value as AppCategory | "all")}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label="Show runtimes in catalog" description="Display runtime packages like .NET, Node.js">
            <Toggle
              checked={settings.showRuntimes}
              onChange={(v) => setSetting("showRuntimes", v)}
            />
          </SettingRow>
          <SettingRow label="Confirm before installing" description="Show confirmation dialog before starting installs">
            <Toggle
              checked={settings.confirmBeforeInstalling}
              onChange={(v) => setSetting("confirmBeforeInstalling", v)}
            />
          </SettingRow>
        </div>
      </section>

      {/* Section: Appearance */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Appearance
        </h2>
        <div className="bg-bg-card border border-border rounded-lg p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Accent color</p>
            <p className="text-xs text-text-muted mt-0.5">Customize the app's highlight color</p>
          </div>
          <div className="flex items-start gap-5">
            {ACCENT_PRESETS.map((preset) => {
              const selected = settings.accentColor === preset.value;
              return (
                <button
                  key={preset.value}
                  onClick={() => setAccentColor(preset.value)}
                  className="flex flex-col items-center gap-2 group"
                  aria-pressed={selected}
                  aria-label={`${preset.label} accent`}
                  title={preset.label}
                >
                  <span
                    className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center ${
                      selected
                        ? "ring-2 ring-offset-2 ring-offset-bg-card ring-accent scale-105"
                        : "group-hover:scale-110"
                    }`}
                    style={{ backgroundColor: preset.swatch }}
                  >
                    {selected && <Check className="w-4 h-4 text-white drop-shadow-sm" />}
                  </span>
                  <span
                    className={`text-xs transition-colors ${
                      selected ? "text-text-primary font-medium" : "text-text-muted"
                    }`}
                  >
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section: System Tray */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">System Tray</h2>
        <div className="bg-bg-card border border-border rounded-lg divide-y divide-border">
          <SettingRow label="Minimize to tray on close" description="Hide window instead of quitting when closed">
            <Toggle
              checked={settings.minimizeToTray}
              onChange={(v) => setSetting("minimizeToTray", v)}
            />
          </SettingRow>
          <SettingRow label="Start minimized" description="Launch the app hidden in the system tray">
            <Toggle
              checked={settings.startMinimized}
              onChange={(v) => setSetting("startMinimized", v)}
            />
          </SettingRow>
        </div>
      </section>

      {/* Section: Data */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4" />
          Data
        </h2>
        <div className="bg-bg-card border border-border rounded-lg divide-y divide-border">
          <SettingRow label="Profiles directory" description="%APPDATA%/com.freshrig.app/profiles">
            <button
              onClick={handleOpenProfilesDir}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Open Folder
            </button>
          </SettingRow>
          <SettingRow label="Clear all profiles" description="Delete all saved profiles permanently">
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-error hover:bg-error/10 border border-error/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearProfiles}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-error text-white hover:bg-error/90 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </SettingRow>
          <SettingRow label="Reset all settings" description="Restore all settings to defaults">
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-warning hover:bg-warning/10 border border-warning/20 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetSettings}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-warning text-bg-primary hover:bg-warning/90 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </SettingRow>
          <SettingRow label="Export diagnostic info" description="Copy hardware and app info to clipboard">
            <button
              onClick={handleExportDiagnostics}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              Copy
            </button>
          </SettingRow>
        </div>
      </section>

      {/* Section: FreshRig Pro */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          {APP_NAME} Pro
        </h2>
        <div className="bg-bg-card border border-border rounded-lg divide-y divide-border">
          {isPro() ? (
            <>
              <SettingRow label="Status" description="Your Pro license is active">
                <span className="flex items-center gap-1.5 text-sm text-amber-500 font-semibold">
                  <Crown className="w-4 h-4" />
                  Pro
                </span>
              </SettingRow>
              {customerName && (
                <SettingRow label="Customer" description="Registered to">
                  <span className="text-sm text-text-secondary">{customerName}</span>
                </SettingRow>
              )}
              <SettingRow
                label="License key"
                description={validatedAt ? `Validated ${new Date(validatedAt).toLocaleDateString()}` : ""}
              >
                <span className="text-sm text-text-secondary font-mono">
                  {licenseKey ? `${licenseKey.slice(0, 6)}${"*".repeat(Math.max(0, licenseKey.length - 6))}` : ""}
                </span>
              </SettingRow>
              <SettingRow label="Manage license" description="Deactivate your Pro license on this machine">
                <button
                  onClick={() => {
                    clearLicense();
                    toast.success("Pro license deactivated");
                  }}
                  className="px-3 py-1.5 rounded-md text-xs text-error hover:bg-error/10 border border-error/20 transition-colors"
                >
                  Deactivate
                </button>
              </SettingRow>
            </>
          ) : (
            <>
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <p className="text-sm font-semibold text-text-primary">Unlock Pro Features</p>
                </div>
                <ul className="text-xs text-text-secondary space-y-1.5 ml-7">
                  <li>Privacy Dashboard — telemetry & permission controls</li>
                  <li>Network Tools — DNS presets & saved Wi-Fi passwords</li>
                  <li>Context Menu Editor — classic menu & shell extensions</li>
                  <li>Services Manager — preset-based service hardening</li>
                  <li>PDF Diagnostic Report — branded health audit</li>
                  <li>Full debloating (Moderate + Expert tiers)</li>
                  <li>Unlimited profiles & custom apps</li>
                  <li>Priority support</li>
                </ul>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value.toUpperCase())}
                    placeholder="Enter license key (FR-XXXXX-XXXXX)"
                    className="flex-1 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
                    disabled={activating}
                  />
                  <button
                    onClick={async () => {
                      setActivating(true);
                      const result = await activate(licenseInput);
                      setActivating(false);
                      if (result.ok) {
                        toast.success("Pro license activated!");
                        setLicenseInput("");
                      } else {
                        toast.error(result.error ?? "Activation failed");
                      }
                    }}
                    disabled={!licenseInput.trim() || activating}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      licenseInput.trim() && !activating
                        ? "bg-amber-500 text-black hover:bg-amber-400"
                        : "bg-bg-tertiary text-text-muted cursor-not-allowed"
                    }`}
                  >
                    {activating && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {activating ? "Activating..." : "Activate"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Pro Business sections — hidden behind ProFeatureGate inside each. */}
      <BrandingSection />
      <PortableSection />
      <IntegrationsSection />

      {/* About link */}
      <div className="pt-2">
        <button
          onClick={() => onNavigate("about")}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors"
        >
          <Info className="w-4 h-4" />
          About {APP_NAME}
        </button>
      </div>
    </div>
  );
}

/* Reusable setting row */
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

/* Toggle switch */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
        checked ? "bg-accent" : "bg-bg-tertiary border border-border"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
