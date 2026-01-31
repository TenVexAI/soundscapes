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
  
  playSound: async (soundId: string) => {
    const { sounds, currentlyPlaying } = get();
    const sound = sounds.find(s => s.id === soundId);
    
    if (sound) {
      // If clicking the same sound that's playing, stop it
      if (currentlyPlaying === soundId) {
        try {
          await invoke('stop_soundboard');
          set({ currentlyPlaying: null });
        } catch (error) {
          console.error('Error stopping soundboard:', error);
        }
        return;
      }
      
      try {
        // Play the soundboard sound (volume is 0-100, convert to 0-1)
        await invoke('play_soundboard', { 
          filePath: sound.filePath, 
          volume: sound.volume / 100 
        });
        set({ currentlyPlaying: soundId });
        
        // Start polling to detect when sound finishes
        const pollInterval = setInterval(async () => {
          try {
            const isPlaying = await invoke<boolean>('is_soundboard_playing');
            if (!isPlaying) {
              clearInterval(pollInterval);
              // Only clear if this sound is still marked as playing
              if (get().currentlyPlaying === soundId) {
                set({ currentlyPlaying: null });
              }
            }
          } catch {
            clearInterval(pollInterval);
          }
        }, 100); // Poll every 100ms
      } catch (error) {
        console.error('Error playing soundboard sound:', error);
      }
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
