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
  loadSoundWithSettings: (sound: AmbientSound) => Promise<void>;
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
      
      // Preload all audio files into memory cache to prevent static on first playback
      const allPaths: string[] = [];
      for (const category of categories) {
        for (const sound of category.sounds) {
          allPaths.push(`${category.path}/${sound.files.a}`);
          allPaths.push(`${category.path}/${sound.files.b}`);
        }
      }
      if (allPaths.length > 0) {
        invoke('preload_ambient_sounds', { paths: allPaths }).catch(err => {
          console.warn('Failed to preload ambient sounds:', err);
        });
      }
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
        lowPassFreq: sound.lowPassFreq,
        reverbType: sound.reverbType,
        algorithmicReverb: sound.algorithmicReverb / 100, // Convert 0-100 to 0-1
        repeatMin: sound.repeatRangeMin,
        repeatMax: sound.repeatRangeMax,
        pauseMin: sound.pauseRangeMin,
        pauseMax: sound.pauseRangeMax,
        volumeVariation: sound.volumeVariation / 100, // Convert 0-50 to 0-0.5
      });
    }
    
    set({ activeSounds: newActiveSounds });
  },
  
  // Load a sound with specific settings (used for preset loading)
  loadSoundWithSettings: async (sound: AmbientSound) => {
    const { activeSounds } = get();
    
    // Skip if already active
    if (activeSounds.has(sound.id)) return;
    
    const newActiveSounds = new Map(activeSounds);
    newActiveSounds.set(sound.id, sound);
    
    const fileA = `${sound.categoryPath}/${sound.filesA}`;
    const fileB = `${sound.categoryPath}/${sound.filesB}`;
    
    await invoke('play_ambient', {
      id: sound.id,
      fileA,
      fileB,
      volume: sound.volume / 100,
      pitch: sound.pitch,
      pan: sound.pan / 100,
      lowPassFreq: sound.lowPassFreq,
      reverbType: sound.reverbType,
      algorithmicReverb: sound.algorithmicReverb / 100,
      repeatMin: sound.repeatRangeMin,
      repeatMax: sound.repeatRangeMax,
      pauseMin: sound.pauseRangeMin,
      pauseMax: sound.pauseRangeMax,
      volumeVariation: sound.volumeVariation / 100,
    });
    
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
        lowPassFreq: updatedSound.lowPassFreq,
        reverbType: updatedSound.reverbType,
        algorithmicReverb: updatedSound.algorithmicReverb / 100,
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
        lowPassFreq: updatedSound.lowPassFreq,
        reverbType: updatedSound.reverbType,
        algorithmicReverb: updatedSound.algorithmicReverb / 100,
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
  
  selectAllInCategory: async (categoryPath: string, sounds: AmbientSoundDef[], categoryName: string) => {
    const { activeSounds } = get();
    const newActiveSounds = new Map(activeSounds);
    
    // Filter to only sounds that need to be added
    const soundsToAdd = sounds.filter(s => !newActiveSounds.has(s.id));
    
    // Process sounds sequentially with delays to prevent audio glitches
    for (let i = 0; i < soundsToAdd.length; i++) {
      const soundDef = soundsToAdd[i];
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
        pan: sound.pan / 100,
        lowPassFreq: sound.lowPassFreq,
        reverbType: sound.reverbType,
        algorithmicReverb: sound.algorithmicReverb / 100,
        repeatMin: sound.repeatRangeMin,
        repeatMax: sound.repeatRangeMax,
        pauseMin: sound.pauseRangeMin,
        pauseMax: sound.pauseRangeMax,
        volumeVariation: sound.volumeVariation / 100,
      });
      
      // Small delay between sounds to prevent audio buffer overload
      if (i < soundsToAdd.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    
    set({ activeSounds: newActiveSounds });
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
