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
      
      // Sync duck amount to backend audio engine on load
      if (settings.soundboard_duck_amount !== undefined) {
        await invoke('set_duck_amount', { amount: settings.soundboard_duck_amount });
      }
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
  
  updateSetting: async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const { settings, saveSettings } = get();
    if (settings) {
      const newSettings = { ...settings, [key]: value };
      saveSettings(newSettings);
      
      // Sync specific settings to backend audio engine
      if (key === 'soundboard_duck_amount') {
        try {
          await invoke('set_duck_amount', { amount: value as number });
        } catch (error) {
          console.error('Failed to set duck amount:', error);
        }
      }
    }
  },
}));
