import { useEffect } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainWindow } from './components/MainWindow/MainWindow';
import { Orb } from './components/MainWindow/Orb';
import { useSettingsStore } from './stores/settingsStore';
import { useAudioStore } from './stores/audioStore';

function App() {
  const { loadSettings } = useSettingsStore();
  const { initAudio } = useAudioStore();

  useEffect(() => {
    const init = async () => {
      await loadSettings();
      await initAudio();
    };
    init();
  }, []);

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Full-window shader background */}
      <div className="absolute inset-0 z-0">
        <Orb />
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
