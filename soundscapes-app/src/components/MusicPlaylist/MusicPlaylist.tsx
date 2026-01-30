import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Star, Play, ListPlus, ListStart, Shuffle, Repeat, Plus, Music, Trash2, Square } from 'lucide-react';
import { usePlaylistStore } from '../../stores/playlistStore';
import { invoke } from '@tauri-apps/api/core';

interface MusicProgress {
  current_time: number;
  duration: number;
  is_playing: boolean;
  is_finished: boolean;
}

interface PlaylistTrack {
  id: string;
  file: string;
  title: string;
  artist: string;
  album: string;
  albumPath: string;
}

interface TrackItemProps {
  track: PlaylistTrack;
  isFavorite: boolean;
  onPlay: () => void;
  onPlayNext: () => void;
  onPlayNow: () => void;
  onToggleFavorite: () => void;
}

const TrackItem: React.FC<TrackItemProps> = ({
  track,
  isFavorite,
  onPlay,
  onPlayNext,
  onPlayNow,
  onToggleFavorite,
}) => (
  <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg-secondary/50 group">
    <button
      onClick={onToggleFavorite}
      className={`p-1 rounded ${isFavorite ? 'text-yellow-400' : 'text-text-secondary opacity-0 group-hover:opacity-100'} hover:text-yellow-400 transition-all`}
      title="Toggle favorite"
    >
      <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
    </button>
    
    <div className="flex-1 min-w-0">
      <p className="text-sm text-text-primary truncate">{track.title}</p>
      <p className="text-xs text-text-secondary truncate">{track.artist}</p>
    </div>
    
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={onPlayNext}
        className="p-1.5 rounded text-text-secondary hover:text-accent-cyan hover:bg-bg-secondary"
        title="Play next (after current song)"
      >
        <ListStart size={16} />
      </button>
      <button
        onClick={onPlayNow}
        className="p-1.5 rounded text-text-secondary hover:text-accent-green hover:bg-bg-secondary"
        title="Play now (interrupts current)"
      >
        <Play size={16} />
      </button>
      <button
        onClick={onPlay}
        className="p-1.5 rounded text-text-secondary hover:text-accent-purple hover:bg-bg-secondary"
        title="Play from playlist"
      >
        <ListPlus size={16} />
      </button>
    </div>
  </div>
);

