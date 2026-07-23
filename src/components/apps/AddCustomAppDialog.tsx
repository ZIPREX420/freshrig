import { useState, useEffect } from "react";
import { X, AlertTriangle, Plus } from "lucide-react";
import type { InstallerType } from "../../types/custom_apps";
import {
  INSTALLER_TYPE_LABELS,
  INSTALLER_DEFAULT_ARGS,
  detectInstallerType,
} from "../../types/custom_apps";

interface AddCustomAppDialogProps {
  onClose: () => void;
  onSave: (app: {
    name: string;
    downloadUrl: string;
    installerType: InstallerType;
    silentArgs: string;
    expectedHash: string;
    description: string;
  }) => void;
}

export function AddCustomAppDialog({ onClose, onSave }: AddCustomAppDialogProps) {
  const [name, setName] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [installerType, setInstallerType] = useState<InstallerType>("unknown");
  const [silentArgs, setSilentArgs] = useState("");
  const [expectedHash, setExpectedHash] = useState("");
  const [description, setDescription] = useState("");
  const [urlError, setUrlError] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleUrlBlur = () => {
    if (downloadUrl && !downloadUrl.startsWith("https://")) {
      setUrlError("Only HTTPS URLs are allowed for security");
      return;
    }
    setUrlError("");
    if (downloadUrl) {
      const detected = detectInstallerType(downloadUrl);
      setInstallerType(detected);
      setSilentArgs(INSTALLER_DEFAULT_ARGS[detected]);
    }
  };

  const handleInstallerTypeChange = (type: InstallerType) => {
    setInstallerType(type);
    setSilentArgs(INSTALLER_DEFAULT_ARGS[type]);
  };

  const hashValid = /^[0-9a-fA-F]{64}$/.test(expectedHash.trim());
  const showHashError = expectedHash.trim().length > 0 && !hashValid;
  const canSave =
    name.trim() && downloadUrl.startsWith("https://") && !urlError && hashValid;

  const handleSubmit = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      downloadUrl: downloadUrl.trim(),
      installerType,
      silentArgs: silentArgs.trim(),
      expectedHash: expectedHash.trim(),
      description: description.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-bg-elevated border border-border rounded-xl shadow-elevated w-full max-w-lg mx-4 max-h-[85vh] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-text-primary">Add Custom App</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning">
              Custom apps are downloaded from external sources and run with elevated privileges.
              Only add apps from publishers you trust. A SHA-256 hash is required so each download
              is verified before it runs.
            </p>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Custom Tool"
              className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
            />
          </div>

          {/* Download URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Download URL <span className="text-error">*</span>
            </label>
            <input
              type="url"
              value={downloadUrl}
              onChange={(e) => {
                setDownloadUrl(e.target.value);
                setUrlError("");
              }}
              onBlur={handleUrlBlur}
              placeholder="https://example.com/app-setup.exe"
              className={`w-full px-3 py-2 rounded-lg bg-bg-tertiary border text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors ${
                urlError ? "border-error" : "border-border focus:border-accent/50"
              }`}
            />
            {urlError && <p className="text-xs text-error">{urlError}</p>}
          </div>

          {/* Installer Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Installer Type</label>
            <select
              value={installerType}
              onChange={(e) => handleInstallerTypeChange(e.target.value as InstallerType)}
              className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary focus:outline-none focus:border-accent/50"
            >
              {Object.entries(INSTALLER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Silent Args */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Silent Install Arguments</label>
            <input
              type="text"
              value={silentArgs}
              onChange={(e) => setSilentArgs(e.target.value)}
              placeholder="e.g. /S or /VERYSILENT"
              className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
            />
            <p className="text-[11px] text-text-muted">
              Pre-filled based on installer type. Override if needed.
            </p>
          </div>

          {/* SHA256 Hash */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              SHA256 Hash <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={expectedHash}
              onChange={(e) => setExpectedHash(e.target.value)}
              placeholder="Paste the publisher's SHA256 checksum (64 hex characters)"
              className={`w-full px-3 py-2 rounded-lg bg-bg-tertiary border text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors font-mono ${
                showHashError ? "border-error" : "border-border focus:border-accent/50"
              }`}
            />
            {showHashError ? (
              <p className="text-xs text-error">Enter a valid SHA-256 hash (64 hex characters).</p>
            ) : (
              <p className="text-[11px] text-text-muted">
                Required. The download is verified against this hash and the install is blocked if
                it doesn't match.
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              canSave
                ? "bg-accent text-bg-primary hover:bg-accent-hover"
                : "bg-bg-tertiary text-text-muted cursor-not-allowed"
            }`}
          >
            <Plus className="w-4 h-4" />
            Add App
          </button>
        </div>
      </div>
    </div>
  );
}
