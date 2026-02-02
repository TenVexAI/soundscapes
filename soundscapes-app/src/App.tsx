import { useEffect } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainWindow } from './components/MainWindow/MainWindow';
import { Visualizer } from './components/MainWindow/Visualizer';
import { useSettingsStore } from './stores/settingsStore';
import { useAudioStore } from './stores/audioStore';
import { usePersistentPlayback } from './hooks/usePersistentPlayback';

function App() {
  const { loadSettings } = useSettingsStore();
  const { initAudio, loadVolumesFromSettings } = useAudioStore();

  // Persistent playback hooks - always running regardless of which windows are open
  usePersistentPlayback();

  useEffect(() => {
    const init = async () => {
      const settings = await loadSettings();
      if (settings) {
        loadVolumesFromSettings(settings);
      }
      await initAudio();
    };
    init();
  }, []);

  return (
    <div className="relative h-screen overflow-hidden bg-black">
      {/* Full-window shader background */}
      <div className="absolute inset-0 z-0">
        <Visualizer />
      </div>
      
      {/* UI layer on top */}
      <div className="relative z-10 flex h-full">
        <Sidebar />
        <div className="flex flex-1 overflow-hidden">
          <MainWindow />
        </div>
      </div>
    </div>
  );
}

export default App;
