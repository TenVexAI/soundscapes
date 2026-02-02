import { useEffect } from 'react';
import { usePlaylistStore } from '../stores/playlistStore';
import { useSchedulerStore } from '../stores/schedulerStore';

/**
 * Hook that syncs frontend state with backend for both music playlists and ambient schedules.
 * All playback logic (auto-advance, scheduler tick, preset loading) is handled by the Rust backend.
 * This hook only polls the backend to keep the UI in sync.
 */
export function usePersistentPlayback() {
  const { syncWithBackend: syncPlaylist } = usePlaylistStore();
  const { syncWithBackend: syncScheduler } = useSchedulerStore();

  // Sync playlist state with backend periodically (for current track info updates)
  useEffect(() => {
    let mounted = true;
    
    const poll = async () => {
      if (!mounted) return;
      
      try {
        await syncPlaylist();
      } catch {
        // Ignore errors during polling
      }
      
      if (mounted) {
        setTimeout(poll, 500);
      }
    };
    
    poll();
    return () => { mounted = false; };
  }, [syncPlaylist]);

  // Sync scheduler state with backend every second
  useEffect(() => {
    let mounted = true;
    
    const poll = async () => {
      if (!mounted) return;
      
      try {
        await syncScheduler();
      } catch {
        // Ignore errors during polling
      }
      
      if (mounted) {
        setTimeout(poll, 1000);
      }
    };
    
    poll();
    return () => { mounted = false; };
  }, [syncScheduler]);
}
