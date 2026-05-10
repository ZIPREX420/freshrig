import { create } from "zustand";
import { load, Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import type { AppCategory } from "../types/apps";
import type { Locale } from "../i18n";

export type AccentColor = "teal" | "blue" | "purple" | "orange" | "rose" | "green";
export const ACCENT_COLORS: AccentColor[] = [
  "teal",
  "blue",
  "purple",
  "orange",
  "rose",
  "green",
];

const FOUC_STORAGE_KEY = "freshrig-settings";

function isAccentColor(value: unknown): value is AccentColor {
  return typeof value === "string" && (ACCENT_COLORS as string[]).includes(value);
}

export interface AppSettings {
  // General
  defaultInstallBehavior: "silent" | "interactive";
  showHardwareInProfiles: boolean;
  checkForUpdates: boolean;
  // App Catalog
  defaultCategory: AppCategory | "all";
  showRuntimes: boolean;
  confirmBeforeInstalling: boolean;
  // Appearance
  accentColor: AccentColor;
  // System Tray
  minimizeToTray: boolean;
  startMinimized: boolean;
  // Updates
  lastSeenVersion: string;
  // Onboarding
  hasCompletedOnboarding: boolean;
  /** v2.4: tracks whether the first-launch SplashScreen has been dismissed.
   *  Splash shows once per fresh install; subsequent launches go straight
   *  to the OnboardingWizard or Dashboard depending on hasCompletedOnboarding. */
  hasSeenSplash: boolean;
  /** v2.4: UI language. en = English (default), nl = Nederlands. */
  locale: Locale;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultInstallBehavior: "silent",
  showHardwareInProfiles: true,
  checkForUpdates: true,
  defaultCategory: "all",
  showRuntimes: true,
  confirmBeforeInstalling: true,
  accentColor: "teal",
  minimizeToTray: true,
  startMinimized: false,
  lastSeenVersion: "0.3.0",
  hasCompletedOnboarding: false,
  hasSeenSplash: false,
  locale: "en",
};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  store: Store | null;
  isPortable: boolean;
  loadSettings: () => Promise<void>;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  setAccentColor: (color: AccentColor) => Promise<void>;
  resetSettings: () => Promise<void>;
}

function applyAccent(color: AccentColor) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.accent = color;
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(FOUC_STORAGE_KEY, JSON.stringify({ state: { accentColor: color } }));
    }
  } catch {
    /* localStorage unavailable in some sandbox contexts — ignore */
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
  store: null,
  isPortable: false,

  loadSettings: async () => {
    if (!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__) {
      applyAccent(DEFAULT_SETTINGS.accentColor);
      set({ loaded: true });
      return;
    }
    try {
      const portable = await invoke<boolean>("check_portable_mode").catch(() => false);
      const store = await load("settings.json", { autoSave: true, defaults: {} });
      const saved: Partial<AppSettings> = {};
      for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
        const val = await store.get(key);
        if (val !== null && val !== undefined) {
          (saved as Record<string, unknown>)[key] = val;
        }
      }
      if (saved.accentColor !== undefined && !isAccentColor(saved.accentColor)) {
        delete saved.accentColor;
      }
      const merged = { ...DEFAULT_SETTINGS, ...saved };
      applyAccent(merged.accentColor);
      set({ settings: merged, loaded: true, store, isPortable: portable });
    } catch {
      applyAccent(DEFAULT_SETTINGS.accentColor);
      set({ loaded: true });
    }
  },

  setSetting: async (key, value) => {
    const { store, setAccentColor } = get();
    if (key === "accentColor") {
      await setAccentColor(value as AccentColor);
      return;
    }
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));
    if (store) {
      await store.set(key, value);
    }
  },

  setAccentColor: async (color) => {
    const { store } = get();
    applyAccent(color);
    set((state) => ({
      settings: { ...state.settings, accentColor: color },
    }));
    if (store) {
      await store.set("accentColor", color);
    }
  },

  resetSettings: async () => {
    const { store } = get();
    if (store) {
      await store.clear();
    }
    applyAccent(DEFAULT_SETTINGS.accentColor);
    set({ settings: { ...DEFAULT_SETTINGS } });
  },
}));
