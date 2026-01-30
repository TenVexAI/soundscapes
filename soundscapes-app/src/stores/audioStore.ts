import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

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
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setAmbientVolume: (volume: number) => void;
  setSoundboardVolume: (volume: number) => void;
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
      const { masterVolume, musicVolume } = get();
      await invoke('set_master_volume', { volume: masterVolume / 100 });
      await invoke('set_music_volume', { volume: musicVolume / 100 });
      set({ isInitialized: true });
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  },
  
  setMasterVolume: (volume: number) => {
    invoke('set_master_volume', { volume: volume / 100 }).catch(console.error);
    set({ masterVolume: volume });
  },
  
  setMusicVolume: (volume: number) => {
    invoke('set_music_volume', { volume: volume / 100 }).catch(console.error);
    set({ musicVolume: volume });
  },
  
  setAmbientVolume: (volume: number) => {
    invoke('set_ambient_master_volume', { volume: volume / 100 }).catch(console.error);
    set({ ambientVolume: volume });
  },
  
  setSoundboardVolume: (volume: number) => {
    // TODO: Implement soundboard volume in Rust backend
    set({ soundboardVolume: volume });
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
