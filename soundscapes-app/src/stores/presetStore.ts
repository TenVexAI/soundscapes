import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { AmbientSound } from '../types';

export interface PresetInfo {
  id: string;
  name: string;
  created: string;
  modified: string;
  soundCount: number;
}

export interface PresetSound {
  categoryId: string;
  categoryPath: string;
  soundId: string;
  name: string;
  filesA: string;
  filesB: string;
  enabled: boolean;
  volume: number;
  pitch: number;
  pan: number;
  lowPassFreq: number;
  algorithmicReverb: number;
  repeatRangeMin: number;
  repeatRangeMax: number;
  pauseRangeMin: number;
  pauseRangeMax: number;
  volumeVariation: number;
}

export interface SoundscapePreset {
  id: string;
  name: string;
  created: string;
  modified: string;
  sounds: PresetSound[];
}

interface PresetState {
  presets: PresetInfo[];
  currentPresetId: string | null;
  isLoading: boolean;
  
  loadPresets: () => Promise<void>;
  savePreset: (name: string, sounds: Map<string, AmbientSound>) => Promise<PresetInfo>;
  loadPreset: (id: string) => Promise<SoundscapePreset>;
  deletePreset: (id: string) => Promise<void>;
  setCurrentPresetId: (id: string | null) => void;
}

// Convert AmbientSound to PresetSound format
function ambientToPresetSound(sound: AmbientSound): PresetSound {
  return {
    categoryId: sound.categoryId,
    categoryPath: sound.categoryPath,
    soundId: sound.id,
    name: sound.name,
    filesA: sound.filesA,
    filesB: sound.filesB,
    enabled: sound.enabled,
    volume: sound.volume,
    pitch: sound.pitch,
    pan: sound.pan,
    lowPassFreq: sound.lowPassFreq,
    algorithmicReverb: sound.algorithmicReverb,
    repeatRangeMin: sound.repeatRangeMin,
    repeatRangeMax: sound.repeatRangeMax,
    pauseRangeMin: sound.pauseRangeMin,
    pauseRangeMax: sound.pauseRangeMax,
    volumeVariation: sound.volumeVariation,
  };
}

export const usePresetStore = create<PresetState>((set, get) => ({
  presets: [],
  currentPresetId: null,
  isLoading: false,
  
  loadPresets: async () => {
    set({ isLoading: true });
    try {
      const presets = await invoke<PresetInfo[]>('list_presets');
      set({ presets, isLoading: false });
    } catch (error) {
      console.error('Error loading presets:', error);
      set({ isLoading: false });
    }
  },
  
  savePreset: async (name: string, sounds: Map<string, AmbientSound>) => {
    const presetSounds = Array.from(sounds.values()).map(ambientToPresetSound);
    const result = await invoke<PresetInfo>('save_preset', { name, sounds: presetSounds });
    
    // Refresh the preset list
    await get().loadPresets();
    set({ currentPresetId: result.id });
    
    return result;
  },
  
  loadPreset: async (id: string) => {
    const preset = await invoke<SoundscapePreset>('load_preset', { id });
    set({ currentPresetId: id });
    return preset;
  },
  
  deletePreset: async (id: string) => {
    await invoke('delete_preset', { id });
    
    // Clear current if deleted
    if (get().currentPresetId === id) {
      set({ currentPresetId: null });
    }
    
    // Refresh the preset list
    await get().loadPresets();
  },
  
  setCurrentPresetId: (id: string | null) => {
    set({ currentPresetId: id });
  },
}));
