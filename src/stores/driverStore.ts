import { create } from "zustand";
import { api } from "../lib";
import type { DriverRecommendation } from "../types/drivers";

interface DriverState {
  recommendations: DriverRecommendation[];
  loading: boolean;
  error: string | null;
  installingDriverId: string | null;
  installedDriverIds: Set<string>;
  fetchRecommendations: () => Promise<void>;
  installDriver: (wingetId: string) => Promise<{ success: boolean; message: string }>;
}

export const useDriverStore = create<DriverState>((set) => ({
  recommendations: [],
  loading: false,
  error: null,
  installingDriverId: null,
  installedDriverIds: new Set<string>(),

  fetchRecommendations: async () => {
    set({ loading: true, error: null });
    try {
      const recommendations = await api.getDriverRecommendations();
      set({ recommendations, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },

  installDriver: async (wingetId: string) => {
    set({ installingDriverId: wingetId });
    try {
      const message = await api.installDriver({ wingetId });
      set((state) => {
        const newSet = new Set(state.installedDriverIds);
        newSet.add(wingetId);
        return { installingDriverId: null, installedDriverIds: newSet };
      });
      return { success: true, message };
    } catch (err) {
      set({ installingDriverId: null });
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
}));
