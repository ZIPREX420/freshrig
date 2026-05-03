import { useEffect, useMemo, useState } from "react";
import {
  Package,
  Search,
  AlertTriangle,
  Download,
  BookMarked,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  Loader2,
  Link,
  ShieldCheck,
  ShieldAlert,
  HardDrive,
  WifiOff,
  Crown,
  Lock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../../stores/appStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useLicenseStore } from "../../stores/licenseStore";
import { AppCard } from "./AppCard";
import { CategoryFilter } from "./CategoryFilter";
import { InstallProgressPanel } from "./InstallProgressPanel";
import { SaveProfileDialog } from "../profiles/SaveProfileDialog";
import { PresetSelector } from "./PresetSelector";
import { WingetSearchResults } from "./WingetSearchResults";
import { AddCustomAppDialog } from "./AddCustomAppDialog";
import { ProFeatureGate } from "../ui/ProFeatureGate";
import { PRO_PURCHASE_URL_ANNUAL, TRIAL_DAYS } from "../../config/app";
import type { CustomAppEntry, DownloadProgress, InstallerType } from "../../types/custom_apps";

export function AppsPage() {
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [showLowDiskWarning, setShowLowDiskWarning] = useState(false);
  const [diskSpaceAvailable, setDiskSpaceAvailable] = useState<number | null>(null);
  const [showInstallConfirm, setShowInstallConfirm] = useState(false);

  const confirmBeforeInstalling = useSettingsStore((s) => s.settings.confirmBeforeInstalling);
  const isPro = useLicenseStore((s) => s.isPro());
  const startTrial = useLicenseStore((s) => s.startTrial);
  const canStartTrial = useLicenseStore((s) => s.canStartTrial());
  const [showProUpsell, setShowProUpsell] = useState<{ reason: "toggle" | "install"; appName?: string } | null>(null);

  const {
    catalog,
    selectedIds,
    installProgress,
    isInstalling,
    wingetAvailable,
    searchQuery,
    activeCategory,
    loading,
    fetchCatalog,
    checkWinget,
    toggleApp,
    selectAll,
    clearSelection,
    installSelected,
    setSearchQuery,
    setActiveCategory,
    wingetResults,
    isSearchingWinget,
    installedAppIds,
    isCheckingInstalled,
    hideInstalled,
    setHideInstalled,
    checkInstalledApps,
    customApps,
    customAppInstalling,
    fetchCustomApps,
    addCustomApp,
    removeCustomApp,
    installCustomApp,
    checkDiskSpace,
    checkNetwork,
    networkAvailable,
    deselectCategory,
  } = useAppStore();

  useEffect(() => {
    fetchCatalog();
    checkWinget();
    checkNetwork();
    fetchCustomApps();
  }, [fetchCatalog, checkWinget, checkNetwork, fetchCustomApps]);

  // Listen for custom download progress
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<DownloadProgress>("custom-download-progress", (event) => {
      setDownloadProgress(event.payload);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  const filteredApps = useMemo(() => {
    return catalog.filter((app) => {
      const matchesCategory = activeCategory === "all" || app.category === activeCategory;
      const matchesSearch =
        !searchQuery ||
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesInstalled = !hideInstalled || !installedAppIds.has(app.id);
      return matchesCategory && matchesSearch && matchesInstalled;
    });
  }, [catalog, activeCategory, searchQuery, hideInstalled, installedAppIds]);

  const installedCount = installedAppIds.size;
  const showWingetResults = searchQuery.trim().length >= 2;

  const allInCategorySelected = useMemo(() => {
    if (filteredApps.length === 0) return false;
    return filteredApps.every((app) => selectedIds.has(app.id));
  }, [filteredApps, selectedIds]);

  const estimatedSize = useMemo(() => {
    let totalMb = 0;
    let hasUnknown = false;
    for (const id of selectedIds) {
      const app = catalog.find((a) => a.id === id);
      if (app?.estimatedSizeMb) {
        totalMb += app.estimatedSizeMb;
      } else {
        hasUnknown = true;
      }
    }
    return { totalMb, hasUnknown };
  }, [selectedIds, catalog]);

  const handleToggleApp = (id: string) => {
    if (!isPro) {
      const app = catalog.find((a) => a.id === id);
      if (app && app.tier === "pro") {
        setShowProUpsell({ reason: "toggle", appName: app.name });
        return;
      }
    }
    toggleApp(id);
  };

  const handleInstallClick = async () => {
    // Free users can't bulk-install Pro-tier apps; intercept and surface the
    // upsell instead. (They can still uncheck the locked apps and install the
    // free ones, or activate trial/Pro.)
    if (!isPro) {
      const blocked = Array.from(selectedIds).find((id) => {
        const app = catalog.find((a) => a.id === id);
        return app && app.tier === "pro";
      });
      if (blocked) {
        setShowProUpsell({ reason: "install" });
        return;
      }
    }
    const gb = await checkDiskSpace();
    if (gb !== null && gb < 5) {
      setDiskSpaceAvailable(gb);
      setShowLowDiskWarning(true);
      return;
    }
    const online = await checkNetwork();
    if (!online) {
      toast.error("No internet connection. App installation requires a network connection.");
      return;
    }
    if (confirmBeforeInstalling) {
      setShowInstallConfirm(true);
      return;
    }
    installSelected();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-muted">
            <Package className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">App Catalog</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Select apps to install with one click
            </p>
          </div>
        </div>
      </div>

      {/* Preset Selector */}
      <PresetSelector />

      {/* Winget warning */}
      {wingetAvailable === false && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-warning/10 border border-warning/20 animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <p className="text-sm text-warning">
            Winget is not detected. Please install{" "}
            <span className="font-semibold">App Installer</span> from the Microsoft Store to enable
            app installation.
          </p>
        </div>
      )}

      {/* Network offline warning */}
      {networkAvailable === false && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-error/10 border border-error/20 animate-fade-in">
          <WifiOff className="w-5 h-5 text-error shrink-0" />
          <p className="text-sm text-error">
            No internet connection detected. App installation requires an internet connection.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search apps or winget repository..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>

          {/* Add Custom App */}
          <ProFeatureGate feature="custom_apps" mode="badge">
            <button
              onClick={() => setShowAddCustom(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors"
              title="Add custom app"
            >
              <Plus className="w-3.5 h-3.5" />
              Custom
            </button>
          </ProFeatureGate>

          {/* Installed filter */}
          {installedCount > 0 && (
            <button
              onClick={() => setHideInstalled(!hideInstalled)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                hideInstalled
                  ? "bg-accent-muted text-accent"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
              }`}
              title={hideInstalled ? "Show installed apps" : "Hide installed apps"}
            >
              {hideInstalled ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              {installedCount} installed
            </button>
          )}

          {/* Refresh installed */}
          {installedCount > 0 && (
            <button
              onClick={checkInstalledApps}
              disabled={isCheckingInstalled}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
              title="Re-scan installed apps"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isCheckingInstalled ? "animate-spin" : ""}`}
              />
            </button>
          )}

          {/* Selection info + actions */}
          <div className="flex items-center gap-2 ml-auto">
            {selectedIds.size > 0 && (
              <>
                <span className="text-xs text-text-secondary">
                  {selectedIds.size} app{selectedIds.size !== 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={clearSelection}
                  className="px-2.5 py-1.5 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  Clear
                </button>
              </>
            )}
            <button
              onClick={() =>
                allInCategorySelected
                  ? deselectCategory(activeCategory)
                  : selectAll(activeCategory)
              }
              className="px-2.5 py-1.5 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              {allInCategorySelected ? "Deselect All" : "Select All"}
            </button>

            <button
              onClick={() => setShowSaveProfile(true)}
              disabled={selectedIds.size === 0}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                selectedIds.size > 0
                  ? "border border-border text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                  : "bg-bg-tertiary text-text-muted cursor-not-allowed"
              }`}
            >
              <BookMarked className="w-4 h-4" />
              Save as Profile
            </button>

            {selectedIds.size > 0 && estimatedSize.totalMb > 0 && (
              <span className="text-[11px] text-text-muted">
                ~{estimatedSize.totalMb >= 1000
                  ? `${(estimatedSize.totalMb / 1000).toFixed(1)} GB`
                  : `${estimatedSize.totalMb} MB`}
                {estimatedSize.hasUnknown ? " (some apps excluded)" : ""} estimated
              </span>
            )}
            <button
              onClick={handleInstallClick}
              disabled={selectedIds.size === 0 || isInstalling || wingetAvailable === false}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                selectedIds.size > 0 && !isInstalling && wingetAvailable !== false
                  ? "bg-accent text-bg-primary hover:bg-accent-hover shadow-[0_0_20px_var(--accent-subtle)] hover:shadow-[0_0_28px_var(--accent-ring)]"
                  : "bg-bg-tertiary text-text-muted cursor-not-allowed"
              }`}
            >
              <Download className="w-4 h-4" />
              Install Selected
            </button>
          </div>
        </div>

        {/* Category pills */}
        <CategoryFilter activeCategory={activeCategory} onSelect={setActiveCategory} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" aria-busy="true" aria-label="Loading app catalog">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-bg-card border border-border animate-pulse" />
          ))}
        </div>
      )}

      {/* App grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              selected={selectedIds.has(app.id)}
              progress={installProgress.get(app.id)}
              onToggle={() => handleToggleApp(app.id)}
              isInstalled={installedAppIds.has(app.id)}
              proLocked={!isPro && app.tier === "pro"}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredApps.length === 0 && !showWingetResults && (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <Package className="w-12 h-12 text-text-muted mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-1">No apps found</h3>
          <p className="text-sm text-text-secondary">Try a different search or category.</p>
        </div>
      )}

      {/* Custom Apps section */}
      {customApps.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Custom Apps ({customApps.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {customApps.map((app) => {
              const isInstalling = customAppInstalling === app.id;
              const progress = isInstalling && downloadProgress
                ? Math.round((downloadProgress.downloaded / Math.max(downloadProgress.total, 1)) * 100)
                : 0;
              return (
                <div
                  key={app.id}
                  className="relative flex items-start gap-3 px-4 py-3 rounded-lg bg-bg-card border border-border hover:bg-bg-card-hover transition-colors group"
                >
                  {/* Icon */}
                  <div className="flex items-center justify-center w-9 h-9 rounded-md bg-amber-500/10 shrink-0 mt-0.5">
                    <Package className="w-4.5 h-4.5 text-amber-500" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{app.name}</span>
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-semibold">
                        Custom
                      </span>
                      {app.expectedHash ? (
                        <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-success" title="Hash verified">
                          <ShieldCheck className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-text-muted" title="No hash verification">
                          <ShieldAlert className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    {app.description && (
                      <p className="text-xs text-text-secondary truncate mt-0.5">{app.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <Link className="w-3 h-3 text-text-muted shrink-0" />
                      <span className="text-[10px] text-text-muted truncate">{app.downloadUrl}</span>
                    </div>
                    {isInstalling && (
                      <div className="mt-2">
                        <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {downloadProgress?.filename} — {progress}%
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        installCustomApp(app);
                        toast.info(`Installing ${app.name}...`);
                      }}
                      disabled={isInstalling}
                      className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent-muted transition-colors disabled:opacity-50"
                      title="Install"
                    >
                      {isInstalling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={async () => {
                        await removeCustomApp(app.id);
                        toast.success(`Removed ${app.name}`);
                      }}
                      className="p-1.5 rounded-md text-text-muted hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Winget search results */}
      {showWingetResults && (
        <WingetSearchResults results={wingetResults} isSearching={isSearchingWinget} />
      )}

      {/* Install progress panel */}
      {installProgress.size > 0 && (
        <InstallProgressPanel
          progress={installProgress}
          onDone={() => useAppStore.setState({ installProgress: new Map() })}
        />
      )}

      {/* Save as Profile dialog */}
      {showSaveProfile && (
        <SaveProfileDialog
          onClose={() => setShowSaveProfile(false)}
          onSaved={() => setShowSaveProfile(false)}
        />
      )}

      {/* Low disk space warning dialog */}
      {showLowDiskWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowLowDiskWarning(false)}>
          <div className="bg-bg-elevated border border-border rounded-xl shadow-elevated w-full max-w-sm mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-warning/20">
                  <HardDrive className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Low Disk Space</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Only {diskSpaceAvailable?.toFixed(1)} GB free on C: drive
                  </p>
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                Your disk space is running low. Installing apps may fail or leave your system with very little free space.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowLowDiskWarning(false)}
                  className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowLowDiskWarning(false);
                    const online = await checkNetwork();
                    if (!online) {
                      toast.error("No internet connection. App installation requires a network connection.");
                      return;
                    }
                    if (confirmBeforeInstalling) {
                      setShowInstallConfirm(true);
                    } else {
                      installSelected();
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-warning text-bg-primary hover:bg-warning/90 transition-colors"
                >
                  Install Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Install confirmation dialog */}
      {showInstallConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowInstallConfirm(false)}>
          <div className="bg-bg-elevated border border-border rounded-xl shadow-elevated w-full max-w-sm mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-muted">
                  <ShieldAlert className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Ready to install {selectedIds.size} app{selectedIds.size !== 1 ? "s" : ""}?
                  </h3>
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                Installs run silently in the background. You can keep using FreshRig while they finish.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowInstallConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowInstallConfirm(false);
                    installSelected();
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-bg-primary hover:bg-accent-hover transition-colors"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom App dialog */}
      {showAddCustom && (
        <AddCustomAppDialog
          onClose={() => setShowAddCustom(false)}
          onSave={async (data) => {
            const entry: CustomAppEntry = {
              id: `custom_${Date.now()}`,
              name: data.name,
              description: data.description || null,
              downloadUrl: data.downloadUrl,
              installerType: data.installerType as InstallerType,
              silentArgs: data.silentArgs,
              expectedHash: data.expectedHash || null,
              createdAt: new Date().toISOString(),
              lastUsed: null,
            };
            try {
              await addCustomApp(entry);
              toast.success(`Added ${data.name}`);
              setShowAddCustom(false);
            } catch (err) {
              toast.error(`Failed: ${err}`);
            }
          }}
        />
      )}

      {/* Pro upsell modal — shown when a Free user clicks a Pro-tier app or
          tries to bulk-install one. Mirrors SaveProfileDialog modal frame. */}
      {showProUpsell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowProUpsell(null)}
        >
          <div
            className="bg-bg-elevated border border-border rounded-xl shadow-elevated w-full max-w-md mx-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <h2 className="text-lg font-semibold text-text-primary">
                  {showProUpsell.reason === "install"
                    ? "Pro apps in your selection"
                    : "Pro app"}
                </h2>
              </div>
              <button
                onClick={() => setShowProUpsell(null)}
                className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-text-secondary">
                {showProUpsell.reason === "install" ? (
                  <>
                    One or more apps in your selection are part of the full 60+ catalog.
                    Unlock the entire catalog with FreshRig Pro and batch-install them all
                    in one click.
                  </>
                ) : (
                  <>
                    <span className="text-text-primary font-medium">
                      {showProUpsell.appName}
                    </span>{" "}
                    is part of the full 60+ catalog. Unlock it (and the rest) with FreshRig Pro.
                  </>
                )}
              </p>
              <ul className="text-xs text-text-muted space-y-1 list-disc list-inside ml-2">
                <li>Full 60+ apps catalog</li>
                <li>Disk Cleanup, Privacy Dashboard, Network Tools</li>
                <li>SMART Disk Monitoring, Watchdog Mode, Encrypted Profile Sync</li>
                <li>PDF System Health Report</li>
              </ul>
            </div>
            <div className="flex justify-between gap-2 px-6 py-4 border-t border-border">
              {canStartTrial ? (
                <button
                  onClick={() => {
                    const r = startTrial();
                    if (r.ok) {
                      toast.success(`${TRIAL_DAYS}-day Pro trial started — enjoy!`);
                      setShowProUpsell(null);
                    } else {
                      toast.error(r.error ?? "Could not start trial");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-accent hover:bg-bg-tertiary transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Start {TRIAL_DAYS}-day free trial
                </button>
              ) : (
                <span className="text-xs text-text-muted self-center">
                  Trial already activated
                </span>
              )}
              <button
                onClick={() => {
                  window.open(PRO_PURCHASE_URL_ANNUAL, "_blank", "noopener,noreferrer");
                }}
                className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                <Crown className="w-4 h-4" />
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
