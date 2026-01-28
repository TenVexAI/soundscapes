import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { MusicTrack, MusicAlbum } from '../types';

interface PlaylistState {
  albums: MusicAlbum[];
  tracks: MusicTrack[];
  queue: MusicTrack[];
  currentTrack: MusicTrack | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  isShuffled: boolean;
  favorites: Set<string>;
  isLoading: boolean;
  
  loadAlbums: (folderPath: string) => Promise<void>;
  playTrack: (track: MusicTrack) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlayPause: () => void;
  addToQueue: (track: MusicTrack) => void;
  playTrackNext: (track: MusicTrack) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  toggleShuffle: () => void;
  toggleFavorite: (trackId: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  albums: [],
  tracks: [],
  queue: [],
  currentTrack: null,
  currentTrackIndex: -1,
  isPlaying: false,
  isShuffled: false,
  favorites: new Set(),
  isLoading: false,
  
  loadAlbums: async (folderPath: string) => {
    set({ isLoading: true });
    try {
      const albums = await invoke<MusicAlbum[]>('scan_music_folder', { folderPath });
      
      const allTracks: MusicTrack[] = [];
      albums.forEach(album => {
        album.tracks.forEach(track => {
          allTracks.push({
            ...track,
            album: album.name,
            albumPath: album.path,
            favorite: false,
          });
        });
      });
      
      set({ albums, tracks: allTracks, isLoading: false });
    } catch (error) {
      console.error('Error loading albums:', error);
      set({ isLoading: false });
    }
  },
  
  playTrack: async (track: MusicTrack) => {
    const filePath = `${track.albumPath}/${track.file}`;
    
    console.log('PlaylistStore: Playing track:', track.title);
    console.log('PlaylistStore: File path:', filePath);
    
    try {
      await invoke('play_music', { filePath });
      set({ currentTrack: track, isPlaying: true });
    } catch (error) {
      console.error('Error playing track:', error);
    }
  },
  
  playNext: () => {
    const { queue, currentTrackIndex, isShuffled, tracks } = get();
    
    if (queue.length > 0) {
      const nextTrack = queue[0];
      set({ queue: queue.slice(1) });
      get().playTrack(nextTrack);
      return;
    }
    
    if (tracks.length === 0) return;
    
    let nextIndex: number;
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    } else {
      nextIndex = (currentTrackIndex + 1) % tracks.length;
    }
    
    set({ currentTrackIndex: nextIndex });
    get().playTrack(tracks[nextIndex]);
  },
  
  playPrevious: () => {
    const { currentTrackIndex, tracks } = get();
    
    if (tracks.length === 0) return;
    
    const prevIndex = currentTrackIndex <= 0 ? tracks.length - 1 : currentTrackIndex - 1;
    set({ currentTrackIndex: prevIndex });
    get().playTrack(tracks[prevIndex]);
  },
  
  togglePlayPause: async () => {
    const { isPlaying, currentTrack, tracks } = get();
    
    if (!currentTrack && tracks.length > 0) {
      get().playTrack(tracks[0]);
      set({ currentTrackIndex: 0 });
      return;
    }
    
    try {
      if (isPlaying) {
        await invoke('pause_music');
      } else {
        await invoke('resume_music');
      }
      set({ isPlaying: !isPlaying });
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  },
  
  addToQueue: (track: MusicTrack) => {
    set(state => ({ queue: [...state.queue, track] }));
  },
  
  playTrackNext: (track: MusicTrack) => {
    set(state => ({ queue: [track, ...state.queue] }));
  },
  
  removeFromQueue: (index: number) => {
    set(state => ({
      queue: state.queue.filter((_, i) => i !== index),
    }));
  },
  
  clearQueue: () => {
    set({ queue: [] });
  },
  
  toggleShuffle: () => {
    set(state => ({ isShuffled: !state.isShuffled }));
  },
  
  toggleFavorite: (trackId: string) => {
    set(state => {
      const newFavorites = new Set(state.favorites);
      if (newFavorites.has(trackId)) {
        newFavorites.delete(trackId);
      } else {
        newFavorites.add(trackId);
      }
      return { favorites: newFavorites };
    });
  },
  
  reorderQueue: (fromIndex: number, toIndex: number) => {
    set(state => {
      const newQueue = [...state.queue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      return { queue: newQueue };
    });
  },
}));
