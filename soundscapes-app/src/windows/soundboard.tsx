import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../App.css';
import { Soundboard } from '../components/Soundboard/Soundboard';
import { useSettingsStore } from '../stores/settingsStore';
import { useSoundboardStore } from '../stores/soundboardStore';
import { useAudioStore } from '../stores/audioStore';

function SoundboardWindow() {
  const { settings, loadSettings } = useSettingsStore();
  const { loadSounds } = useSoundboardStore();
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
      loadSounds(settings.soundboard_folder_path);
    }
  }, [settings]);

  return (
    <div className="h-screen bg-bg-primary overflow-hidden">
      <Soundboard />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SoundboardWindow />
  </React.StrictMode>
);
