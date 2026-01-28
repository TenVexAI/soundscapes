import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../App.css';
import { AmbientSoundscapes } from '../components/AmbientSoundscapes/AmbientSoundscapes';
import { useSettingsStore } from '../stores/settingsStore';
import { useAmbientStore } from '../stores/ambientStore';
import { useAudioStore } from '../stores/audioStore';

function AmbientWindow() {
  const { settings, loadSettings } = useSettingsStore();
  const { loadCategories } = useAmbientStore();
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
      loadCategories(settings.ambient_folder_path);
    }
  }, [settings]);

  return (
    <div className="h-screen bg-bg-primary overflow-hidden">
      <AmbientSoundscapes />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AmbientWindow />
  </React.StrictMode>
);
