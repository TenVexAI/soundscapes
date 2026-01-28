import React from 'react';
import { Orb } from './Orb';
import { NowPlaying } from './NowPlaying';
import { VolumeControls } from './VolumeControls';

export const MainWindow: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      <div className="flex-1 flex items-center justify-center min-h-0">
        <Orb />
      </div>
      
      <div className="space-y-4 mt-6 mb-2">
        <NowPlaying />
        <VolumeControls />
      </div>
    </div>
  );
};
