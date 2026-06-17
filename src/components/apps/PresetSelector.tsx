import { useEffect, useState } from "react";
import {
  Zap,
  Gamepad2,
  Code,
  Shield,
  Palette,
  Briefcase,
} from "lucide-react";
import { api } from "../../lib";
import { toast } from "sonner";
import { useAppStore } from "../../stores/appStore";
import type { PresetProfile } from "../../types/presets";

const iconMap: Record<string, React.ElementType> = {
  Zap,
  Gamepad2,
  Code,
  Shield,
  Palette,
  Briefcase,
};

export function PresetSelector() {
  const [presets, setPresets] = useState<PresetProfile[]>([]);
  const [confirmPreset, setConfirmPreset] = useState<string | null>(null);
  const { selectedIds, catalog } = useAppStore();

  useEffect(() => {
    api.getPresets()
      .then(setPresets)
      .catch(() => {});
  }, []);

  const applyPreset = (preset: PresetProfile) => {
    // If apps are already selected, confirm replacement
    if (selectedIds.size > 0 && confirmPreset !== preset.id) {
      setConfirmPreset(preset.id);
      return;
    }

    const catalogIds = new Set(catalog.map((a) => a.id));
    const validIds = preset.appIds.filter((id) => catalogIds.has(id));
    useAppStore.setState({ selectedIds: new Set(validIds) });
    toast.success(`Applied ${preset.name} preset — ${validIds.length} apps selected`);
    setConfirmPreset(null);
  };

  if (presets.length === 0) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
        Quick Start — Pick a Preset
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {presets.map((preset) => {
          const Icon = iconMap[preset.icon] ?? Zap;
          const isConfirming = confirmPreset === preset.id;
          const catalogIds = new Set(catalog.map((a) => a.id));
          const validCount = preset.appIds.filter((id) => catalogIds.has(id)).length;

          return (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="shrink-0 w-52 text-left px-4 py-3 rounded-lg border border-border bg-bg-card hover:bg-bg-card-hover hover:border-border-hover transition-all duration-200 group"
              style={{ borderLeftColor: preset.color, borderLeftWidth: "3px" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 shrink-0" style={{ color: preset.color }} />
                <span className="text-sm font-semibold text-text-primary truncate">
                  {preset.name}
                </span>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: preset.color + "20", color: preset.color }}
                >
                  {validCount}
                </span>
              </div>
              {isConfirming ? (
                <p className="text-[11px] text-warning leading-tight">
                  Click again to replace current selection
                </p>
              ) : (
                <p className="text-[11px] text-text-muted leading-tight truncate">
                  {preset.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
