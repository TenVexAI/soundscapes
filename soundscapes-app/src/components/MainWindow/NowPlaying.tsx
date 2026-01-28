import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music } from 'lucide-react';
import { usePlaylistStore } from '../../stores/playlistStore';
import { useAudioStore } from '../../stores/audioStore';
import { invoke } from '@tauri-apps/api/core';

interface MusicProgress {
  current_time: number;
  duration: number;
  is_playing: boolean;
  is_finished: boolean;
}

export const NowPlaying: React.FC = () => {
  const { currentTrack, isPlaying, togglePlayPause, playNext, playPrevious } = usePlaylistStore();
  const { isMusicMuted } = useAudioStore();
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });

  useEffect(() => {
    if (!currentTrack) return;
    
    const interval = setInterval(async () => {
      try {
        const prog = await invoke<MusicProgress>('get_music_progress');
        setProgress({ currentTime: prog.current_time, duration: prog.duration });
        
        if (prog.is_finished && isPlaying) {
          playNext();
        }
      } catch (error) {
        console.error('Error getting progress:', error);
      }
    }, 250);
    
    return () => clearInterval(interval);
  }, [currentTrack, isPlaying, playNext]);

  const progressPercent = progress.duration > 0 
    ? (progress.currentTime / progress.duration) * 100 
    : 0;

  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-r from-bg-secondary/80 to-bg-secondary/40 border border-border/50 backdrop-blur-md ${isMusicMuted ? 'opacity-50' : ''}`}>
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent-purple/5 to-accent-cyan/5 pointer-events-none" />
      
      <div className="relative flex items-center gap-4" style={{ padding: '12px' }}>
        {/* Album art placeholder */}
        <div className="w-12 h-12 bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Music size={24} className="text-accent-purple" />
        </div>
        
        {/* Track info */}
        <div className="flex-1 min-w-0">
          {currentTrack ? (
            <>
              <h3 className="text-sm font-semibold text-text-primary truncate">
                {currentTrack.title}
              </h3>
              <p className="text-xs text-text-secondary truncate">
                {currentTrack.artist} • {currentTrack.album}
              </p>
            </>
          ) : (
            <>
              <h3 className="text-sm font-medium text-text-secondary">
                No track playing
              </h3>
              <p className="text-xs text-text-secondary/70">
                Select a track to play
              </p>
            </>
          )}
        </div>
        
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={playPrevious}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all"
            title="Previous"
          >
            <SkipBack size={18} />
          </button>
          
          <button
            onClick={togglePlayPause}
            className="p-2.5 rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan text-bg-primary hover:opacity-90 transition-all shadow-lg shadow-accent-purple/20"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          
          <button
            onClick={playNext}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all"
            title="Next"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>
      
      {/* Progress bar at bottom */}
      {currentTrack && (
        <div className="h-1 bg-bg-primary/50">
          <div 
            className="h-full bg-gradient-to-r from-accent-purple to-accent-cyan transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};
