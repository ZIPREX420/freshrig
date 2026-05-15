// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useCallback, useState } from "react";
import { Zap, X } from "lucide-react";
import { HexIcon } from "../ui/HexIcon";
import { HeroCTA } from "../ui/HeroCTA";
import { HexStepper } from "../ui/HexStepper";
import type { HexStep } from "../ui/HexStepper";
import { ProgressRing } from "../ui/ProgressRing";
import { PageBreadcrumb } from "../ui/PageBreadcrumb";
import { Button } from "../ui/Button";
import { Cpu, Shield, Package, Settings, Lock, Boxes } from "lucide-react";
import { CircuitBackdrop } from "../ui/CircuitBackdrop";

interface SnelsetupPageProps {
  /** Optional navigate handler — wired to App.tsx so the back arrow on the
   *  intro screen returns to Home / Dashboard. */
  onNavigate?: (view: string) => void;
}

type Phase = "intro" | "running" | "done";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const CHECKLIST: ChecklistItem[] = [
  {
    id: "drivers",
    label: "Drivers (Chipset, GPU, Audio, ...)",
    description: "Latest stable drivers from each vendor",
    icon: <Cpu className="w-4 h-4" />,
  },
  {
    id: "privacy",
    label: "Privacy & Telemetry",
    description: "Lock down telemetry, ads, app permissions",
    icon: <Lock className="w-4 h-4" />,
  },
  {
    id: "essentials",
    label: "Essential Software",
    description: "Browsers, codecs, runtimes, archive tools",
    icon: <Package className="w-4 h-4" />,
  },
  {
    id: "tuning",
    label: "System Tuning",
    description: "Power plan, visual effects, services",
    icon: <Settings className="w-4 h-4" />,
  },
  {
    id: "windows",
    label: "Windows Optimisations",
    description: "Disable bloat, surface useful settings",
    icon: <Boxes className="w-4 h-4" />,
  },
  {
    id: "security",
    label: "Security & Updates",
    description: "Firewall, Defender preset, pending updates",
    icon: <Shield className="w-4 h-4" />,
  },
];

const SCAN_STEPS: HexStep[] = [
  { id: "scan", label: "Scan" },
  { id: "select", label: "Select" },
  { id: "settings", label: "Settings" },
  { id: "install", label: "Install" },
  { id: "finish", label: "Finish" },
];

interface ScanItem {
  id: string;
  label: string;
  status: "pending" | "running" | "done";
}

const INITIAL_SCAN_ITEMS: ScanItem[] = [
  { id: "hw", label: "Hardware detection", status: "pending" },
  { id: "os", label: "Operating system", status: "pending" },
  { id: "drv", label: "Drivers", status: "pending" },
  { id: "apps", label: "Installed software", status: "pending" },
  { id: "settings", label: "System settings", status: "pending" },
  { id: "net", label: "Network & services", status: "pending" },
];

/**
 * Quick Setup hub page (mockup-1 bottom-left + mockup-2 bottom-left).
 *
 * Two phases:
 *   1. `intro` — hex hero + included-features list + "Start" CTA
 *   2. `running` — hex stepper at top, big progress ring + scan list
 *
 * Glues to existing functionality (drivers / debloat / apps / privacy)
 * once the user clicks Start. For now the running state is wired to a
 * mock animation so the visual flow can be validated end-to-end before
 * the real backend orchestration lands.
 */
