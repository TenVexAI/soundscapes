import React, { useEffect, useState } from 'react';
import { FolderOpen, RefreshCw, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePlaylistStore } from '../../stores/playlistStore';
import { useAmbientStore } from '../../stores/ambientStore';
import { useSoundboardStore } from '../../stores/soundboardStore';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getVisualizationList } from '../../visualizations';

interface AudioDevice {
  id: string;
  name: string;
  is_default: boolean;
}

interface FolderSettingProps {
  label: string;
  path: string;
  onChangePath: (newPath: string) => void;
}

const FolderSetting: React.FC<FolderSettingProps> = ({ label, path, onChangePath }) => {
  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: `Select ${label} Folder`,
      });
      
      if (selected && typeof selected === 'string') {
        onChangePath(selected);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm text-text-secondary">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={path}
          readOnly
          className="flex-1 px-3 py-2 bg-bg-secondary rounded-lg text-text-primary text-sm border border-border focus:outline-none focus:border-accent-purple"
        />
        <button
          onClick={handleBrowse}
          className="px-3 py-2 bg-bg-secondary rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary/80 transition-colors"
          title="Browse"
        >
          <FolderOpen size={20} />
        </button>
      </div>
    </div>
  );
};

export const AdvancedSettings: React.FC = () => {
  const { settings, updateSetting, loadSettings } = useSettingsStore();
  const { loadAlbums } = usePlaylistStore();
  const { loadCategories } = useAmbientStore();
  const { loadSounds } = useSoundboardStore();
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await invoke<AudioDevice[]>('get_output_devices');
        setOutputDevices(devices);
        const defaultDevice = devices.find(d => d.is_default);
        if (defaultDevice) {
          setSelectedDevice(defaultDevice.id);
        }
      } catch (error) {
        console.error('Failed to load output devices:', error);
      }
    };
    loadDevices();
  }, []);

  // Sync crossfade duration to backend when settings load
  useEffect(() => {
    if (settings?.music_crossfade_duration !== undefined) {
      invoke('set_crossfade_duration', { duration: settings.music_crossfade_duration });
    }
  }, [settings?.music_crossfade_duration]);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-secondary">Loading settings...</p>
      </div>
    );
  }

  const handleRefresh = async () => {
    await loadAlbums(settings.music_folder_path);
    await loadCategories(settings.ambient_folder_path);
    await loadSounds(settings.soundboard_folder_path);
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await loadSettings();
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ padding: '8px 8px 8px 10px' }}>
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6" style={{ paddingRight: '4px' }}>
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-4">Folder Locations</h3>
          <div className="space-y-4">
            <FolderSetting
              label="Music Albums"
              path={settings.music_folder_path}
              onChangePath={(path) => updateSetting('music_folder_path', path)}
            />
            <FolderSetting
              label="Ambient Sounds"
              path={settings.ambient_folder_path}
              onChangePath={(path) => updateSetting('ambient_folder_path', path)}
            />
            <FolderSetting
              label="Soundboard"
              path={settings.soundboard_folder_path}
              onChangePath={(path) => updateSetting('soundboard_folder_path', path)}
            />
            <FolderSetting
              label="Presets"
              path={settings.presets_folder_path}
              onChangePath={(path) => updateSetting('presets_folder_path', path)}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-text-primary mb-4">Display</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Visualization</label>
              <select
                value={settings.visualization_type || 'orb'}
                onChange={(e) => updateSetting('visualization_type', e.target.value)}
                className="w-full px-3 py-2 bg-bg-secondary rounded-lg text-text-primary text-sm border border-border focus:outline-none focus:border-accent-purple"
              >
                {getVisualizationList().map((viz) => (
                  <option key={viz.id} value={viz.id}>
                    {viz.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-secondary mt-1">
                {getVisualizationList().find(v => v.id === (settings.visualization_type || 'orb'))?.description}
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-text-primary mb-4">Audio Settings</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Output Device</label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full px-3 py-2 bg-bg-secondary rounded-lg text-text-primary text-sm border border-border focus:outline-none focus:border-accent-purple"
              >
                {outputDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}{device.is_default ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-text-secondary">Music Crossfade Duration</span>
                <span className="text-text-primary">{settings.music_crossfade_duration}s</span>
              </div>
              <div style={{ position: 'relative', height: '24px' }}>
                <div style={{ position: 'absolute', top: '8px', left: 0, right: 0, height: '8px', borderRadius: '4px', backgroundColor: '#313131' }} />
                <div style={{ position: 'absolute', top: '8px', left: 0, height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #12e6c8, #a287f4)', width: `${(settings.music_crossfade_duration / 10) * 100}%` }} />
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={settings.music_crossfade_duration}
                  onChange={(e) => {
                    const duration = Number(e.target.value);
                    updateSetting('music_crossfade_duration', duration);
                    invoke('set_crossfade_duration', { duration });
                  }}
                  style={{ position: 'relative', width: '100%', height: '24px', background: 'transparent', cursor: 'pointer' }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-text-secondary">Soundboard Duck Amount</span>
                <span className="text-text-primary">{Math.round(settings.soundboard_duck_amount * 100)}%</span>
              </div>
              <div style={{ position: 'relative', height: '24px' }}>
                <div style={{ position: 'absolute', top: '8px', left: 0, right: 0, height: '8px', borderRadius: '4px', backgroundColor: '#313131' }} />
                <div style={{ position: 'absolute', top: '8px', left: 0, height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #12e6c8, #a287f4)', width: `${settings.soundboard_duck_amount * 100}%` }} />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.soundboard_duck_amount * 100}
                  onChange={(e) => updateSetting('soundboard_duck_amount', Number(e.target.value) / 100)}
                  style={{ position: 'relative', width: '100%', height: '24px', background: 'transparent', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent-purple text-bg-primary rounded-lg hover:bg-accent-purple/80 transition-colors"
          >
            <RefreshCw size={20} />
            <span>Refresh All Folders</span>
          </button>
          
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-bg-secondary text-text-secondary rounded-lg hover:text-accent-red hover:bg-bg-secondary/80 transition-colors"
          >
            <RotateCcw size={20} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
