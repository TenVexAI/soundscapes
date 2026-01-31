export interface MusicTrack {
  id: string;
  file: string;
  title: string;
  artist: string;
  album: string;
  albumPath: string;
  duration?: number;
  favorite: boolean;
}

export interface MusicAlbum {
  name: string;
  artist: string;
  tracks: MusicTrack[];
  path: string;
}

export interface AmbientSoundDefaults {
  volume: number;
  pitch: number;
  pan: number;
  lowPassFreq: number;
  reverbType: 'off' | 'small-room' | 'large-hall' | 'cathedral';
  algorithmicReverb: number;
  repeatRangeMin: number;
  repeatRangeMax: number;
  pauseRangeMin: number;
  pauseRangeMax: number;
  volumeVariation: number;
}

export interface AmbientSoundFiles {
  a: string;
  b: string;
}

export interface AmbientSoundDef {
  id: string;
  name: string;
  files: AmbientSoundFiles;
  defaults?: Partial<AmbientSoundDefaults>;
}

export interface AmbientCategory {
  name: string;
  icon?: string;
  sounds: AmbientSoundDef[];
  path: string;
}

export interface AmbientSound extends AmbientSoundDefaults {
  id: string;
  name: string;
  categoryId: string;
  categoryPath: string;
  filesA: string;
  filesB: string;
  enabled: boolean;
}

export interface SoundboardSound {
  id: string;
  name: string;
  file: string;
  filePath: string;
  volume: number;
  hotkey: string | null;
  color: string;
}

export interface SoundboardData {
  sounds: SoundboardSound[];
  path: string;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  isDefault: boolean;
}

export interface SoundscapePreset {
  id: string;
  name: string;
  created: string;
  modified: string;
  sounds: AmbientSound[];
}

export interface AppSettings {
  music_folder_path: string;
  ambient_folder_path: string;
  soundboard_folder_path: string;
  presets_folder_path: string;
  music_crossfade_duration: number;
  soundboard_duck_amount: number;
  visualization_type: string;
  master_volume: number;
  music_volume: number;
  ambient_volume: number;
  soundboard_volume: number;
}

export type ActivePanel = 'music' | 'ambient' | 'soundboard' | 'settings' | null;

// Schedule types for the Soundscapes Scheduler
export interface ScheduledItem {
  id: string;
  presetId: string;
  presetName: string;
  minMinutes: number;
  maxMinutes: number;
  order: number;
}

export interface SchedulePreset {
  id: string;
  name: string;
  created: string;
  modified: string;
  items: ScheduledItem[];
}

export interface SchedulePresetInfo {
  id: string;
  name: string;
  created: string;
  modified: string;
  itemCount: number;
}

export const DEFAULT_AMBIENT_SETTINGS: AmbientSoundDefaults = {
  volume: 50,
  pitch: 1.0,
  pan: 0,
  lowPassFreq: 22000,
  reverbType: 'off',
  algorithmicReverb: 0,
  repeatRangeMin: 1,
  repeatRangeMax: 1,
  pauseRangeMin: 0,
  pauseRangeMax: 0,
  volumeVariation: 0,
};
