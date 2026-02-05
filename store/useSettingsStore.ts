
import { create } from 'zustand';

interface SettingsState {
  defaultSavePath: string;
  autoSaveResult: boolean;
  
  // Actions
  setDefaultSavePath: (path: string) => void;
  setAutoSaveResult: (enabled: boolean) => void;
  loadSettings: () => void;
}

const STORAGE_KEY = 'omniflow_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  defaultSavePath: '',
  autoSaveResult: false,

  loadSettings: () => {
      try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
              const data = JSON.parse(raw);
              set(data);
          }
      } catch (e) {
          console.error("Failed to load settings", e);
      }
  },

  setDefaultSavePath: (path) => {
      set({ defaultSavePath: path });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), defaultSavePath: path }));
  },

  setAutoSaveResult: (enabled) => {
      set({ autoSaveResult: enabled });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...get(), autoSaveResult: enabled }));
  },
}));
