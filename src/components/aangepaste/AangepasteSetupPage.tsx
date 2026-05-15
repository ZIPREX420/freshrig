// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useCallback, useMemo, useState } from "react";
import {
  Cpu,
  Package,
  Sparkles,
  Shield,
  Settings,
  Boxes,
  Layers,
  Search,
  ChevronRight,
} from "lucide-react";
import { HexIcon } from "../ui/HexIcon";
import { CircuitBackdrop } from "../ui/CircuitBackdrop";
import { HeroCTA } from "../ui/HeroCTA";
import { HexStepper } from "../ui/HexStepper";
import type { HexStep } from "../ui/HexStepper";
import { PageBreadcrumb } from "../ui/PageBreadcrumb";
import { Button } from "../ui/Button";

interface AangepasteSetupPageProps {
  onNavigate?: (view: string) => void;
}

type Phase = "intro" | "wizard";

interface CategoryDef {
  id: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  /** Hex thumbnail tint for this category in the picker grid. */
  accent: "cyan" | "magenta";
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "drivers",
    label: "Drivers",
    count: 12,
    icon: <Cpu className="w-5 h-5" />,
    accent: "cyan",
  },
  {
    id: "software",
    label: "Software",
    count: 36,
    icon: <Package className="w-5 h-5" />,
    accent: "cyan",
  },
  {
    id: "windows",
    label: "Windows settings",
    count: 18,
    icon: <Boxes className="w-5 h-5" />,
    accent: "cyan",
  },
  {
    id: "optimisations",
    label: "Optimisations",
    count: 24,
    icon: <Sparkles className="w-5 h-5" />,
    accent: "magenta",
  },
  {
    id: "security",
    label: "Security & Privacy",
    count: 14,
    icon: <Shield className="w-5 h-5" />,
    accent: "magenta",
  },
  {
    id: "tuning",
    label: "System tuning",
    count: 22,
    icon: <Settings className="w-5 h-5" />,
    accent: "magenta",
  },
];

const WIZARD_STEPS: HexStep[] = [
  { id: "categories", label: "Categories" },
  { id: "select", label: "Select" },
  { id: "settings", label: "Settings" },
  { id: "review", label: "Review" },
  { id: "install", label: "Install" },
];

interface SoftwareItem {
  id: string;
  name: string;
  description: string;
  selected: boolean;
}

const SAMPLE_ITEMS: Record<string, SoftwareItem[]> = {
  software: [
    {
      id: "chrome",
      name: "Google Chrome",
      description: "Fast, secure, ubiquitous browser.",
      selected: true,
    },
    {
      id: "7zip",
      name: "7-Zip",
      description: "File archiver + compression tool.",
      selected: true,
    },
    {
      id: "vcredist",
      name: "Visual C++ Redistributables",
      description: "Required by many apps and games.",
      selected: true,
    },
    {
      id: "dotnet",
      name: ".NET Desktop Runtime",
      description: "Required by .NET-based applications.",
      selected: false,
    },
    {
      id: "notepadpp",
      name: "Notepad++",
      description: "Powerful text editor.",
      selected: false,
    },
    {
      id: "obs",
      name: "OBS Studio",
      description: "Recording + streaming in high quality.",
      selected: true,
    },
  ],
};

/**
 * Custom Setup hub page (mockup-1 bottom-right + mockup-2 bottom-right).
 *
 * Two phases:
 *   1. `intro` — magenta hex hero + category grid + "Start" CTA
 *   2. `wizard` — 5-step hex stepper + 3-column layout (categories | items |
 *      selection summary)
 *
 * For the MVP the items panel uses sample data for the "software" category.
 * Real wiring will pull from the existing app catalog / driver / debloat
 * stores once the visual flow is signed off.
 */
