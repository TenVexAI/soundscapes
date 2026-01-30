import React, { useState, useEffect } from 'react';
import { AudioWaveform } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { NowPlaying } from './NowPlaying';
import { VolumeControls } from './VolumeControls';
import { getVisualizationList } from '../../visualizations';

export const MainWindow: React.FC = () => {
  const [currentVizId, setCurrentVizId] = useState<string>('orb');
  const vizList = getVisualizationList();

  // Poll current visualization from backend
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      if (!mounted) return;
      try {
        const settings = await invoke<{ visualization_type?: string }>('get_settings');
        if (settings?.visualization_type) {
          setCurrentVizId(settings.visualization_type);
        }
      } catch { /* ignore polling errors */ }
      if (mounted) setTimeout(poll, 500);
    };
    poll();
    return () => { mounted = false; };
  }, []);

  const cycleVisualization = async () => {
    const currentIndex = vizList.findIndex(v => v.id === currentVizId);
    const nextIndex = (currentIndex + 1) % vizList.length;
    const nextVizId = vizList[nextIndex].id;
    setCurrentVizId(nextVizId);
    try {
      await invoke('update_setting', { key: 'visualization_type', value: nextVizId });
    } catch (err) {
      console.error('Failed to update visualization:', err);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Main content area - transparent to show shader behind */}
      <div className="flex-1 flex flex-col overflow-hidden justify-end">
        <div style={{ padding: '12px' }}>
          <NowPlaying />
        </div>
      </div>
      
      {/* Volume controls sidebar on right */}
      <VolumeControls />
      
      {/* Visualization toggle button - absolutely positioned to the left of volume controls, level with icons */}
      <button
        onClick={cycleVisualization}
        className="absolute p-1.5 rounded-lg text-text-secondary/60 hover:text-accent-cyan transition-colors"
        style={{ top: '12px', right: '152px' }}
        title={`Visualization: ${vizList.find(v => v.id === currentVizId)?.name || currentVizId}`}
      >
        <AudioWaveform size={18} />
      </button>
    </div>
  );
};
