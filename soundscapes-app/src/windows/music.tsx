import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../App.css';
import { MusicPlaylist } from '../components/MusicPlaylist/MusicPlaylist';
import { useSettingsStore } from '../stores/settingsStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useAudioStore } from '../stores/audioStore';

function MusicWindow() {
  const { settings, loadSettings } = useSettingsStore();
  const { loadAlbums } = usePlaylistStore();
  const { initAudio } = useAudioStore();

  useEffect(() => {
    const init = async () => {
      await loadSettings();
      await initAudio();
    };
    init();
  }, []);

  useEffect(() => {
    if (settings) {
      loadAlbums(settings.music_folder_path);
    }
  }, [settings]);

  return (
    <div className="h-screen bg-bg-primary overflow-hidden">
      <MusicPlaylist />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MusicWindow />
  </React.StrictMode>
);
