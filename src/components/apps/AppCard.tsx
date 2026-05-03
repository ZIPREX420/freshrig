import {
  Globe,
  Gamepad2,
  MessageCircle,
  Code,
  Play,
  FileText,
  Wrench,
  Shield,
  Cpu,
  Check,
  X,
  Loader2,
  Clock,
  Lock,
} from "lucide-react";
import type { AppEntry, InstallProgress, AppCategory } from "../../types/apps";

interface AppCardProps {
  app: AppEntry;
  selected: boolean;
  progress: InstallProgress | undefined;
  onToggle: () => void;
  isInstalled?: boolean;
  /**
   * True when the user is on the free tier and this app's tier === "pro".
   * The card stays visible (so the catalog still feels rich) but the toggle
   * action is intercepted by `onToggle` in AppsPage to show an upsell modal
   * instead of selecting the app.
   */
  proLocked?: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  globe: Globe,
  "gamepad-2": Gamepad2,
  "message-circle": MessageCircle,
  code: Code,
  play: Play,
  "file-text": FileText,
  wrench: Wrench,
  shield: Shield,
  cpu: Cpu,
};

const categoryColors: Record<AppCategory, string> = {
  Browser: "bg-blue-500/20 text-blue-400",
  Gaming: "bg-purple-500/20 text-purple-400",
  Communication: "bg-green-500/20 text-green-400",
  Development: "bg-amber-500/20 text-amber-400",
  Media: "bg-pink-500/20 text-pink-400",
  Productivity: "bg-cyan-500/20 text-cyan-400",
  Utilities: "bg-orange-500/20 text-orange-400",
  Security: "bg-red-500/20 text-red-400",
  Runtime: "bg-white/[0.06] text-[var(--text-secondary)]",
};

export function AppCard({ app, selected, progress, onToggle, isInstalled, proLocked }: AppCardProps) {
  const Icon = iconMap[app.iconName] ?? Globe;
  const isInstalling = progress?.status === "Installing";
  const isCompleted = progress?.status === "Completed";
  const isFailed = progress?.status === "Failed";
  const isPending = progress?.status === "Pending";
  const hasStatus = !!progress;

  return (
    <button
      onClick={hasStatus ? undefined : onToggle}
      disabled={hasStatus}
      title={proLocked ? "Unlock the full 60+ catalog with FreshRig Pro" : undefined}
      className={`relative w-full text-left rounded-xl border transition-colors duration-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
        selected && !hasStatus
          ? "bg-[var(--accent-subtle)] border-[var(--accent-ring)]"
          : proLocked
            ? "bg-[var(--bg-card)] border-[var(--border)] hover:border-amber-400/40 hover:bg-[var(--bg-card-hover)]"
            : "bg-[var(--bg-card)] border-[var(--border)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-hover)]"
      } ${hasStatus ? "cursor-default" : "cursor-pointer active:scale-[0.99] transition-transform duration-100"}`}
    >
      {/* Pro badge — shown when free user is looking at a Pro-tier app */}
      {proLocked && !hasStatus && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-semibold">
          <Lock className="w-2.5 h-2.5" />
          Pro
        </div>
      )}
      {/* Installed badge — wins over Pro badge when both apply */}
      {isInstalled && !hasStatus && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/15 text-success text-[9px] font-semibold">
          <Check className="w-2.5 h-2.5" />
          Installed
        </div>
      )}

      <div className={`p-4 flex items-start gap-3 ${proLocked && !hasStatus && !isInstalled ? "opacity-70" : ""}`}>
        {/* Checkbox / Status */}
        <div className="shrink-0 mt-0.5">
          {isCompleted ? (
            <div className="w-5 h-5 rounded bg-success/20 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-success" />
            </div>
          ) : isFailed ? (
            <div className="w-5 h-5 rounded bg-error/20 flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-error" />
            </div>
          ) : isInstalling ? (
            <div className="w-5 h-5 rounded bg-accent-muted flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
            </div>
          ) : isPending ? (
            <div className="w-5 h-5 rounded bg-bg-tertiary flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-text-muted" />
            </div>
          ) : proLocked ? (
            <div className="w-5 h-5 rounded bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Lock className="w-3 h-3 text-amber-400" />
            </div>
          ) : (
            <div
              className={`w-5 h-5 rounded border-2 transition-colors ${
                selected
                  ? "bg-accent border-accent"
                  : "border-border-hover bg-transparent"
              }`}
            >
              {selected && <Check className="w-3.5 h-3.5 text-bg-primary" />}
            </div>
          )}
        </div>

        {/* Icon */}
        <div className="shrink-0 w-9 h-9 rounded-md bg-bg-tertiary flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-text-secondary" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">{app.name}</h3>
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${categoryColors[app.category]}`}>
              {app.category}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5 truncate">{app.description}</p>
          {isFailed && progress?.message && (
            <p className="text-[11px] text-error mt-1 truncate" title={progress.message}>
              {progress.message}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
