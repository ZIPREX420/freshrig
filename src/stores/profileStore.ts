import { create } from "zustand";
import { api } from "../lib";
import type { RigProfile, ProfileSummary, SourceHardware } from "../types/profiles";
import type { AppEntry } from "../types/apps";

interface ProfileState {
  profiles: ProfileSummary[];
  activeProfile: RigProfile | null;
  loading: boolean;
  error: string | null;
  showSaveDialog: boolean;
  showImportPreview: boolean;
  importPreview: RigProfile | null;
  fetchProfiles: () => Promise<void>;
  saveProfile: (profile: RigProfile) => Promise<string>;
  loadProfile: (filePath: string) => Promise<RigProfile>;
  deleteProfile: (filePath: string) => Promise<void>;
  exportToFile: (profile: RigProfile) => Promise<string>;
  importFromFile: () => Promise<RigProfile | null>;
  exportAsText: (profile: RigProfile, catalog: AppEntry[]) => Promise<string>;
  generateShareCode: (profile: RigProfile) => Promise<string>;
  importFromShareCode: (code: string) => Promise<RigProfile>;
  getHardwareSnapshot: () => Promise<SourceHardware>;
  setActiveProfile: (profile: RigProfile | null) => void;
  clearActiveProfile: () => void;
  setShowSaveDialog: (show: boolean) => void;
  setShowImportPreview: (show: boolean) => void;
  setImportPreview: (profile: RigProfile | null) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: [],
  activeProfile: null,
  loading: false,
  error: null,
  showSaveDialog: false,
  showImportPreview: false,
  importPreview: null,

  fetchProfiles: async () => {
    set({ loading: true, error: null });
    try {
      const profiles = await api.listProfiles();
      set({ profiles, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  saveProfile: async (profile: RigProfile) => {
    const path = await api.saveProfile({ profile });
    return path;
  },

  loadProfile: async (filePath: string) => {
    const profile = await api.loadProfile({ filePath });
    set({ activeProfile: profile });
    return profile;
  },

  deleteProfile: async (filePath: string) => {
    await api.deleteProfile({ filePath });
  },

  exportToFile: async (profile: RigProfile) => {
    const path = await api.exportProfileToFile({ profile });
    return path;
  },

  importFromFile: async () => {
    try {
      const profile = await api.importProfileFromFile();
      set({ importPreview: profile, showImportPreview: true });
      return profile;
    } catch (err) {
      if (String(err).includes("cancelled")) return null;
      throw err;
    }
  },

  exportAsText: async (profile: RigProfile, catalog: AppEntry[]) => {
    const text = await api.exportProfileAsText({ profile, catalog });
    return text;
  },

  generateShareCode: async (profile: RigProfile) => {
    const code = await api.compressProfile({ profile });
    return code;
  },

  importFromShareCode: async (code: string) => {
    const profile = await api.decompressProfile({ encoded: code });
    return profile;
  },

  getHardwareSnapshot: async () => {
    const hw = await api.getCurrentHardwareSnapshot();
    return hw;
  },

  setActiveProfile: (profile) => set({ activeProfile: profile }),
  clearActiveProfile: () => set({ activeProfile: null }),
  setShowSaveDialog: (show) => set({ showSaveDialog: show }),
  setShowImportPreview: (show) => set({ showImportPreview: show }),
  setImportPreview: (profile) => set({ importPreview: profile }),
}));
