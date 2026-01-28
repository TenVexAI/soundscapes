import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { SoundboardSound, SoundboardData } from '../types';

interface SoundboardState {
  sounds: SoundboardSound[];
  folderPath: string;
  isLoading: boolean;
  currentlyPlaying: string | null;
  
  loadSounds: (folderPath: string) => Promise<void>;
  playSound: (soundId: string) => void;
  updateSoundVolume: (soundId: string, volume: number) => void;
}

export const useSoundboardStore = create<SoundboardState>((set, get) => ({
  sounds: [],
  folderPath: '',
  isLoading: false,
  currentlyPlaying: null,
  
  loadSounds: async (folderPath: string) => {
    set({ isLoading: true });
    try {
      const data = await invoke<SoundboardData>('scan_soundboard_folder', { folderPath });
      
      const sounds: SoundboardSound[] = data.sounds.map(s => ({
        id: s.id,
        name: s.name,
        file: s.file,
        filePath: `${folderPath}/${s.file}`,
        volume: s.volume ?? 80,
        hotkey: s.hotkey ?? null,
        color: s.color ?? '#a287f4',
      }));
      
      set({ sounds, folderPath, isLoading: false });
    } catch (error) {
      console.error('Error loading soundboard:', error);
      set({ isLoading: false });
    }
  },
  
  playSound: (soundId: string) => {
    const { sounds } = get();
    const sound = sounds.find(s => s.id === soundId);
    
    if (sound) {
      // TODO: Implement soundboard playback in Rust backend
      console.log('Playing soundboard sound:', sound.name);
      set({ currentlyPlaying: soundId });
      
      setTimeout(() => {
        set({ currentlyPlaying: null });
      }, 2000);
    }
  },
  
  updateSoundVolume: (soundId: string, volume: number) => {
    set(state => ({
      sounds: state.sounds.map(s =>
        s.id === soundId ? { ...s, volume } : s
      ),
    }));
  },
}));
