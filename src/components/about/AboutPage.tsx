import { useState } from "react";
import {
  Monitor,
  Globe,
  GitBranch,
  Bug,
  MessageCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { openUrl } from "@tauri-apps/plugin-opener";
import { APP_NAME, APP_TAGLINE, APP_VERSION, BUILD_FINGERPRINT } from "../../config/app";
import { useSettingsStore } from "../../stores/settingsStore";

const LINKS = [
  { icon: Globe, label: "Website", url: "https://freshrig.app" },
  { icon: GitBranch, label: "GitHub", url: "https://github.com/ZIPREX420/freshrig" },
  { icon: Bug, label: "Report a Bug", url: "https://github.com/ZIPREX420/freshrig/issues" },
  { icon: MessageCircle, label: "Discord", url: "https://discord.gg/freshrig" },
];

export function AboutPage() {
  const [showSystemInfo, setShowSystemInfo] = useState(false);
  const isPortable = useSettingsStore((s) => s.isPortable);

  const systemInfo = [
    { label: "App Version", value: APP_VERSION },
    { label: "Build", value: BUILD_FINGERPRINT },
    { label: "Mode", value: isPortable ? "Portable" : "Installed" },
    { label: "Framework", value: "Tauri v2" },
    { label: "OS", value: navigator.platform },
    { label: "User Agent", value: navigator.userAgent },
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
        {/* App icon */}
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-accent-muted">
            <Monitor className="w-10 h-10 text-accent" />
          </div>
        </div>

        {/* Name + tagline */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-text-primary">{APP_NAME}</h1>
          <p className="text-sm text-text-secondary">{APP_TAGLINE}</p>
          <p className="text-xs text-text-muted font-mono">v{APP_VERSION}</p>
        </div>

        {/* Made in Belgium */}
        <p className="text-sm text-text-muted">Made in Belgium 🇧🇪</p>

        {/* Links */}
        <div className="grid grid-cols-2 gap-2">
          {LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => handleLink(link.url)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-bg-card border border-border text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors"
            >
              <link.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{link.label}</span>
              <ExternalLink className="w-3 h-3 text-text-muted" />
            </button>
          ))}
        </div>

        {/* Credits */}
        <div className="space-y-1.5 text-xs text-text-muted">
          <p>Built with Tauri, React, and Rust</p>
          <p>Icons by Lucide</p>
        </div>

        {/* License */}
        <div className="px-4 py-3 rounded-lg bg-bg-card border border-border text-xs text-text-secondary space-y-1">
          <p>Core features are free and open source under the MIT license.</p>
          <p className="text-text-muted">Pro features unlock from $5.99/mo (or $49/yr) — 7-day free trial, no credit card required. Founder's Lifetime ($149 one-time, first 500 only) available during the v2.0 launch window.</p>
        </div>

        {/* System Info (collapsible) */}
        <div className="bg-bg-card border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowSystemInfo(!showSystemInfo)}
            className="flex items-center justify-between w-full px-4 py-3 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <span>System Info</span>
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
                className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-bg-tertiary border border-border transition-colors mx-auto"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy System Info
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
