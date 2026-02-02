import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { MusicAlbum } from '../types';

// Types matching the Rust backend
interface PlaylistTrack {
  id: string;
  file: string;
  title: string;
  artist: string;
  album: string;
  albumPath: string;
}

interface MusicPlaylist {
  id: string;
  name: string;
  isAuto: boolean;
  tracks: PlaylistTrack[];
}

interface BackendPlaylistState {
  currentPlaylistId: string | null;
  currentIndex: number;
  isShuffled: boolean;
  isLooping: boolean;
  favorites: string[];
  interruptedIndex: number | null;
}

interface PlaylistState {
  // Local UI state
  albums: MusicAlbum[];
  allTracks: PlaylistTrack[];
  playlists: MusicPlaylist[];
  currentPlaylistId: string | null;
  currentIndex: number;
  isShuffled: boolean;
  isLooping: boolean;
  favorites: Set<string>;
  isLoading: boolean;
  
  // Queue for "Play Next" functionality
  playNextQueue: PlaylistTrack[];
  interruptedIndex: number | null;
  
  // Actions
  loadAlbums: (folderPath: string) => Promise<void>;
  syncWithBackend: () => Promise<void>;
  playTrack: (track: PlaylistTrack) => Promise<void>;
  playTrackFromPlaylist: (playlistId: string, index: number) => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  setCurrentPlaylist: (playlistId: string | null) => Promise<void>;
  toggleShuffle: () => Promise<void>;
  toggleLoop: () => Promise<void>;
  toggleFavorite: (trackId: string) => Promise<void>;
  
  // Queue operations
  addToPlayNextQueue: (track: PlaylistTrack) => void;
  playNow: (track: PlaylistTrack) => Promise<void>;
  
  // Playlist management
  createPlaylist: (name: string, tracks: PlaylistTrack[]) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (playlistId: string, tracks: PlaylistTrack[]) => Promise<void>;
  updatePlaylist: (playlistId: string, tracks: PlaylistTrack[]) => Promise<void>;
  
  // Helpers
  getCurrentPlaylist: () => MusicPlaylist | null;
  getAutoPlaylists: () => MusicPlaylist[];
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  albums: [],
  allTracks: [],
  playlists: [],
  currentPlaylistId: null,
  currentIndex: -1,
  isShuffled: false,
  isLooping: true,
  favorites: new Set(),
  isLoading: false,
  playNextQueue: [],
  interruptedIndex: null,
  
