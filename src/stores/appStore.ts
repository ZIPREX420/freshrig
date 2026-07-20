import { create } from "zustand";
import { api } from "../lib";
import { listen } from "@tauri-apps/api/event";
import type { AppEntry, AppCategory, InstallProgress } from "../types/apps";
import type { CustomAppEntry } from "../types/custom_apps";
import { invokeOrToast } from "../lib/invoke";

interface WingetSearchResult {
  name: string;
  id: string;
  version: string;
  source: string;
}

interface AppState {
  catalog: AppEntry[];
  selectedIds: Set<string>;
  installProgress: Map<string, InstallProgress>;
  isInstalling: boolean;
  wingetAvailable: boolean | null;
  searchQuery: string;
  activeCategory: AppCategory | "all";
  loading: boolean;
  // Winget search
  wingetResults: WingetSearchResult[];
  isSearchingWinget: boolean;
  // Installed detection
  installedAppIds: Set<string>;
  isCheckingInstalled: boolean;
  hideInstalled: boolean;
  // Custom apps
  customApps: CustomAppEntry[];
  customAppInstalling: string | null;
  diskSpaceGb: number | null;
  networkAvailable: boolean | null;
  // Actions
  fetchCatalog: () => Promise<void>;
  checkWinget: () => Promise<void>;
  toggleApp: (id: string) => void;
  selectAll: (category: AppCategory | "all") => void;
  clearSelection: () => void;
  installSelected: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (cat: AppCategory | "all") => void;
  searchWinget: (query: string) => Promise<void>;
  checkInstalledApps: () => Promise<void>;
  setHideInstalled: (hide: boolean) => void;
  fetchCustomApps: () => Promise<void>;
  addCustomApp: (app: CustomAppEntry) => Promise<void>;
  removeCustomApp: (id: string) => Promise<void>;
  installCustomApp: (app: CustomAppEntry) => Promise<void>;
  retryFailed: () => void;
  checkDiskSpace: () => Promise<number | null>;
  checkNetwork: () => Promise<boolean>;
  deselectCategory: (category: AppCategory | "all") => void;
}

