import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings } from '../types';

interface AudioState {
  masterVolume: number;
  musicVolume: number;
  ambientVolume: number;
  soundboardVolume: number;
  
  isMasterMuted: boolean;
  isMusicMuted: boolean;
  isAmbientMuted: boolean;
  isSoundboardMuted: boolean;
  
  isInitialized: boolean;
  
  initAudio: () => Promise<void>;
  loadVolumesFromSettings: (settings: AppSettings) => void;
  setMasterVolume: (volume: number, save?: boolean) => void;
  setMusicVolume: (volume: number, save?: boolean) => void;
  setAmbientVolume: (volume: number, save?: boolean) => void;
  setSoundboardVolume: (volume: number, save?: boolean) => void;
  toggleMasterMute: () => void;
  toggleMusicMute: () => void;
  toggleAmbientMute: () => void;
  toggleSoundboardMute: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  masterVolume: 50,
  musicVolume: 50,
  ambientVolume: 50,
  soundboardVolume: 50,
  
  isMasterMuted: false,
  isMusicMuted: false,
  isAmbientMuted: false,
  isSoundboardMuted: false,
  
  isInitialized: false,
  
  initAudio: async () => {
    try {
      await invoke('init_audio');
      const { masterVolume, musicVolume, ambientVolume } = get();
      await invoke('set_master_volume', { volume: masterVolume / 100 });
      await invoke('set_music_volume', { volume: musicVolume / 100 });
      await invoke('set_ambient_master_volume', { volume: ambientVolume / 100 });
      set({ isInitialized: true });
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  },
  
  loadVolumesFromSettings: (settings: AppSettings) => {
    set({
      masterVolume: settings.master_volume ?? 50,
      musicVolume: settings.music_volume ?? 50,
      ambientVolume: settings.ambient_volume ?? 50,
      soundboardVolume: settings.soundboard_volume ?? 50,
    });
  },
  
  setMasterVolume: (volume: number, save = true) => {
    invoke('set_master_volume', { volume: volume / 100 }).catch(console.error);
    set({ masterVolume: volume });
    if (save) {
      invoke('save_volume_setting', { key: 'master_volume', value: volume }).catch(console.error);
    }
  },
  
  setMusicVolume: (volume: number, save = true) => {
    invoke('set_music_volume', { volume: volume / 100 }).catch(console.error);
    set({ musicVolume: volume });
    if (save) {
      invoke('save_volume_setting', { key: 'music_volume', value: volume }).catch(console.error);
    }
  },
  
  setAmbientVolume: (volume: number, save = true) => {
    invoke('set_ambient_master_volume', { volume: volume / 100 }).catch(console.error);
    set({ ambientVolume: volume });
    if (save) {
      invoke('save_volume_setting', { key: 'ambient_volume', value: volume }).catch(console.error);
    }
  },
  
  setSoundboardVolume: (volume: number, save = true) => {
    // TODO: Implement soundboard volume in Rust backend
    set({ soundboardVolume: volume });
    if (save) {
      invoke('save_volume_setting', { key: 'soundboard_volume', value: volume }).catch(console.error);
    }
  },
  
  toggleMasterMute: () => {
    const { isMasterMuted } = get();
    invoke('set_master_muted', { muted: !isMasterMuted }).catch(console.error);
    set({ isMasterMuted: !isMasterMuted });
  },
  
  toggleMusicMute: () => {
    const { isMusicMuted } = get();
    invoke('set_music_muted', { muted: !isMusicMuted }).catch(console.error);
    set({ isMusicMuted: !isMusicMuted });
  },
  
  toggleAmbientMute: () => {
    const { isAmbientMuted } = get();
    invoke('set_ambient_muted', { muted: !isAmbientMuted }).catch(console.error);
    set({ isAmbientMuted: !isAmbientMuted });
  },
  
  toggleSoundboardMute: () => {
    const { isSoundboardMuted } = get();
    // TODO: Implement soundboard mute in Rust backend
    set({ isSoundboardMuted: !isSoundboardMuted });
  },
}));
