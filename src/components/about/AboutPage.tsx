// Copyright (c) 2026 Seppe Willemsens (ZIPREX420). MIT License.
import { useState } from "react";
import {
  Globe,
  GitBranch,
  Bug,
  Heart,
  Copy,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { openUrl } from "@tauri-apps/plugin-opener";
import { APP_NAME, APP_TAGLINE, APP_VERSION, BUILD_FINGERPRINT } from "../../config/app";
import { useSettingsStore } from "../../stores/settingsStore";
import { BrandMark, BrandWordmark } from "../ui/BrandMark";

// Authoritative outbound links. Discord and the freshrig.app domain are
// intentionally absent until they're actually live — exposing dead links on
// the About page is worse than not advertising the channel.
const LINKS = [
  { icon: Globe,     label: "Website",      url: "https://ZIPREX420.github.io/freshrig/" },
  { icon: GitBranch, label: "Source",       url: "https://github.com/ZIPREX420/freshrig" },
  { icon: Bug,       label: "Report a bug", url: "https://github.com/ZIPREX420/freshrig/issues" },
  { icon: Heart,     label: "Sponsor",      url: "https://github.com/sponsors/ZIPREX420" },
];

export function AboutPage() {
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const isPortable = useSettingsStore((s) => s.isPortable);

  const systemInfo = [
    { label: "App version", value: APP_VERSION },
    { label: "Build",       value: BUILD_FINGERPRINT },
    { label: "Mode",        value: isPortable ? "Portable" : "Installed" },
    { label: "Platform",    value: navigator.platform },
  ];

  const handleCopySystemInfo = () => {
    const text = systemInfo.map((i) => `${i.label}: ${i.value}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("System info copied to clipboard");
  };

  const handleLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      toast.error("Failed to open link");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] py-12 animate-fade-in">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Brand mark + wordmark — the same identity used everywhere else */}
        <div className="flex flex-col items-center">
          <BrandMark size={96} idSuffix="-about" />
          <BrandWordmark className="mt-5 text-[24px]" />
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-text-muted">
            {APP_TAGLINE}
          </p>
          <p className="mt-3 text-[11px] text-text-muted font-mono">v{APP_VERSION}</p>
        </div>

        {/* Made in Belgium */}
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
          Made in Belgium
        </p>

        {/* Links */}
        <div className="grid grid-cols-2 gap-2">
          {LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => handleLink(link.url)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-bg-card border border-border text-sm text-text-secondary hover:text-text-primary hover:border-[var(--accent-cyan-rim)] transition-colors"
            >
              <link.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{link.label}</span>
              <ExternalLink className="w-3 h-3 text-text-muted" />
            </button>
          ))}
        </div>

        {/* Credits */}
        <div className="space-y-1.5 text-xs text-text-muted">
          <p>Built with Rust, Tauri, and React.</p>
          <p>Icons by Lucide.</p>
        </div>

        {/* License */}
        <div className="px-4 py-3 rounded-md bg-bg-card border border-border text-xs text-text-secondary space-y-1">
          <p>{APP_NAME} core is open source under the MIT license.</p>
          <p className="text-text-muted">
            Pro features unlock from $5.99 / month (or $49 / year). 7-day free
            trial — no credit card required.
          </p>
        </div>

        {/* System Info (collapsible) */}
        <div className="bg-bg-card border border-border rounded-md overflow-hidden">
          <button
            onClick={() => setShowSystemInfo(!showSystemInfo)}
            className="flex items-center justify-between w-full px-4 py-3 text-xs uppercase tracking-[0.14em] text-text-secondary hover:text-text-primary transition-colors"
          >
            <span>System info</span>
            {showSystemInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showSystemInfo && (
            <div className="px-4 pb-3 space-y-2 animate-fade-in">
              {systemInfo.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">{item.label}</span>
                  <span className="text-text-secondary font-mono truncate max-w-[240px]">{item.value}</span>
                </div>
              ))}
              <button
                onClick={handleCopySystemInfo}
                className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text-primary hover:border-[var(--accent-cyan-rim)] border border-border transition-colors mx-auto"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
