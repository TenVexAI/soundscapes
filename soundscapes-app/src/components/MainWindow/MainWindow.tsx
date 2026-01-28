import React from 'react';
import { NowPlaying } from './NowPlaying';
import { VolumeControls } from './VolumeControls';

export const MainWindow: React.FC = () => {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main content area - transparent to show shader behind */}
      <div className="flex-1 flex flex-col overflow-hidden justify-end">
        <div style={{ padding: '12px' }}>
          <NowPlaying />
        </div>
      </div>
      
      {/* Volume controls sidebar on right */}
      <VolumeControls />
    </div>
  );
};