export function AangepasteSetupPage({ onNavigate }: AangepasteSetupPageProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentStep, setCurrentStep] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>("software");
  const [items, setItems] = useState<SoftwareItem[]>(SAMPLE_ITEMS.software);
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    );
  }, [items, search]);

  const selectedCount = items.filter((i) => i.selected).length;

  const toggleItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i)),
    );
  }, []);

  const startWizard = useCallback(() => {
    setPhase("wizard");
    setCurrentStep(1); // jump to "Select" — categories already chosen via the grid
  }, []);

  if (phase === "wizard") {
    return (
      <div className="max-w-7xl mx-auto">
        <PageBreadcrumb
          current="Custom setup"
          onBack={() => setPhase("intro")}
          rightSlot={
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search software…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-bg-card border border-border rounded-md pl-9 pr-3 py-1.5 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[var(--accent-cyan-rim)] w-64"
              />
            </div>
          }
        />

        <h1 className="text-display font-semibold mb-2 text-text-primary">
          Custom Setup
        </h1>
        <p className="text-text-secondary text-body mb-8">
          Choose what gets installed and how your PC is configured.
        </p>

        <div className="mb-10">
          <HexStepper
            steps={WIZARD_STEPS}
            current={currentStep}
            onStepClick={(_, idx) => setCurrentStep(idx)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-4">
          {/* LEFT: category list */}
          <aside className="space-y-1">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted px-3 pb-2">
              Categories
            </h2>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                  activeCategory === cat.id
                    ? "bg-[var(--accent-magenta-soft)] text-text-primary"
                    : "text-text-secondary hover:bg-white/[0.03] hover:text-text-primary"
                }`}
              >
                <HexIcon
                  size="sm"
                  accent={activeCategory === cat.id ? cat.accent : "cyan"}
                  idSuffix={`wiz-cat-${cat.id}`}
                  className={activeCategory === cat.id ? "" : "opacity-40"}
                >
                  {cat.icon}
                </HexIcon>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium truncate">
                    {cat.label}
                  </span>
                  <span className="block text-[10.5px] text-text-muted">
                    {cat.count} available
                  </span>
                </span>
                {activeCategory === cat.id && (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--accent-magenta)]" />
                )}
              </button>
            ))}
          </aside>

          {/* MIDDLE: items in active category */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted mb-3">
              {CATEGORIES.find((c) => c.id === activeCategory)?.label ?? "Items"}
            </h2>
            <ul className="space-y-2">
              {filteredItems.length === 0 && (
                <li className="text-text-muted text-[13px] px-4 py-6 text-center bg-bg-card border border-border rounded-md">
                  No matches in this category.
                </li>
              )}
              {filteredItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md border transition-colors cursor-pointer ${
                    item.selected
                      ? "bg-[var(--accent-cyan-soft)] border-[var(--accent-cyan-rim)]"
                      : "bg-bg-card border-border hover:border-border-hover"
                  }`}
                  onClick={() => toggleItem(item.id)}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-text-primary truncate">
                      {item.name}
                    </span>
                    <span className="block text-[11px] text-text-muted truncate">
                      {item.description}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleItem(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border border-border accent-[var(--accent-cyan)]"
                  />
                </li>
              ))}
            </ul>
          </section>

          {/* RIGHT: selection summary */}
          <aside className="self-start sticky top-2">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted mb-3">
              Selection summary
            </h2>
            <div className="bg-bg-card border border-border rounded-md p-4 space-y-3">
              <SummaryRow label="Software" count={`${selectedCount} items`} />
              <SummaryRow label="Drivers" count="9 items" />
              <SummaryRow label="Windows settings" count="13 items" />
              <div className="border-t border-border pt-3 mt-3 space-y-2">
                <SummaryRow
                  label="Total selected"
                  count={`${selectedCount + 22} items`}
                  emphasis
                />
                <SummaryRow label="Disk space needed" count="4.2 GB" />
                <SummaryRow label="Estimated time" count="8–12 min" />
              </div>
            </div>
          </aside>
        </div>

        <div className="flex justify-between mt-10">
          <Button variant="secondary" size="md" onClick={() => setPhase("intro")}>
            Back
          </Button>
          <HeroCTA
            accent="magenta"
            fullWidth={false}
            onClick={() => setCurrentStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))}
          >
            Next: Settings
          </HeroCTA>
        </div>
      </div>
    );
  }

  // Intro phase — magenta hex hero + category grid
  return (
    <div className="max-w-4xl mx-auto">
      <PageBreadcrumb
        current="Custom setup"
        onBack={() => onNavigate?.("dashboard")}
        rightSlot={
          <HexIcon size="sm" accent="magenta" idSuffix="aangepaste-pin">
            <Layers className="w-3.5 h-3.5" />
          </HexIcon>
        }
      />

      {/* Atmospheric hero — magenta-tinted circuit backdrop */}
      <div className="relative flex flex-col items-center text-center mb-12 rounded-xl overflow-hidden py-12 px-6"
           style={{ background: "linear-gradient(180deg, rgba(255,43,214,0.04) 0%, transparent 60%)" }}>
        <CircuitBackdrop accent="magenta" density="normal" showCityscape />
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: "radial-gradient(ellipse 70% 60% at 50% 40%, transparent 40%, var(--bg-base) 100%)" }} />
        <div className="relative z-10 flex flex-col items-center">
          <HexIcon
            size="hero"
            accent="magenta"
            pulse
            perspectiveFloor
            idSuffix="aangepaste-hero"
          >
            <Layers className="w-16 h-16" strokeWidth={2.5} />
          </HexIcon>
          <h1 className="mt-8 text-[40px] font-semibold uppercase tracking-[0.14em] text-gradient-neon leading-tight">
            Custom Setup
          </h1>
          <p className="mt-4 text-text-primary text-[15px] max-w-md">
            You decide. Full control.
          </p>
          <p className="mt-3 text-text-secondary text-body max-w-xl">
            Build your own configuration — choose exactly what gets installed,
            optimised, and configured. Down to the smallest detail.
          </p>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-4">
          Categories
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  startWizard();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-md bg-bg-card border border-border hover:border-[${cat.accent === "magenta" ? "var(--accent-magenta-rim)" : "var(--accent-cyan-rim)"}] hover:bg-bg-card-hover transition-colors text-left group`}
              >
                <HexIcon size="sm" accent={cat.accent} idSuffix={`cat-${cat.id}`}>
                  {cat.icon}
                </HexIcon>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium text-text-primary truncate">
                    {cat.label}
                  </span>
                  <span
                    className="block text-[11px] truncate"
                    style={{ color: cat.accent === "magenta" ? "var(--accent-magenta)" : "var(--accent-cyan)" }}
                  >
                    {cat.count} options
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <HeroCTA accent="magenta" onClick={startWizard}>
        Build Custom Setup
      </HeroCTA>
    </div>
  );
}

function SummaryRow({
  label,
  count,
  emphasis = false,
}: {
  label: string;
  count: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 ${
        emphasis ? "text-text-primary" : "text-text-secondary"
      }`}
    >
      <span className={`text-[12px] ${emphasis ? "font-semibold" : ""}`}>
        {label}
      </span>
      <span
        className={`text-[12px] font-mono tabular ${
          emphasis ? "text-[var(--accent-magenta)] font-semibold" : ""
        }`}
      >
        {count}
      </span>
    </div>
  );
}

export default AangepasteSetupPage;
