import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings, ActivePanel } from '../types';

interface SettingsState {
  settings: AppSettings | null;
  activePanel: ActivePanel;
  isLoading: boolean;
  error: string | null;
  
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  setActivePanel: (panel: ActivePanel) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  activePanel: null,
  isLoading: false,
  error: null,
  
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const settings = await invoke<AppSettings>('get_settings');
      set({ settings, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
  
  saveSettings: async (settings: AppSettings) => {
    try {
      await invoke('save_settings', { settings });
      set({ settings });
    } catch (error) {
      set({ error: String(error) });
    }
  },
  
  setActivePanel: (panel: ActivePanel) => {
    set({ activePanel: panel });
  },
  
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const { settings, saveSettings } = get();
    if (settings) {
      const newSettings = { ...settings, [key]: value };
      saveSettings(newSettings);
    }
  },
}));
