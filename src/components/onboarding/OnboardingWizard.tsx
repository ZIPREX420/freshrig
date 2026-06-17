import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor,
  Cpu,
  Package,
  Sparkles,
  ArrowRight,
  Loader2,
  BookMarked,
  Zap,
  Gamepad2,
  Code,
  Shield,
  Palette,
  Briefcase,
} from "lucide-react";
import { api } from "../../lib";
import { toast } from "sonner";
import { APP_NAME, APP_TAGLINE } from "../../config/app";
import { useAppStore } from "../../stores/appStore";
import type { PresetProfile } from "../../types/presets";

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface HardwareSummaryBrief {
  cpu: { name: string };
  gpus: { name: string }[];
  system: { totalRamGb: number; osVersion: string };
}

const presetIcons: Record<string, React.ElementType> = {
  Zap,
  Gamepad2,
  Code,
  Shield,
  Palette,
  Briefcase,
};

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [hardware, setHardware] = useState<HardwareSummaryBrief | null>(null);
  const [hwLoading, setHwLoading] = useState(false);
  const [presets, setPresets] = useState<PresetProfile[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const { catalog } = useAppStore();

  // Fetch hardware on step 1
  useEffect(() => {
    if (step === 1 && !hardware) {
      setHwLoading(true);
      api.getHardwareSummary()
        .then(setHardware)
        .catch(() => {})
        .finally(() => setHwLoading(false));
    }
  }, [step, hardware]);

  // Fetch presets on step 2
  useEffect(() => {
    if (step === 2 && presets.length === 0) {
      api.getPresets()
        .then(setPresets)
        .catch(() => {});
    }
  }, [step, presets.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete();
      if (e.key === "Enter") {
        if (step < 3) goNext();
        else handleFinish();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const goNext = () => {
    if (step < 3) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const handleFinish = () => {
    if (selectedPreset) {
      const preset = presets.find((p) => p.id === selectedPreset);
      if (preset) {
        const catalogIds = new Set(catalog.map((a) => a.id));
        const validIds = preset.appIds.filter((id) => catalogIds.has(id));
        useAppStore.setState({ selectedIds: new Set(validIds) });
        toast.success(`Applied ${preset.name} preset — ${validIds.length} apps selected`);
      }
    }
    onComplete();
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-heading"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-bg-elevated border border-border rounded-xl shadow-elevated w-full max-w-xl mx-4 overflow-hidden">
        {/* Step dots */}
        <div
          role="group"
          aria-label={`Setup step ${step + 1} of 4`}
          className="flex justify-center gap-2 px-6 pt-5 pb-4"
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              aria-current={i === step ? "step" : undefined}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-accent" : i < step ? "bg-accent/40" : "bg-bg-tertiary"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 pb-4 min-h-[320px] relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {step === 0 && (
                <div className="flex flex-col items-center text-center py-6">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-muted mb-6">
                    <Monitor className="w-8 h-8 text-accent" />
                  </div>
                  <h2 id="onboarding-heading" className="text-2xl font-bold text-text-primary mb-2">{APP_NAME}</h2>
                  <p className="text-sm text-accent mb-4">{APP_TAGLINE}</p>
                  <p className="text-sm text-text-secondary max-w-sm">
                    Hardware scan, driver recommendations, and batch app install — your whole setup
                    sorted in one session.
                  </p>
                </div>
              )}

              {step === 1 && (
                <div className="py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu className="w-5 h-5 text-accent" />
                    <h2 className="text-lg font-semibold text-text-primary">Your Hardware</h2>
                  </div>
                  {hwLoading ? (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <Loader2 className="w-8 h-8 text-accent animate-spin" />
                      <p className="text-sm text-text-muted">Scanning hardware...</p>
                    </div>
                  ) : hardware ? (
                    <div className="space-y-3">
                      <div className="bg-bg-card border border-border rounded-lg p-4 space-y-2.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-text-muted">CPU</span>
                          <span className="text-text-primary font-medium truncate ml-4">
                            {hardware.cpu.name}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-text-muted">GPU</span>
                          <span className="text-text-primary font-medium truncate ml-4">
                            {hardware.gpus[0]?.name ?? "Unknown"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-text-muted">RAM</span>
                          <span className="text-text-primary font-medium">
                            {hardware.system.totalRamGb} GB
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-text-muted">OS</span>
                          <span className="text-text-primary font-medium">
                            {hardware.system.osVersion}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-text-muted text-center">
                        Hardware detected — driver recommendations are ready on the next page.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted text-center py-10">
                      Hardware scan unavailable. No worries — all features still work.
                    </p>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-5 h-5 text-accent" />
                    <h2 className="text-lg font-semibold text-text-primary">
                      Choose a Starting Point
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((preset) => {
                      const Icon = presetIcons[preset.icon] ?? Zap;
                      const isSelected = selectedPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => setSelectedPreset(preset.id)}
                          className={`text-left px-3 py-3 rounded-lg border transition-all ${
                            isSelected
                              ? "border-accent bg-accent-muted"
                              : "border-border bg-bg-card hover:bg-bg-card-hover hover:border-border-hover"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="w-4 h-4" style={{ color: preset.color }} />
                            <span className="text-sm font-semibold text-text-primary">
                              {preset.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted leading-tight truncate">
                            {preset.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPreset(null);
                      goNext();
                    }}
                    className="w-full mt-3 text-xs text-text-muted hover:text-accent text-center transition-colors"
                  >
                    Or start from scratch
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col items-center text-center py-6">
                  <Sparkles className="w-10 h-10 text-accent mb-4" />
                  <h2 className="text-xl font-bold text-text-primary mb-4">You're ready to go.</h2>
                  <div className="grid grid-cols-3 gap-3 w-full mb-4">
                    <div className="bg-bg-card border border-border rounded-lg p-3 text-center">
                      <Package className="w-5 h-5 text-accent mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-text-primary">Install Apps</p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {selectedPreset
                          ? `${presets.find((p) => p.id === selectedPreset)?.appIds.length ?? 0} selected`
                          : "60+ available"}
                      </p>
                    </div>
                    <div className="bg-bg-card border border-border rounded-lg p-3 text-center">
                      <BookMarked className="w-5 h-5 text-accent mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-text-primary">Save Profiles</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Share your setup</p>
                    </div>
                    <div className="bg-bg-card border border-border rounded-lg p-3 text-center">
                      <Sparkles className="w-5 h-5 text-accent mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-text-primary">Optimize</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Remove bloat</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onComplete}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Skip setup
            </button>
            {step > 0 && (
              <button
                onClick={goBack}
                className="text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <button
            onClick={step === 3 ? handleFinish : goNext}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-accent text-bg-primary hover:bg-accent-hover transition-colors"
          >
            {step === 0 ? "Get Started" : step === 3 ? "Finish Setup" : "Next"}
            {step < 3 && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
