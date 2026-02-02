import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Square, Repeat, Shuffle, Music, Waves, ChevronDown } from 'lucide-react';
import { usePlaylistStore } from '../../stores/playlistStore';
import { usePresetStore } from '../../stores/presetStore';
import { useSchedulerStore } from '../../stores/schedulerStore';
import { useAmbientStore } from '../../stores/ambientStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface QuickControlsProps {
  onLoadAmbientPreset: (presetId: string) => Promise<void>;
  onStartSchedule: (scheduleId: string) => Promise<void>;
}

export const QuickControls: React.FC<QuickControlsProps> = ({
  onLoadAmbientPreset,
  onStartSchedule,
}) => {
  const {
    albums,
    playlists,
    currentPlaylistId,
    isShuffled,
    isLooping,
    toggleShuffle,
    toggleLoop,
    setCurrentPlaylist,
    playTrackFromPlaylist,
    loadAlbums,
  } = usePlaylistStore();

  const { presets, loadPresets, currentPresetId } = usePresetStore();
  const { schedules, loadSchedules, isPlaying: isSchedulePlaying, stopSchedule } = useSchedulerStore();
  const { clearAll: clearAmbient } = useAmbientStore();
  const { settings } = useSettingsStore();

  const [musicDropdownOpen, setMusicDropdownOpen] = useState(false);
  const [ambientDropdownOpen, setAmbientDropdownOpen] = useState(false);

  // Load presets, schedules, and albums on mount
  useEffect(() => {
    loadPresets();
    loadSchedules();
  }, [loadPresets, loadSchedules]);

  // Load albums if not already loaded
  useEffect(() => {
    if (settings?.music_folder_path && albums.length === 0 && playlists.length === 0) {
      loadAlbums(settings.music_folder_path);
    }
  }, [settings?.music_folder_path, albums.length, playlists.length, loadAlbums]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.quick-controls-dropdown')) {
        setMusicDropdownOpen(false);
        setAmbientDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Get display name for current music selection
  const getMusicDisplayName = () => {
    if (!currentPlaylistId) return 'Music';
    if (currentPlaylistId.startsWith('album-')) {
      return currentPlaylistId.replace('album-', '');
    }
    const playlist = playlists.find(p => p.id === currentPlaylistId);
    return playlist?.name || 'Music';
  };

  // Get display name for current ambient selection
  const getAmbientDisplayName = () => {
    if (isSchedulePlaying) {
      return 'Schedule Playing';
    }
    if (currentPresetId) {
      const preset = presets.find(p => p.id === currentPresetId);
      return preset?.name || 'Soundscape';
    }
    return 'Soundscape';
  };

  // Handle music selection
  const handleMusicSelect = async (type: 'playlist' | 'album', id: string) => {
    setMusicDropdownOpen(false);
    if (type === 'album') {
      await setCurrentPlaylist(`album-${id}`);
      // Start playing the first track
      const album = albums.find(a => a.name === id);
      if (album && album.tracks.length > 0) {
        await playTrackFromPlaylist(`album-${id}`, 0);
      }
    } else {
      await setCurrentPlaylist(id);
      await playTrackFromPlaylist(id, 0);
    }
  };

  // Handle ambient selection
  const handleAmbientSelect = async (type: 'preset' | 'schedule', id: string) => {
    setAmbientDropdownOpen(false);
    if (type === 'schedule') {
      await onStartSchedule(id);
    } else {
      await onLoadAmbientPreset(id);
    }
  };

  // Stop all playback
  const handleStopAll = async () => {
    try {
      await invoke('stop_music');
      await setCurrentPlaylist(null);
      if (isSchedulePlaying) {
        stopSchedule();
      }
      await clearAmbient();
    } catch (error) {
      console.error('Error stopping all:', error);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Music Dropdown */}
      <div className="relative quick-controls-dropdown" style={{ marginLeft: '4px', marginRight: '4px' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMusicDropdownOpen(!musicDropdownOpen);
            setAmbientDropdownOpen(false);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-text-secondary/60 hover:text-accent-cyan hover:bg-bg-secondary/50 transition-colors text-xs"
          title="Select playlist or album"
        >
          <Music size={14} />
          <span className="max-w-[80px] truncate">{getMusicDisplayName()}</span>
          <ChevronDown size={12} />
        </button>
        
        {musicDropdownOpen && (
          <div className="absolute top-full right-0 mt-1 w-48 bg-bg-primary border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto" style={{ padding: '4px' }}>
            {/* Playlists Section */}
            {playlists.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs text-text-secondary/50 font-semibold border-b border-border">
                  Playlists
                </div>
                {playlists.map(playlist => (
                  <button
                    key={playlist.id}
                    onClick={() => handleMusicSelect('playlist', playlist.id)}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-bg-secondary transition-colors ${
                      currentPlaylistId === playlist.id ? 'text-accent-cyan' : 'text-text-primary'
                    }`}
                  >
                    {playlist.name}
                  </button>
                ))}
              </>
            )}
            
            {/* Albums Section */}
            {albums.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs text-text-secondary/50 font-semibold border-b border-border mt-1">
                  Albums
                </div>
                {albums.map(album => (
                  <button
                    key={album.name}
                    onClick={() => handleMusicSelect('album', album.name)}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-bg-secondary transition-colors ${
                      currentPlaylistId === `album-${album.name}` ? 'text-accent-cyan' : 'text-text-primary'
                    }`}
                  >
                    {album.name}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Stop All Button */}
      <button
        onClick={handleStopAll}
        className="p-1.5 rounded-lg text-text-secondary/60 hover:text-accent-red hover:bg-bg-secondary/50 transition-colors"
        title="Stop all"
      >
        <Square size={14} />
      </button>

      {/* Loop Button */}
      <button
        onClick={toggleLoop}
        className={`p-1.5 rounded-lg transition-colors ${
          isLooping 
            ? 'text-accent-cyan' 
            : 'text-text-secondary/60 hover:text-accent-cyan hover:bg-bg-secondary/50'
        }`}
        title={isLooping ? 'Loop on' : 'Loop off'}
      >
        <Repeat size={14} />
      </button>

      {/* Shuffle Button */}
      <button
        onClick={toggleShuffle}
        className={`p-1.5 rounded-lg transition-colors ${
          isShuffled 
            ? 'text-accent-cyan' 
            : 'text-text-secondary/60 hover:text-accent-cyan hover:bg-bg-secondary/50'
        }`}
        title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
      >
        <Shuffle size={14} />
      </button>

      {/* Ambient Dropdown */}
      <div className="relative quick-controls-dropdown" style={{ marginLeft: '4px', marginRight: '4px' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAmbientDropdownOpen(!ambientDropdownOpen);
            setMusicDropdownOpen(false);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-xs"
          style={{ color: isSchedulePlaying ? '#a855f7' : 'rgba(156, 163, 175, 0.6)' }}
          onMouseEnter={(e) => { if (!isSchedulePlaying) e.currentTarget.style.color = '#a855f7'; }}
          onMouseLeave={(e) => { if (!isSchedulePlaying) e.currentTarget.style.color = 'rgba(156, 163, 175, 0.6)'; }}
          title="Select soundscape or schedule"
        >
          <Waves size={14} />
          <span className="max-w-[80px] truncate">{getAmbientDisplayName()}</span>
          <ChevronDown size={12} />
        </button>
        
        {ambientDropdownOpen && (
          <div className="absolute top-full right-0 mt-1 w-48 bg-bg-primary border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto" style={{ padding: '4px' }}>
            {/* Presets Section */}
            {presets.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs text-text-secondary/50 font-semibold border-b border-border">
                  Soundscapes
                </div>
                {presets.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handleAmbientSelect('preset', preset.id)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-secondary transition-colors"
                    style={{ color: currentPresetId === preset.id && !isSchedulePlaying ? '#a855f7' : undefined }}
                  >
                    {preset.name}
                  </button>
                ))}
              </>
            )}
            
            {/* Schedules Section */}
            {schedules.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs text-text-secondary/50 font-semibold border-b border-border mt-1">
                  Schedules
                </div>
                {schedules.map(schedule => (
                  <button
                    key={schedule.id}
                    onClick={() => handleAmbientSelect('schedule', schedule.id)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-secondary transition-colors text-text-primary"
                  >
                    {schedule.name}
                  </button>
                ))}
              </>
            )}
            
            {presets.length === 0 && schedules.length === 0 && (
              <div className="px-3 py-2 text-sm text-text-secondary/50">
                No presets or schedules
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
