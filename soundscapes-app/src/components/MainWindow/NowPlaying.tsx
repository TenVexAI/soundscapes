import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useAudioStore } from '../../stores/audioStore';
import { invoke } from '@tauri-apps/api/core';

interface MusicProgress {
  current_time: number;
  duration: number;
  is_playing: boolean;
  is_finished: boolean;
}

interface CurrentTrackInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  file_path: string;
}

export const NowPlaying: React.FC = () => {
  const { isMusicMuted } = useAudioStore();
  const [currentTrack, setCurrentTrack] = useState<CurrentTrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Poll for current track and progress from backend
  useEffect(() => {
    let mounted = true;
    
    const poll = async () => {
      if (!mounted) return;
      try {
        const [trackInfo, prog] = await Promise.all([
          invoke<CurrentTrackInfo | null>('get_current_track'),
          invoke<MusicProgress>('get_music_progress'),
        ]);
        
        if (mounted) {
          setCurrentTrack(trackInfo);
          setIsPlaying(prog.is_playing);
          setProgress({ currentTime: prog.current_time, duration: prog.duration });
        }
      } catch {
        // Ignore errors during polling
      }
      
      if (mounted) {
        setTimeout(poll, 250);
      }
    };
    
    poll();
    return () => { mounted = false; };
  }, []);

  const togglePlayPause = async () => {
    try {
      if (isPlaying) {
        await invoke('pause_music');
      } else {
        await invoke('resume_music');
      }
    } catch (err) {
      console.error('Error toggling play/pause:', err);
    }
  };

  const playNext = async () => {
    try {
      // Skip to next track by stopping current and letting playlist auto-advance
      await invoke('stop_music');
    } catch (err) {
      console.error('Error skipping track:', err);
    }
  };

  const restartTrack = async () => {
    // Restart current track from beginning by re-playing it
    if (currentTrack) {
      try {
        await invoke('play_music', {
          filePath: currentTrack.file_path,
          id: currentTrack.id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
        });
      } catch (err) {
        console.error('Error restarting track:', err);
      }
    }
  };

  const progressPercent = progress.duration > 0 
    ? (progress.currentTime / progress.duration) * 100 
    : 0;

  const displayPercent = isDragging ? (dragPosition / progress.duration) * 100 : progressPercent;

  const handleSeek = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || progress.duration === 0) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    const seekPosition = percent * progress.duration;
    
    try {
      await invoke('seek_music', { position: seekPosition });
    } catch (err) {
      console.error('Error seeking:', err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || progress.duration === 0) return;
    
    setIsDragging(true);
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    setDragPosition(percent * progress.duration);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moveX = moveEvent.clientX - rect.left;
      const movePercent = Math.max(0, Math.min(1, moveX / rect.width));
      setDragPosition(movePercent * progress.duration);
    };

    const handleMouseUp = async (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      const upX = upEvent.clientX - rect.left;
      const upPercent = Math.max(0, Math.min(1, upX / rect.width));
      const seekPosition = upPercent * progress.duration;
      
      setIsDragging(false);
      
      try {
        await invoke('seek_music', { position: seekPosition });
      } catch (err) {
        console.error('Error seeking:', err);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className={`relative overflow-hidden rounded-xl bg-bg-primary/70 border border-border/50 backdrop-blur-md ${isMusicMuted ? 'opacity-50' : ''}`}>
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent-purple/5 to-accent-cyan/5 pointer-events-none" />
      
      <div className="relative flex items-center gap-4" style={{ padding: '12px' }}>
        {/* Track info */}
        <div className="flex-1 min-w-0 select-none">
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
            onClick={restartTrack}
            disabled={!currentTrack}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30"
            title="Restart track"
          >
            <SkipBack size={18} />
          </button>
          
          <button
            onClick={togglePlayPause}
            disabled={!currentTrack}
            className={`p-2 rounded-lg transition-colors disabled:opacity-30 group ${
              isPlaying 
                ? 'text-text-primary hover:text-accent-red' 
                : 'text-accent-red hover:text-text-primary'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <>
                <Play size={20} className="group-hover:hidden" />
                <Pause size={20} className="hidden group-hover:block" />
              </>
            ) : (
              <>
                <Pause size={20} className="group-hover:hidden" />
                <Play size={20} className="hidden group-hover:block" />
              </>
            )}
          </button>
          
          <button
            onClick={playNext}
            disabled={!currentTrack}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30"
            title="Skip track"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>
      
      {/* Progress bar at bottom - clickable and draggable */}
      {currentTrack && (
        <div 
          ref={progressBarRef}
          className="h-2 bg-bg-primary/50 cursor-pointer group"
          onMouseDown={handleMouseDown}
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-gradient-to-r from-accent-purple to-accent-cyan transition-all duration-100 group-hover:from-accent-purple/80 group-hover:to-accent-cyan/80"
            style={{ width: `${displayPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};
