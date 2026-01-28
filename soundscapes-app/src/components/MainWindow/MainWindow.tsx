import React from 'react';
import { Orb } from './Orb';
import { NowPlaying } from './NowPlaying';
import { VolumeControls } from './VolumeControls';

export const MainWindow: React.FC = () => {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center min-h-0">
          <Orb />
        </div>
        
        <div style={{ padding: '12px' }}>
          <NowPlaying />
        </div>
      </div>
      
      {/* Volume controls sidebar on right */}
      <VolumeControls />
    </div>
  );
};
