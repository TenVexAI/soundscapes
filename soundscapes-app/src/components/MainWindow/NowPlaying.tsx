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

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

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
    <div className={`p-5 bg-bg-secondary/50 rounded-2xl border border-border backdrop-blur-sm ${isMusicMuted ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 bg-bg-secondary rounded-xl flex items-center justify-center shadow-lg">
          <Music size={32} className="text-accent-purple" />
        </div>
        
        <div className="flex-1 min-w-0">
          {currentTrack ? (
            <>
              <h3 className="text-lg font-semibold text-text-primary truncate">
                {currentTrack.title}
              </h3>
              <p className="text-sm text-text-secondary truncate">
                {currentTrack.artist} • {currentTrack.album}
              </p>
              
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary w-10">
                    {formatTime(progress.currentTime)}
                  </span>
                  <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent-purple rounded-full transition-all duration-100"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-secondary w-10 text-right">
                    {formatTime(progress.duration)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-text-secondary">
                No track playing
              </h3>
              <p className="text-sm text-text-secondary">
                Select a track to play
              </p>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={playPrevious}
            className="p-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
            title="Previous"
          >
            <SkipBack size={24} />
          </button>
          
          <button
            onClick={togglePlayPause}
            className="p-3.5 rounded-full bg-accent-purple text-bg-primary hover:bg-accent-purple/80 transition-colors shadow-lg"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          
          <button
            onClick={playNext}
            className="p-2.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
            title="Next"
          >
            <SkipForward size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
