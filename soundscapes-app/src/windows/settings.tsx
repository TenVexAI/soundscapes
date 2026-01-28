import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '../App.css';
import { AdvancedSettings } from '../components/AdvancedSettings/AdvancedSettings';
import { useSettingsStore } from '../stores/settingsStore';

function SettingsWindow() {
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div className="h-screen bg-bg-primary overflow-hidden">
      <AdvancedSettings />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsWindow />
  </React.StrictMode>
);