export const MusicPlaylist: React.FC = () => {
  const {
    albums,
    playlists,
    currentPlaylistId,
    isShuffled,
    isLooping,
    favorites,
    playNextQueue,
    playTrack,
    playTrackFromPlaylist,
    addToPlayNextQueue,
    playNow,
    playNext,
    setCurrentPlaylist,
    toggleShuffle,
    toggleLoop,
    toggleFavorite,
    createPlaylist,
    deletePlaylist,
  } = usePlaylistStore();

  const wasPlayingRef = useRef(false);

  // Poll for track finished and auto-advance
  useEffect(() => {
    let mounted = true;
    
    const poll = async () => {
      if (!mounted) return;
      
      try {
        const progress = await invoke<MusicProgress>('get_music_progress');
        
        // Detect when a track finishes (was playing, now finished)
        if (wasPlayingRef.current && progress.is_finished) {
          wasPlayingRef.current = false;
          // Auto-advance to next track
          await playNext();
        } else if (progress.is_playing) {
          wasPlayingRef.current = true;
        }
      } catch {
        // Ignore polling errors
      }
      
      if (mounted) {
        setTimeout(poll, 500);
      }
    };
    
    poll();
    return () => { mounted = false; };
  }, [playNext]);

  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  // Modal states for save/delete confirmations
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleAlbum = (albumName: string) => {
    const newExpanded = new Set(expandedAlbums);
    if (newExpanded.has(albumName)) {
      newExpanded.delete(albumName);
    } else {
      newExpanded.add(albumName);
    }
    setExpandedAlbums(newExpanded);
  };

  // Show toast message temporarily
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    const selectedTracksList: PlaylistTrack[] = [];
    albums.forEach(album => {
      album.tracks.forEach(track => {
        if (selectedTracks.has(track.id)) {
          selectedTracksList.push({
            id: track.id,
            file: track.file,
            title: track.title,
            artist: track.artist,
            album: album.name,
            albumPath: album.path,
          });
        }
      });
    });
    
    try {
      await createPlaylist(newPlaylistName, selectedTracksList);
      showToast(`Playlist "${newPlaylistName}" saved!`);
      setNewPlaylistName('');
      setSelectedTracks(new Set());
      setShowCreateDialog(false);
      setIsSelectMode(false);
    } catch (error) {
      console.error('Error creating playlist:', error);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    const playlist = playlists.find(p => p.id === playlistToDelete);
    const playlistName = playlist?.name || 'Playlist';
    
    try {
      await deletePlaylist(playlistToDelete);
      showToast(`"${playlistName}" deleted`);
      if (selectedPlaylistId === playlistToDelete) {
        setSelectedPlaylistId(null);
      }
    } catch (error) {
      console.error('Error deleting playlist:', error);
    }
    
    setShowDeleteConfirm(false);
    setPlaylistToDelete(null);
  };

  const toggleTrackSelection = (trackId: string) => {
    const newSelected = new Set(selectedTracks);
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId);
    } else {
      newSelected.add(trackId);
    }
    setSelectedTracks(newSelected);
  };

  const currentPlaylist = playlists.find(p => p.id === currentPlaylistId);
  
  // Handle both playlists and albums in selection
  const getSelectedPlaylistOrAlbum = () => {
    if (!selectedPlaylistId) return null;
    
    // Check if it's an album selection
    if (selectedPlaylistId.startsWith('album-')) {
      const albumName = selectedPlaylistId.replace('album-', '');
      const album = albums.find(a => a.name === albumName);
      if (album) {
        return {
          id: selectedPlaylistId,
          name: album.name,
          isAuto: true, // Treat as auto so it can't be deleted
          tracks: album.tracks.map(track => ({
            id: track.id,
            file: track.file,
            title: track.title,
            artist: track.artist,
            album: album.name,
            albumPath: album.path,
          })),
        };
      }
    }
    
    return playlists.find(p => p.id === selectedPlaylistId);
  };
  
  const selectedPlaylist = getSelectedPlaylistOrAlbum();

  return (
    <div className="flex flex-col h-full" style={{ padding: '8px 8px 8px 10px' }}>
      {/* Header with controls */}
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <h2 className="text-lg font-semibold text-text-primary">Music</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              await invoke('stop_music');
              setCurrentPlaylist(null);
            }}
            className="p-2 rounded-lg transition-colors text-text-secondary hover:text-accent-red hover:bg-bg-secondary"
            title="Stop playback"
          >
            <Square size={18} />
          </button>
          <button
            onClick={toggleLoop}
            className={`p-2 rounded-lg transition-colors ${
              isLooping ? 'text-accent-cyan' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
            }`}
            title="Toggle loop"
          >
            <Repeat size={18} />
          </button>
          <button
            onClick={toggleShuffle}
            className={`p-2 rounded-lg transition-colors ${
              isShuffled ? 'text-accent-cyan' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
            }`}
            title="Toggle shuffle"
          >
            <Shuffle size={18} />
          </button>
        </div>
      </div>

      {/* Playlist selector */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <select
            value={selectedPlaylistId || ''}
            onChange={(e) => setSelectedPlaylistId(e.target.value || null)}
            className="flex-1 bg-bg-secondary text-text-primary text-sm rounded-lg p-2 border border-border"
          >
            <option value="">Library View</option>
            <optgroup label="Playlists">
              {playlists.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.id === currentPlaylistId ? '▶' : ''} ({p.tracks.length})
                </option>
              ))}
            </optgroup>
            <optgroup label="Albums">
              {albums.map(album => (
                <option key={`album-${album.name}`} value={`album-${album.name}`}>
                  {album.name} ({album.tracks.length})
                </option>
              ))}
            </optgroup>
          </select>
          <button
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedTracks(new Set());
            }}
            className={`p-2 rounded-lg transition-colors ${
              isSelectMode ? 'text-accent-green' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
            }`}
            title="Create playlist"
          >
            <Plus size={18} />
          </button>
        </div>
        
        {/* Current playlist indicator */}
        {currentPlaylist && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-accent-purple/10 rounded-lg text-sm">
            <Music size={14} className="text-accent-purple" />
            <span className="text-text-secondary">Playing:</span>
            <span className="text-text-primary font-medium truncate">{currentPlaylist.name}</span>
          </div>
        )}
      </div>

      {/* Select mode bar */}
      {isSelectMode && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-accent-green/10 rounded-lg">
          <span className="text-sm text-text-secondary">{selectedTracks.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => setShowCreateDialog(true)}
            disabled={selectedTracks.size === 0}
            className="px-3 py-1 text-sm bg-accent-green/20 text-accent-green hover:bg-accent-green hover:text-white rounded-lg disabled:opacity-50"
          >
            Create Playlist
          </button>
          <button
            onClick={() => {
              setIsSelectMode(false);
              setSelectedTracks(new Set());
            }}
            className="px-3 py-1 text-sm text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto" style={{ paddingRight: '4px' }}>
        {selectedPlaylistId && selectedPlaylist ? (
          // Playlist view
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-primary">{selectedPlaylist.name}</h3>
              <div className="flex items-center gap-1">
                {currentPlaylistId !== selectedPlaylistId && selectedPlaylist && selectedPlaylist.tracks.length > 0 && (
                  <button
                    onClick={async () => {
                      if (selectedPlaylistId.startsWith('album-')) {
                        // For albums, just play the first track
                        await playTrack(selectedPlaylist.tracks[0]);
                      } else {
                        // For playlists, set the playlist and play from index 0
                        await playTrackFromPlaylist(selectedPlaylistId, 0);
                      }
                    }}
                    className="px-2 py-1 text-xs bg-accent-purple/20 text-accent-purple hover:bg-accent-purple hover:text-white rounded"
                  >
                    Play All
                  </button>
                )}
                {!selectedPlaylist.isAuto && (
                  <button
                    onClick={() => {
                      setPlaylistToDelete(selectedPlaylistId);
                      setShowDeleteConfirm(true);
                    }}
                    className="p-1 text-text-secondary hover:text-accent-red"
                    title="Delete playlist"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            {selectedPlaylist.tracks.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-4">No tracks in this playlist</p>
            ) : (
              <div className="space-y-0.5">
                {selectedPlaylist.tracks.map((track, index) => (
                  <TrackItem
                    key={track.id}
                    track={track}
                    isFavorite={favorites.has(track.id)}
                    onPlay={() => playTrackFromPlaylist(selectedPlaylistId, index)}
                    onPlayNext={() => addToPlayNextQueue(track)}
                    onPlayNow={() => playNow(track)}
                    onToggleFavorite={() => toggleFavorite(track.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          // Album/library view
          albums.map((album) => (
            <div key={album.name} className="mb-2">
              <button
                onClick={() => toggleAlbum(album.name)}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-bg-secondary transition-colors"
              >
                {expandedAlbums.has(album.name) ? (
                  <ChevronDown size={20} className="text-text-secondary" />
                ) : (
                  <ChevronRight size={20} className="text-text-secondary" />
                )}
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-text-primary">{album.name}</p>
                  <p className="text-xs text-text-secondary">
                    {album.artist} • {album.tracks.length} tracks
                  </p>
                </div>
              </button>
              
              {expandedAlbums.has(album.name) && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {album.tracks.map((track) => {
                    const fullTrack: PlaylistTrack = {
                      id: track.id,
                      file: track.file,
                      title: track.title,
                      artist: track.artist,
                      album: album.name,
                      albumPath: album.path,
                    };
                    
                    return isSelectMode ? (
                      <div
                        key={track.id}
                        onClick={() => toggleTrackSelection(track.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${
                          selectedTracks.has(track.id) ? 'bg-accent-green/20' : 'hover:bg-bg-secondary/50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border ${
                          selectedTracks.has(track.id) ? 'bg-accent-green border-accent-green' : 'border-text-secondary'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{track.title}</p>
                          <p className="text-xs text-text-secondary truncate">{track.artist}</p>
                        </div>
                      </div>
                    ) : (
                      <TrackItem
                        key={track.id}
                        track={fullTrack}
                        isFavorite={favorites.has(track.id)}
                        onPlay={() => playTrack(fullTrack)}
                        onPlayNext={() => addToPlayNextQueue(fullTrack)}
                        onPlayNow={() => playNow(fullTrack)}
                        onToggleFavorite={() => toggleFavorite(track.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Play Next Queue */}
      {playNextQueue.length > 0 && (
        <div className="border-t border-border pt-2 mt-2">
          <h3 className="text-sm font-medium text-text-secondary mb-2 px-2">
            Up Next ({playNextQueue.length})
          </h3>
          <div className="max-h-24 overflow-y-auto space-y-1">
            {playNextQueue.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                className="flex items-center gap-2 p-2 rounded-lg bg-bg-secondary/30"
              >
                <span className="text-xs text-text-secondary w-4">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{track.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create playlist dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-primary rounded-xl border border-border p-4 w-80">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Create Playlist</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name"
              className="w-full bg-bg-secondary text-text-primary rounded-lg p-2 mb-4 border border-border"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 py-2 text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                className="flex-1 py-2 bg-accent-purple/20 text-accent-purple hover:bg-accent-purple hover:text-white rounded-lg disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && playlistToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-primary rounded-xl border border-border p-4 w-80">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Delete Playlist?</h3>
            <p className="text-sm text-text-secondary mb-4">
              Are you sure you want to delete "{playlists.find(p => p.id === playlistToDelete)?.name}"? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setPlaylistToDelete(null);
                }}
                className="flex-1 py-2 text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlaylist}
                className="flex-1 py-2 bg-accent-red/20 text-accent-red hover:bg-accent-red hover:text-white rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-bg-secondary border border-border rounded-lg px-4 py-2 shadow-lg z-50">
          <p className="text-sm text-text-primary">{toastMessage}</p>
        </div>
      )}
    </div>
  );
};
