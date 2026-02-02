import React, { useCallback } from 'react';
import { AudioWaveform } from 'lucide-react';
import { NowPlaying } from './NowPlaying';
import { VolumeControls } from './VolumeControls';
import { QuickControls } from './QuickControls';
import { getVisualizationList } from '../../visualizations';
import { useSettingsStore } from '../../stores/settingsStore';
import { usePresetStore } from '../../stores/presetStore';
import { useSchedulerStore } from '../../stores/schedulerStore';
import { useAmbientStore } from '../../stores/ambientStore';
import { AmbientSound } from '../../types';

const DEFAULT_REVERB_TYPE: 'off' | 'small-room' | 'large-hall' | 'cathedral' = 'off';

export const MainWindow: React.FC = () => {
  const { settings, updateSetting } = useSettingsStore();
  const { loadPreset, setCurrentPresetId } = usePresetStore();
  const { loadSchedule, startSchedule, setCurrentScheduleId } = useSchedulerStore();
  const { clearAll, loadSoundWithSettings, transitionToSounds } = useAmbientStore();
  
  const vizList = getVisualizationList();
  const currentVizId = settings?.visualization_type || 'orb';

  const cycleVisualization = () => {
    const currentIndex = vizList.findIndex(v => v.id === currentVizId);
    const nextIndex = (currentIndex + 1) % vizList.length;
    const nextVizId = vizList[nextIndex].id;
    updateSetting('visualization_type', nextVizId);
  };

  // Handle loading an ambient preset from quick controls
  const handleLoadAmbientPreset = useCallback(async (presetId: string) => {
    try {
      const preset = await loadPreset(presetId);
      setCurrentPresetId(presetId);
      
      // Clear existing sounds first
      await clearAll();
      
      // Small delay to let clearAll complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Load each sound from the preset
      for (let i = 0; i < preset.sounds.length; i++) {
        const presetSound = preset.sounds[i];
        const sound: AmbientSound = {
          id: presetSound.soundId,
          name: presetSound.name,
          categoryId: presetSound.categoryId,
          categoryPath: presetSound.categoryPath,
          filesA: presetSound.filesA,
          filesB: presetSound.filesB,
          enabled: presetSound.enabled,
          volume: presetSound.volume,
          pitch: presetSound.pitch,
          pan: presetSound.pan,
          lowPassFreq: presetSound.lowPassFreq,
          reverbType: DEFAULT_REVERB_TYPE,
          algorithmicReverb: presetSound.algorithmicReverb,
          repeatRangeMin: presetSound.repeatRangeMin,
          repeatRangeMax: presetSound.repeatRangeMax,
          pauseRangeMin: presetSound.pauseRangeMin,
          pauseRangeMax: presetSound.pauseRangeMax,
          volumeVariation: presetSound.volumeVariation,
        };
        
        await loadSoundWithSettings(sound);
        
        if (i < preset.sounds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
    } catch (error) {
      console.error('Error loading preset:', error);
    }
  }, [loadPreset, setCurrentPresetId, clearAll, loadSoundWithSettings]);

  // Handle starting a schedule from quick controls
  const handleStartSchedule = useCallback(async (scheduleId: string) => {
    try {
      await loadSchedule(scheduleId);
      setCurrentScheduleId(scheduleId);
      
      // Get the schedule items and load the first preset using smart transitions
      const { editingItems } = useSchedulerStore.getState();
      if (editingItems.length > 0) {
        const firstPreset = await loadPreset(editingItems[0].presetId);
        
        // Build sounds list for transition
        const newSounds: AmbientSound[] = firstPreset.sounds.map(presetSound => ({
          id: presetSound.soundId,
          name: presetSound.name,
          categoryId: presetSound.categoryId,
          categoryPath: presetSound.categoryPath,
          filesA: presetSound.filesA,
          filesB: presetSound.filesB,
          enabled: presetSound.enabled,
          volume: presetSound.volume,
          pitch: presetSound.pitch,
          pan: presetSound.pan,
          lowPassFreq: presetSound.lowPassFreq,
          reverbType: DEFAULT_REVERB_TYPE,
          algorithmicReverb: presetSound.algorithmicReverb,
          repeatRangeMin: presetSound.repeatRangeMin,
          repeatRangeMax: presetSound.repeatRangeMax,
          pauseRangeMin: presetSound.pauseRangeMin,
          pauseRangeMax: presetSound.pauseRangeMax,
          volumeVariation: presetSound.volumeVariation,
        }));
        
        await transitionToSounds(newSounds);
        startSchedule();
      }
    } catch (error) {
      console.error('Error starting schedule:', error);
    }
  }, [loadSchedule, setCurrentScheduleId, loadPreset, transitionToSounds, startSchedule]);

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
      
      {/* Quick controls - absolutely positioned to the left of volume controls */}
      <div className="absolute flex items-center gap-2" style={{ top: '10px', right: '152px' }}>
        <QuickControls
          onLoadAmbientPreset={handleLoadAmbientPreset}
          onStartSchedule={handleStartSchedule}
        />
        
        {/* Visualization toggle button */}
        <button
          onClick={cycleVisualization}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'rgba(156, 163, 175, 0.6)' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#22c55e'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(156, 163, 175, 0.6)'}
          title={`Visualization: ${vizList.find(v => v.id === currentVizId)?.name || currentVizId}`}
        >
          <AudioWaveform size={18} />
        </button>
      </div>
    </div>
  );
};
