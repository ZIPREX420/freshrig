import { useEffect, useState } from "react";
import { BookMarked, Plus, FileUp, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useProfileStore } from "../../stores/profileStore";
import { useAppStore } from "../../stores/appStore";
import { ProfileCard } from "./ProfileCard";
import { SaveProfileDialog } from "./SaveProfileDialog";
import { ImportPreviewDialog } from "./ImportPreviewDialog";
import { ImportShareCodeDialog } from "./ImportShareCodeDialog";
import { EncryptedSyncSection } from "./EncryptedSyncSection";

export function ProfilesPage() {
  const {
    profiles,
    activeProfile,
    loading,
    fetchProfiles,
    loadProfile,
    deleteProfile,
    importFromFile,
    clearActiveProfile,
    importPreview,
    showImportPreview,
    setShowImportPreview,
    setImportPreview,
  } = useProfileStore();

  const { clearSelection, toggleApp } = useAppStore();

  const [showSave, setShowSave] = useState(false);
  const [showShareCode, setShowShareCode] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleLoad = async (filePath: string) => {
    try {
      const profile = await loadProfile(filePath);
      clearSelection();
      for (const id of profile.apps) {
        toggleApp(id);
      }
      toast.success(`Profile "${profile.metadata.name}" loaded — ${profile.apps.length} apps selected`);
    } catch (err) {
      toast.error(`Failed to load profile: ${err}`);
    }
  };

  const handleDelete = async (filePath: string) => {
    try {
      await deleteProfile(filePath);
      await fetchProfiles();
      toast.success("Profile deleted");
    } catch (err) {
      toast.error(`Failed to delete: ${err}`);
    }
  };

  const handleImportFile = async () => {
    setShowImportMenu(false);
    try {
      await importFromFile();
    } catch (err) {
      if (!String(err).includes("cancelled")) toast.error(`Import failed: ${err}`);
    }
  };

  const handleApplyActive = () => {
    if (!activeProfile) return;
    clearSelection();
    for (const id of activeProfile.apps) {
      toggleApp(id);
    }
    toast.success(`Applied ${activeProfile.apps.length} apps from "${activeProfile.metadata.name}"`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-muted">
            <BookMarked className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Profiles</h1>
            <p className="text-sm text-text-secondary mt-0.5">Save, load, and share your rig setups</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Import dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <FileUp className="w-4 h-4" />
              Import
            </button>
            {showImportMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-bg-elevated border border-border rounded-lg shadow-elevated z-50 py-1 animate-fade-in">
                <button
                  onClick={handleImportFile}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  From File
                </button>
                <button
                  onClick={() => { setShowImportMenu(false); setShowShareCode(true); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  From Share Code
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSave(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-bg-primary text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        </div>
      </div>

      {/* Active profile banner */}
      {activeProfile && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-accent-muted border border-accent/20 animate-fade-in">
          <div className="flex items-center gap-2">
            <BookMarked className="w-4 h-4 text-accent" />
            <span className="text-sm text-text-primary">
              Profile &ldquo;{activeProfile.metadata.name}&rdquo; loaded — {activeProfile.apps.length} apps
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyActive}
              className="px-3 py-1.5 rounded-md bg-accent text-bg-primary text-xs font-medium hover:bg-accent-hover transition-colors"
            >
              Apply to App Catalog
            </button>
            <button
              onClick={clearActiveProfile}
              className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Encrypted Sync (Pro) */}
      <EncryptedSyncSection />

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 rounded-lg bg-bg-card border border-border animate-pulse" />
          ))}
        </div>
      )}

      {/* Profiles grid */}
      {!loading && profiles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {profiles.map((p, i) => (
            <ProfileCard
              key={p.filePath}
              profile={p}
              index={i}
              onLoad={() => handleLoad(p.filePath)}
              onDelete={() => handleDelete(p.filePath)}
              onShareProfile={() => {}}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && profiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <BookMarked className="w-14 h-14 text-text-muted mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">No profiles yet</h3>
          <p className="text-sm text-text-secondary max-w-sm text-center mb-6">
            Select some apps in the App Catalog, then save them as a profile to quickly set up any PC.
          </p>
          <button
            onClick={() => setShowSave(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-bg-primary text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Profile
          </button>
        </div>
      )}

      {/* Dialogs */}
      {showSave && (
        <SaveProfileDialog
          onClose={() => setShowSave(false)}
          onSaved={fetchProfiles}
        />
      )}
      {showImportPreview && importPreview && (
        <ImportPreviewDialog
          profile={importPreview}
          onClose={() => {
            setShowImportPreview(false);
            setImportPreview(null);
            fetchProfiles();
          }}
        />
      )}
      {showShareCode && (
        <ImportShareCodeDialog
          onClose={() => setShowShareCode(false)}
          onImported={(profile) => {
            setShowShareCode(false);
            setImportPreview(profile);
            setShowImportPreview(true);
          }}
        />
      )}
    </div>
  );
}