  loadAlbums: async (folderPath: string) => {
    set({ isLoading: true });
    try {
      // First load saved playlists and favorites from disk
      await invoke('load_saved_playlists_and_favorites');
      
      const albums = await invoke<MusicAlbum[]>('scan_music_folder', { folderPath });
      
      // Build all tracks list
      const allTracks: PlaylistTrack[] = [];
      albums.forEach(album => {
        album.tracks.forEach(track => {
          allTracks.push({
            id: track.id,
            file: track.file,
            title: track.title,
            artist: track.artist,
            album: album.name,
            albumPath: album.path,
          });
        });
      });
      
      // Send tracks to backend
      await invoke('set_all_tracks', { tracks: allTracks });
      
      // Load playlist state from backend (now includes persisted favorites)
      const backendState = await invoke<BackendPlaylistState>('get_playlist_state');
      const customPlaylists = await invoke<MusicPlaylist[]>('get_playlists');
      
      // Note: Loop defaults are now handled by backend initialization
      // Don't override user's loop setting when reloading albums
      
      // Build auto playlists
      const allMusicPlaylist: MusicPlaylist = {
        id: 'all-music',
        name: 'All Music',
        isAuto: true,
        tracks: allTracks,
      };
      
      const favoriteTracks = allTracks.filter(t => backendState.favorites.includes(t.id));
      const favoritesPlaylist: MusicPlaylist = {
        id: 'favorites',
        name: 'Favorites',
        isAuto: true,
        tracks: favoriteTracks,
      };
      
      set({ 
        albums, 
        allTracks,
        playlists: [allMusicPlaylist, favoritesPlaylist, ...customPlaylists],
        currentPlaylistId: backendState.currentPlaylistId,
        currentIndex: backendState.currentIndex,
        isShuffled: backendState.isShuffled,
        isLooping: backendState.isLooping,
        favorites: new Set(backendState.favorites),
        interruptedIndex: backendState.interruptedIndex,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading albums:', error);
      set({ isLoading: false });
    }
  },
  
  syncWithBackend: async () => {
    try {
      const backendState = await invoke<BackendPlaylistState>('get_playlist_state');
      const { allTracks } = get();
      
      // Rebuild favorites playlist
      const favoriteTracks = allTracks.filter(t => backendState.favorites.includes(t.id));
      
      set(state => ({
        currentPlaylistId: backendState.currentPlaylistId,
        currentIndex: backendState.currentIndex,
        isShuffled: backendState.isShuffled,
        isLooping: backendState.isLooping,
        favorites: new Set(backendState.favorites),
        interruptedIndex: backendState.interruptedIndex,
        playlists: state.playlists.map(p => 
          p.id === 'favorites' ? { ...p, tracks: favoriteTracks } : p
        ),
      }));
    } catch (error) {
      console.error('Error syncing with backend:', error);
    }
  },
  
  playTrack: async (track: PlaylistTrack) => {
    const filePath = `${track.albumPath}/${track.file}`;
    
    try {
      await invoke('play_music', { 
        filePath,
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
      });
    } catch (error) {
      console.error('Error playing track:', error);
    }
  },
  
  playTrackFromPlaylist: async (playlistId: string, index: number) => {
    const { playlists, albums } = get();
    
    // Get tracks from playlist or album
    let tracks: PlaylistTrack[] = [];
    if (playlistId.startsWith('album-')) {
      const albumName = playlistId.replace('album-', '');
      const album = albums.find(a => a.name === albumName);
      if (album) {
        tracks = album.tracks.map(t => ({
          id: t.id,
          file: t.file,
          title: t.title,
          artist: t.artist,
          album: album.name,
          albumPath: album.path,
        }));
      }
    } else {
      const playlist = playlists.find(p => p.id === playlistId);
      if (playlist) {
        tracks = playlist.tracks;
      }
    }
    
    if (tracks.length === 0 || index < 0 || index >= tracks.length) return;
    
    await invoke('set_current_playlist', { playlistId });
    await invoke('set_playlist_index', { index });
    
    set({ currentPlaylistId: playlistId, currentIndex: index, interruptedIndex: null });
    
    await get().playTrack(tracks[index]);
  },
  
  playNext: async () => {
    const { playNextQueue } = get();
    
    // Check play next queue first (local queue for "Play Next" feature)
    if (playNextQueue.length > 0) {
      const nextTrack = playNextQueue[0];
      set({ playNextQueue: playNextQueue.slice(1) });
      await get().playTrack(nextTrack);
      return;
    }
    
    // Use backend command - it has all the playlist/track data
    try {
      await invoke<boolean>('play_next_track');
      // Sync state after backend plays next track
      await get().syncWithBackend();
    } catch (error) {
      console.error('Error playing next track:', error);
    }
  },
  
  playPrevious: async () => {
    // Use backend command - it has all the playlist/track data
    try {
      await invoke<boolean>('play_previous_track');
      // Sync state after backend plays previous track
      await get().syncWithBackend();
    } catch (error) {
      console.error('Error playing previous track:', error);
    }
  },
  
  setCurrentPlaylist: async (playlistId: string | null) => {
    await invoke('set_current_playlist', { playlistId });
    set({ currentPlaylistId: playlistId, currentIndex: 0, interruptedIndex: null });
  },
  
  toggleShuffle: async () => {
    const newValue = !get().isShuffled;
    await invoke('set_playlist_shuffle', { shuffled: newValue });
    set({ isShuffled: newValue });
  },
  
  toggleLoop: async () => {
    const newValue = !get().isLooping;
    await invoke('set_playlist_loop', { looping: newValue });
    set({ isLooping: newValue });
  },
  
  toggleFavorite: async (trackId: string) => {
    const isFavorite = await invoke<boolean>('toggle_favorite', { trackId });
    
    set(state => {
      const newFavorites = new Set(state.favorites);
      if (isFavorite) {
        newFavorites.add(trackId);
      } else {
        newFavorites.delete(trackId);
      }
      
      // Update favorites playlist
      const favoriteTracks = state.allTracks.filter(t => newFavorites.has(t.id));
      
      return {
        favorites: newFavorites,
        playlists: state.playlists.map(p => 
          p.id === 'favorites' ? { ...p, tracks: favoriteTracks } : p
        ),
      };
    });
  },
  
  addToPlayNextQueue: (track: PlaylistTrack) => {
    set(state => ({ playNextQueue: [...state.playNextQueue, track] }));
  },
  
  playNow: async (track: PlaylistTrack) => {
    const { currentIndex } = get();
    
    // Save current position to resume after this track
    set({ interruptedIndex: currentIndex });
    
    await get().playTrack(track);
  },
  
  createPlaylist: async (name: string, tracks: PlaylistTrack[]) => {
    const id = `playlist-${Date.now()}`;
    const { playlists } = get();
    
    // Validate name
    if (name.toLowerCase() === 'favorites' || name.toLowerCase() === 'all music') {
      throw new Error('Cannot use reserved playlist name');
    }
    
    // Check for duplicate names (case-insensitive)
    const nameExists = playlists.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (nameExists) {
      throw new Error('A playlist with this name already exists');
    }
    
    await invoke('save_playlist', { id, name, tracks });
    
    const newPlaylist: MusicPlaylist = { id, name, isAuto: false, tracks };
    set(state => ({ playlists: [...state.playlists, newPlaylist] }));
  },
  
  deletePlaylist: async (id: string) => {
    await invoke('delete_playlist', { id });
    set(state => ({ 
      playlists: state.playlists.filter(p => p.id !== id),
      currentPlaylistId: state.currentPlaylistId === id ? null : state.currentPlaylistId,
    }));
  },
  
  addToPlaylist: async (playlistId: string, tracks: PlaylistTrack[]) => {
    const { playlists } = get();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist || playlist.isAuto) return;
    
    const newTracks = [...playlist.tracks, ...tracks];
    await invoke('save_playlist', { id: playlistId, name: playlist.name, tracks: newTracks });
    
    set(state => ({
      playlists: state.playlists.map(p => 
        p.id === playlistId ? { ...p, tracks: newTracks } : p
      ),
    }));
  },
  
  updatePlaylist: async (playlistId: string, tracks: PlaylistTrack[]) => {
    const { playlists } = get();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist || playlist.isAuto) return;
    
    await invoke('save_playlist', { id: playlistId, name: playlist.name, tracks });
    
    set(state => ({
      playlists: state.playlists.map(p => 
        p.id === playlistId ? { ...p, tracks } : p
      ),
    }));
  },
  
  getCurrentPlaylist: () => {
    const { currentPlaylistId, playlists } = get();
    return playlists.find(p => p.id === currentPlaylistId) || null;
  },
  
  getAutoPlaylists: () => {
    return get().playlists.filter(p => p.isAuto);
  },
}));
