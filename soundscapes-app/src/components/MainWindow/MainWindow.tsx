import React from 'react';
import { AudioWaveform } from 'lucide-react';
import { NowPlaying } from './NowPlaying';
import { VolumeControls } from './VolumeControls';
import { getVisualizationList } from '../../visualizations';
import { useSettingsStore } from '../../stores/settingsStore';

export const MainWindow: React.FC = () => {
  const { settings, updateSetting } = useSettingsStore();
  const vizList = getVisualizationList();
  const currentVizId = settings?.visualization_type || 'orb';

  const cycleVisualization = () => {
    const currentIndex = vizList.findIndex(v => v.id === currentVizId);
    const nextIndex = (currentIndex + 1) % vizList.length;
    const nextVizId = vizList[nextIndex].id;
    updateSetting('visualization_type', nextVizId);
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
