import { useEffect } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainWindow } from './components/MainWindow/MainWindow';
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
    <div className="flex h-screen bg-bg-primary">
      <Sidebar />
      <div className="flex flex-1 overflow-hidden">
        <MainWindow />
      </div>
    </div>
  );
}

export default App;