let listenerInitialized = false;
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set, get) => {
  // Set up event listener once
  if (!listenerInitialized) {
    listenerInitialized = true;
    listen<InstallProgress>("install-progress", (event) => {
      const progress = event.payload;
      set((state) => {
        const newMap = new Map(state.installProgress);
        newMap.set(progress.appId, progress);
        const allDone = [...newMap.values()].every(
          (p) => p.status === "Completed" || p.status === "Failed" || p.status === "Skipped"
        );
        return {
          installProgress: newMap,
          isInstalling: !allDone,
        };
      });
    });
  }

  return {
    catalog: [],
    selectedIds: new Set(),
    installProgress: new Map(),
    isInstalling: false,
    wingetAvailable: null,
    searchQuery: "",
    activeCategory: "all",
    loading: false,
    wingetResults: [],
    isSearchingWinget: false,
    installedAppIds: new Set(),
    isCheckingInstalled: false,
    hideInstalled: false,
    customApps: [],
    customAppInstalling: null,
    diskSpaceGb: null,
    networkAvailable: null,

    fetchCatalog: async () => {
      set({ loading: true });
      const catalog = await invokeOrToast<AppEntry[]>("get_app_catalog", undefined, {
        errorTitle: "Could not load app catalog",
      });
      if (catalog) {
        set({ catalog, loading: false });
        // Auto-check installed apps after catalog loads
        get().checkInstalledApps();
      } else {
        set({ loading: false });
      }
    },

    checkWinget: async () => {
      try {
        const available = await api.checkWingetAvailable();
        set({ wingetAvailable: available });
      } catch {
        set({ wingetAvailable: false });
      }
    },

    toggleApp: (id: string) => {
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

    selectAll: (category: AppCategory | "all") => {
      const { catalog, selectedIds } = get();
      const filtered =
        category === "all" ? catalog : catalog.filter((a) => a.category === category);
      const newSet = new Set(selectedIds);
      for (const app of filtered) {
        newSet.add(app.id);
      }
      set({ selectedIds: newSet });
    },

    clearSelection: () => {
      set({ selectedIds: new Set() });
    },

    installSelected: async () => {
      const { selectedIds } = get();
      if (selectedIds.size === 0) return;

      const appIds = [...selectedIds];

      // Initialize progress as Pending for all
      const initialProgress = new Map<string, InstallProgress>();
      const { catalog } = get();
      for (const id of appIds) {
        const app = catalog.find((a) => a.id === id);
        initialProgress.set(id, {
          appId: id,
          appName: app?.name ?? id,
          status: "Pending",
          message: "Waiting...",
        });
      }

      set({ isInstalling: true, installProgress: initialProgress });

      try {
        await api.installApps({ appIds });
      } catch (err) {
        console.error("Install failed:", err);
        set({ isInstalling: false });
      }
    },

    setSearchQuery: (q: string) => {
      set({ searchQuery: q });

      // Debounced winget search
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      if (q.trim().length >= 2) {
        searchDebounceTimer = setTimeout(() => {
          get().searchWinget(q);
        }, 300);
      } else {
        set({ wingetResults: [], isSearchingWinget: false });
      }
    },

    setActiveCategory: (cat: AppCategory | "all") => {
      set({ activeCategory: cat });
    },

    searchWinget: async (query: string) => {
      if (query.trim().length < 2) {
        set({ wingetResults: [], isSearchingWinget: false });
        return;
      }
      set({ isSearchingWinget: true });
      // Search is incremental and noisy — don't toast errors. The empty state
      // is itself the user-visible signal.
      const results = await invokeOrToast<WingetSearchResult[]>(
        "search_winget_packages",
        { query },
        { silent: true },
      );
      set({
        wingetResults: results ?? [],
        isSearchingWinget: false,
      });
    },

    checkInstalledApps: async () => {
      const { catalog } = get();
      if (catalog.length === 0) return;

      set({ isCheckingInstalled: true });
      try {
        const wingetIds = catalog.map((a) => a.id);
        const catalogNames = catalog.map((a) => a.name);
        const foundIds = await api.checkAppsInstalled({
          wingetIds,
          catalogNames,
        });
        set({ installedAppIds: new Set(foundIds), isCheckingInstalled: false });
      } catch {
        set({ isCheckingInstalled: false });
      }
    },

    setHideInstalled: (hide: boolean) => {
      set({ hideInstalled: hide });
    },

    fetchCustomApps: async () => {
      // Silent: no file on first run is the expected steady-state.
      const apps = await invokeOrToast<CustomAppEntry[]>("get_custom_apps", undefined, {
        silent: true,
      });
      if (apps) set({ customApps: apps });
    },

    addCustomApp: async (app: CustomAppEntry) => {
      await api.saveCustomApp({ app });
      await get().fetchCustomApps();
    },

    removeCustomApp: async (id: string) => {
      await api.deleteCustomApp({ appId: id });
      await get().fetchCustomApps();
    },

    installCustomApp: async (app: CustomAppEntry) => {
      set({ customAppInstalling: app.id });
      try {
        await api.downloadAndInstallCustomApp({ app });
      } finally {
        set({ customAppInstalling: null });
      }
    },

    deselectCategory: (category: AppCategory | "all") => {
      const { catalog, selectedIds } = get();
      const filtered =
        category === "all" ? catalog : catalog.filter((a) => a.category === category);
      const idsToRemove = new Set(filtered.map((a) => a.id));
      const newSet = new Set([...selectedIds].filter((id) => !idsToRemove.has(id)));
      set({ selectedIds: newSet });
    },

    checkDiskSpace: async () => {
      try {
        const gb = await api.getFreeDiskSpaceGb();
        set({ diskSpaceGb: gb });
        return gb;
      } catch {
        return null;
      }
    },

    checkNetwork: async () => {
      try {
        const ok = await api.checkNetworkConnectivity();
        set({ networkAvailable: ok });
        return ok;
      } catch {
        set({ networkAvailable: false });
        return false;
      }
    },

    retryFailed: () => {
      const { installProgress, catalog } = get();
      const failedIds: string[] = [];
      const newProgress = new Map(installProgress);

      for (const [id, entry] of installProgress) {
        if (entry.status === "Failed") {
          failedIds.push(id);
          newProgress.set(id, { ...entry, status: "Pending", message: "Retrying..." });
        }
      }

      if (failedIds.length === 0) return;

      set({ installProgress: newProgress, isInstalling: true });

      const appIds = failedIds.filter((id) => catalog.some((a) => a.id === id));
      api.installApps({ appIds }).catch((err) => {
        console.error("Retry failed:", err);
        set({ isInstalling: false });
      });
    },
  };
});
