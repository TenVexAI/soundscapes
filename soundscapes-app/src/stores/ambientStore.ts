import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { AmbientCategory, AmbientSound, AmbientSoundDef, DEFAULT_AMBIENT_SETTINGS } from '../types';

interface AmbientState {
  categories: AmbientCategory[];
  activeSounds: Map<string, AmbientSound>;
  isLoading: boolean;
  expandedCategories: Set<string>;
  hideUnselected: boolean;
  
  loadCategories: (folderPath: string) => Promise<void>;
  toggleSound: (categoryPath: string, sound: AmbientSoundDef, categoryName: string) => void;
  updateSoundSettings: (soundId: string, settings: Partial<AmbientSound>) => void;
  resetSoundToDefaults: (soundId: string, soundDef: AmbientSoundDef) => void;
  toggleCategory: (categoryName: string) => void;
  selectAllInCategory: (categoryPath: string, sounds: AmbientSoundDef[], categoryName: string) => void;
  deselectAllInCategory: (categoryName: string) => void;
  setHideUnselected: (hide: boolean) => void;
  clearAll: () => void;
}

export const useAmbientStore = create<AmbientState>((set, get) => ({
  categories: [],
  activeSounds: new Map(),
  isLoading: false,
  expandedCategories: new Set(),
  hideUnselected: false,
  
  loadCategories: async (folderPath: string) => {
    set({ isLoading: true });
    try {
      const categories = await invoke<AmbientCategory[]>('scan_ambient_folder', { folderPath });
      set({ categories, isLoading: false });
    } catch (error) {
      console.error('Error loading ambient categories:', error);
      set({ isLoading: false });
    }
  },
  
  toggleSound: async (categoryPath: string, soundDef: AmbientSoundDef, categoryName: string) => {
    const { activeSounds } = get();
    const newActiveSounds = new Map(activeSounds);
    
    if (newActiveSounds.has(soundDef.id)) {
      await invoke('stop_ambient', { id: soundDef.id });
      newActiveSounds.delete(soundDef.id);
    } else {
      const sound: AmbientSound = {
        id: soundDef.id,
        name: soundDef.name,
        categoryId: categoryName,
        categoryPath: categoryPath,
        filesA: soundDef.files.a,
        filesB: soundDef.files.b,
        enabled: true,
        volume: soundDef.defaults?.volume ?? DEFAULT_AMBIENT_SETTINGS.volume,
        pitch: soundDef.defaults?.pitch ?? DEFAULT_AMBIENT_SETTINGS.pitch,
        pan: soundDef.defaults?.pan ?? DEFAULT_AMBIENT_SETTINGS.pan,
        lowPassFreq: soundDef.defaults?.lowPassFreq ?? DEFAULT_AMBIENT_SETTINGS.lowPassFreq,
        reverbType: (soundDef.defaults?.reverbType as AmbientSound['reverbType']) ?? DEFAULT_AMBIENT_SETTINGS.reverbType,
        algorithmicReverb: soundDef.defaults?.algorithmicReverb ?? DEFAULT_AMBIENT_SETTINGS.algorithmicReverb,
        repeatRangeMin: soundDef.defaults?.repeatRangeMin ?? DEFAULT_AMBIENT_SETTINGS.repeatRangeMin,
        repeatRangeMax: soundDef.defaults?.repeatRangeMax ?? DEFAULT_AMBIENT_SETTINGS.repeatRangeMax,
        pauseRangeMin: soundDef.defaults?.pauseRangeMin ?? DEFAULT_AMBIENT_SETTINGS.pauseRangeMin,
        pauseRangeMax: soundDef.defaults?.pauseRangeMax ?? DEFAULT_AMBIENT_SETTINGS.pauseRangeMax,
        volumeVariation: soundDef.defaults?.volumeVariation ?? DEFAULT_AMBIENT_SETTINGS.volumeVariation,
      };
      
      newActiveSounds.set(soundDef.id, sound);
      
      const fileA = `${categoryPath}/${soundDef.files.a}`;
      const fileB = `${categoryPath}/${soundDef.files.b}`;
      await invoke('play_ambient', {
        id: soundDef.id,
        fileA,
        fileB,
        volume: sound.volume / 100,
        pitch: sound.pitch,
        pan: sound.pan / 100, // Convert -100..100 to -1..1
        repeatMin: sound.repeatRangeMin,
        repeatMax: sound.repeatRangeMax,
        pauseMin: sound.pauseRangeMin,
        pauseMax: sound.pauseRangeMax,
        volumeVariation: sound.volumeVariation / 100, // Convert 0-50 to 0-0.5
      });
    }
    
    set({ activeSounds: newActiveSounds });
  },
  
  updateSoundSettings: async (soundId: string, settings: Partial<AmbientSound>) => {
    const { activeSounds } = get();
    const sound = activeSounds.get(soundId);
    
    if (sound) {
      const updatedSound = { ...sound, ...settings };
      const newActiveSounds = new Map(activeSounds);
      newActiveSounds.set(soundId, updatedSound);
      
      // Send all settings to Rust backend
      await invoke('update_ambient_settings', {
        id: soundId,
        volume: updatedSound.volume / 100,
        pitch: updatedSound.pitch,
        pan: updatedSound.pan / 100,
        repeatMin: updatedSound.repeatRangeMin,
        repeatMax: updatedSound.repeatRangeMax,
        pauseMin: updatedSound.pauseRangeMin,
        pauseMax: updatedSound.pauseRangeMax,
        volumeVariation: updatedSound.volumeVariation / 100,
      });
      
      set({ activeSounds: newActiveSounds });
    }
  },
  
  resetSoundToDefaults: async (soundId: string, soundDef: AmbientSoundDef) => {
    const { activeSounds } = get();
    const sound = activeSounds.get(soundId);
    
    if (sound) {
      const defaultSettings = {
        volume: soundDef.defaults?.volume ?? DEFAULT_AMBIENT_SETTINGS.volume,
        pitch: soundDef.defaults?.pitch ?? DEFAULT_AMBIENT_SETTINGS.pitch,
        pan: soundDef.defaults?.pan ?? DEFAULT_AMBIENT_SETTINGS.pan,
        lowPassFreq: soundDef.defaults?.lowPassFreq ?? DEFAULT_AMBIENT_SETTINGS.lowPassFreq,
        reverbType: (soundDef.defaults?.reverbType as AmbientSound['reverbType']) ?? DEFAULT_AMBIENT_SETTINGS.reverbType,
        algorithmicReverb: soundDef.defaults?.algorithmicReverb ?? DEFAULT_AMBIENT_SETTINGS.algorithmicReverb,
        repeatRangeMin: soundDef.defaults?.repeatRangeMin ?? DEFAULT_AMBIENT_SETTINGS.repeatRangeMin,
        repeatRangeMax: soundDef.defaults?.repeatRangeMax ?? DEFAULT_AMBIENT_SETTINGS.repeatRangeMax,
        pauseRangeMin: soundDef.defaults?.pauseRangeMin ?? DEFAULT_AMBIENT_SETTINGS.pauseRangeMin,
        pauseRangeMax: soundDef.defaults?.pauseRangeMax ?? DEFAULT_AMBIENT_SETTINGS.pauseRangeMax,
        volumeVariation: soundDef.defaults?.volumeVariation ?? DEFAULT_AMBIENT_SETTINGS.volumeVariation,
      };
      
      const updatedSound = { ...sound, ...defaultSettings };
      const newActiveSounds = new Map(activeSounds);
      newActiveSounds.set(soundId, updatedSound);
      
      // Send all settings to Rust backend
      await invoke('update_ambient_settings', {
        id: soundId,
        volume: updatedSound.volume / 100,
        pitch: updatedSound.pitch,
        pan: updatedSound.pan / 100,
        repeatMin: updatedSound.repeatRangeMin,
        repeatMax: updatedSound.repeatRangeMax,
        pauseMin: updatedSound.pauseRangeMin,
        pauseMax: updatedSound.pauseRangeMax,
        volumeVariation: updatedSound.volumeVariation / 100,
      });
      
      set({ activeSounds: newActiveSounds });
    }
  },
  
  toggleCategory: (categoryName: string) => {
    set(state => {
      const newExpanded = new Set(state.expandedCategories);
      if (newExpanded.has(categoryName)) {
        newExpanded.delete(categoryName);
      } else {
        newExpanded.add(categoryName);
      }
      return { expandedCategories: newExpanded };
    });
  },
  
  selectAllInCategory: (categoryPath: string, sounds: AmbientSoundDef[], categoryName: string) => {
    const { activeSounds, toggleSound } = get();
    
    sounds.forEach(soundDef => {
      if (!activeSounds.has(soundDef.id)) {
        toggleSound(categoryPath, soundDef, categoryName);
      }
    });
  },
  
  deselectAllInCategory: async (categoryName: string) => {
    const { activeSounds } = get();
    const newActiveSounds = new Map(activeSounds);
    
    for (const [id, sound] of activeSounds) {
      if (sound.categoryId === categoryName) {
        await invoke('stop_ambient', { id });
        newActiveSounds.delete(id);
      }
    }
    
    set({ activeSounds: newActiveSounds });
  },
  
  setHideUnselected: (hide: boolean) => {
    set({ hideUnselected: hide });
  },
  
  clearAll: async () => {
    const { activeSounds } = get();
    
    for (const [id] of activeSounds) {
      await invoke('stop_ambient', { id });
    }
    
    set({ activeSounds: new Map() });
  },
}));
