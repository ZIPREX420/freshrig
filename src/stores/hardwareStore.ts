import { create } from "zustand";
import { api } from "../lib";
import type { HardwareSummary, DriverIssue } from "../types/hardware";

interface HardwareState {
  summary: HardwareSummary | null;
  driverIssues: DriverIssue[];
  loading: boolean;
  error: string | null;
  fetchHardware: () => Promise<void>;
}

export const useHardwareStore = create<HardwareState>((set) => ({
  summary: null,
  driverIssues: [],
  loading: false,
  error: null,

  fetchHardware: async () => {
    set({ loading: true, error: null });
    try {
      const [summary, driverIssues] = await Promise.all([
        api.getHardwareSummary(),
        api.getDriverIssues(),
      ]);
      set({ summary, driverIssues, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      });
    }
  },
}));