export function SnelsetupPage({ onNavigate }: SnelsetupPageProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentStep, setCurrentStep] = useState(0);
  const [scanItems, setScanItems] = useState(INITIAL_SCAN_ITEMS);
  const [progress, setProgress] = useState(0);

  const start = useCallback(() => {
    setPhase("running");
    setCurrentStep(0);
    setProgress(0);
    setScanItems(INITIAL_SCAN_ITEMS);

    // Mock scan progression — replace with real backend orchestration.
    // Each item takes ~600ms; ring fills smoothly across the whole sequence.
    let i = 0;
    const total = INITIAL_SCAN_ITEMS.length;
    const tick = () => {
      if (i >= total) {
        setProgress(100);
        return;
      }
      setScanItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "running" } : item,
        ),
      );
      setProgress(Math.round(((i + 0.5) / total) * 100));
      window.setTimeout(() => {
        setScanItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "done" } : item,
          ),
        );
        setProgress(Math.round(((i + 1) / total) * 100));
        i++;
        if (i < total) window.setTimeout(tick, 200);
      }, 600);
    };
    window.setTimeout(tick, 300);
  }, []);

  const cancel = useCallback(() => {
    setPhase("intro");
    setScanItems(INITIAL_SCAN_ITEMS);
    setProgress(0);
    setCurrentStep(0);
  }, []);

  if (phase === "running") {
    return (
      <div className="max-w-5xl mx-auto">
        <PageBreadcrumb
          current="Quick setup"
          onBack={() => onNavigate?.("dashboard")}
          rightSlot={
            <HexIcon size="sm" accent="cyan" idSuffix="snelsetup-pin">
              <Zap className="w-3.5 h-3.5" />
            </HexIcon>
          }
        />

        <h1 className="text-display font-semibold mb-2 text-text-primary">
          Quick Setup
        </h1>
        <p className="text-text-secondary text-body mb-10">
          Full installation. Automatic.
        </p>

        <div className="mb-10">
          <HexStepper steps={SCAN_STEPS} current={currentStep} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Big progress ring — dominant visual during scanning phase */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <ProgressRing
                value={progress}
                size="xl"
                accent="cyan"
                indeterminate={progress < 100}
                label={
                  progress < 100 ? (
                    <span className="flex flex-col items-center">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-text-muted font-semibold mb-1">
                        {progress < 100 ? "Scanning…" : "Done"}
                      </span>
                      <span className="text-[44px] leading-none font-semibold" style={{ color: "var(--accent-cyan)" }}>
                        {Math.round(progress)}
                      </span>
                      <span className="text-[13px] text-text-muted mt-0.5">%</span>
                    </span>
                  ) : (
                    <span className="text-[13px] uppercase tracking-wider" style={{ color: "var(--success)" }}>
                      Complete
                    </span>
                  )
                }
              />
            </div>
            <p className="text-text-muted text-[12px] text-center max-w-[260px] leading-relaxed">
              {progress < 100
                ? "Analysing your system to choose the right defaults."
                : "Scan complete — ready for the next step."}
            </p>
          </div>

          {/* Scan checklist — matches mockup's VOLTOOID / SCANNEN / WACHTEN badges */}
          <ul className="space-y-2">
            {scanItems.map((item) => (
              <li
                key={item.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-md border transition-colors ${
                  item.status === "done"
                    ? "bg-[var(--success-soft)] border-[var(--success-rim)]"
                    : item.status === "running"
                    ? "bg-[var(--accent-cyan-soft)] border-[var(--accent-cyan-rim)]"
                    : "bg-bg-card border-border"
                }`}
              >
                {/* Status icon dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  item.status === "done"
                    ? "bg-[var(--success)]"
                    : item.status === "running"
                    ? "bg-[var(--accent-cyan)] animate-pulse"
                    : "bg-[var(--text-muted)]"
                }`} />
                <span className="flex-1 text-text-primary text-[13px] truncate">
                  {item.label}
                </span>
                {item.status === "done" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.1em] bg-[var(--success-soft)] text-[var(--success)]">
                    ✓ Complete
                  </span>
                )}
                {item.status === "running" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent-cyan)]" style={{ background: "var(--accent-cyan-soft)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-pulse" />
                    Scanning…
                  </span>
                )}
                {item.status === "pending" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted bg-white/[0.03]">
                    Waiting
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end mt-10">
          <Button variant="secondary" size="md" onClick={cancel}>
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Intro phase — hex hero + checklist + start CTA
  return (
    <div className="max-w-4xl mx-auto">
      <PageBreadcrumb
        current="Quick setup"
        onBack={() => onNavigate?.("dashboard")}
        rightSlot={
          <HexIcon size="sm" accent="cyan" idSuffix="snelsetup-pin">
            <Zap className="w-3.5 h-3.5" />
          </HexIcon>
        }
      />

      {/* Atmospheric hero — circuit rain + city skyline behind the hex centerpiece */}
      <div className="relative flex flex-col items-center text-center mb-12 rounded-xl overflow-hidden py-12 px-6"
           style={{ background: "linear-gradient(180deg, rgba(0,229,255,0.04) 0%, transparent 60%)" }}>
        <CircuitBackdrop accent="cyan" density="normal" showCityscape />
        {/* Subtle vignette so the backdrop doesn't fight the content */}
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: "radial-gradient(ellipse 70% 60% at 50% 40%, transparent 40%, var(--bg-base) 100%)" }} />
        <div className="relative z-10 flex flex-col items-center">
          <HexIcon size="hero" accent="cyan" pulse perspectiveFloor idSuffix="snelsetup-hero">
            <Zap className="w-16 h-16" strokeWidth={2.5} />
          </HexIcon>
          <h1 className="mt-8 text-[40px] font-semibold uppercase tracking-[0.14em] text-gradient-neon leading-tight">
            Quick Setup
          </h1>
          <p className="mt-4 text-text-primary text-[15px] max-w-md">
            Full installation. Automatic.
          </p>
          <p className="mt-3 text-text-secondary text-body max-w-xl">
            Let FreshRig optimise your PC automatically with the best drivers,
            essential software, and tuned settings — based on your hardware.
          </p>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-4">
          What's included
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHECKLIST.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 rounded-md bg-bg-card border border-border hover:border-[var(--accent-cyan-rim)] transition-colors"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--accent-cyan-soft)] text-[var(--accent-cyan)] shrink-0">
                {item.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium text-text-primary truncate">
                  {item.label}
                </span>
                <span className="block text-[11px] text-text-muted truncate">
                  {item.description}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="w-5 h-5 rounded-full bg-[var(--accent-cyan-soft)] text-[var(--accent-cyan)] flex items-center justify-center text-[12px] shrink-0"
              >
                ✓
              </span>
            </li>
          ))}
        </ul>
      </div>

      <HeroCTA accent="cyan" onClick={start}>
        Start Quick Setup
      </HeroCTA>
    </div>
  );
}

export default SnelsetupPage;
