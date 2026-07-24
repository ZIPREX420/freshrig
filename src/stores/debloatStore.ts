import { create } from "zustand";
import { api } from "../lib";
import { listen } from "@tauri-apps/api/event";
import type { DebloatTweak, DebloatResult, TweakTier, TweakCategory } from "../types/debloat";

interface DebloatState {
  tweaks: DebloatTweak[];
  selectedIds: Set<string>;
  activeTier: TweakTier | "all";
  activeCategory: TweakCategory | "all";
  isApplying: boolean;
  restorePointCreated: boolean;
  results: DebloatResult[];
  loading: boolean;
  lastApplyResults: DebloatResult[] | null;
  lastApplyTimestamp: string | null;
  fetchTweaks: () => Promise<void>;
  toggleTweak: (id: string) => void;
  selectAllInTier: (tier: TweakTier) => void;
  clearSelection: () => void;
  createRestorePoint: () => Promise<boolean>;
  applySelected: (dryRun: boolean) => Promise<DebloatResult[]>;
  setActiveTier: (tier: TweakTier | "all") => void;
  setActiveCategory: (cat: TweakCategory | "all") => void;
  clearLastResults: () => void;
}

let debloatListenerInitialized = false;

export const useDebloatStore = create<DebloatState>((set, get) => {
  if (!debloatListenerInitialized) {
    debloatListenerInitialized = true;
    listen<DebloatResult>("debloat-progress", (event) => {
      set((state) => ({
        results: [...state.results, event.payload],
      }));
    });
  }

  return {
    tweaks: [],
    selectedIds: new Set(),
    activeTier: "all",
    activeCategory: "all",
    isApplying: false,
    restorePointCreated: false,
    results: [],
    loading: false,
    lastApplyResults: null,
    lastApplyTimestamp: null,

    fetchTweaks: async () => {
      set({ loading: true });
      try {
        const tweaks = await api.getDebloatTweaks();
        set({ tweaks, loading: false });
      } catch {
        set({ loading: false });
      }
    },

    toggleTweak: (id: string) => {
      set((state) => {
        const newSet = new Set(state.selectedIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return { selectedIds: newSet };
      });
    },

    selectAllInTier: (tier: TweakTier) => {
      const { tweaks } = get();
      const filtered = tweaks.filter((t) => t.tier === tier && !t.isApplied);
      set({ selectedIds: new Set(filtered.map((t) => t.id)) });
    },

    clearSelection: () => {
      set({ selectedIds: new Set() });
    },

    createRestorePoint: async () => {
      try {
        await api.createRestorePoint();
        set({ restorePointCreated: true });
        return true;
      } catch {
        return false;
      }
    },

    applySelected: async (dryRun: boolean) => {
      const { selectedIds } = get();
      if (selectedIds.size === 0) return [];

      set({ isApplying: !dryRun, results: [] });
      try {
        const results = await api.applyDebloatTweaks({
          tweakIds: [...selectedIds],
          dryRun,
        });
        if (!dryRun) {
          // Refresh tweaks to get updated is_applied states
          get().fetchTweaks();
          set({
            lastApplyResults: results,
            lastApplyTimestamp: new Date().toLocaleString(),
          });
        }
        set({ isApplying: false });
        return results;
      } catch {
        set({ isApplying: false });
        return [];
      }
    },

    setActiveTier: (tier: TweakTier | "all") => {
      set({ activeTier: tier });
    },

    setActiveCategory: (cat: TweakCategory | "all") => {
      set({ activeCategory: cat });
    },

    clearLastResults: () => {
      set({ lastApplyResults: null, lastApplyTimestamp: null });
    },
  };
});
