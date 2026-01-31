import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, ChevronsUpDown, Check, Square, Volume2, Eye, EyeOff, Trash2, Info, RotateCcw, Save, XCircle, FilePlus, Calendar } from 'lucide-react';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { useAmbientStore } from '../../stores/ambientStore';
import { usePresetStore } from '../../stores/presetStore';
import { useSchedulerStore } from '../../stores/schedulerStore';
import { Scheduler } from './Scheduler';
import { AmbientSoundDef, AmbientSound, DEFAULT_AMBIENT_SETTINGS } from '../../types';

// Info descriptions for each setting
const settingInfo: Record<string, string> = {
  volume: 'Controls the loudness of this sound. 0% is silent, 100% is full volume.',
  pitch: 'Adjusts playback speed. Lower values slow down and deepen the sound, higher values speed up and raise pitch.',
  pan: 'Left/Right stereo balance. Negative values pan left, positive values pan right, 0 is centered.',
  lowPassFreq: 'Filters out high frequencies above this value. Lower values create a muffled effect. 22kHz = no filtering.',
  volumeVariation: 'Adds random volume changes each loop. Higher values create more dynamic variation.',
  repeatRange: 'Number of A/B file cycles before pausing. Random value chosen between min and max each cycle.',
  pauseRange: 'Number of pause cycles between repeats. 0 means no pause. Random value chosen between min and max.',
};

// Tooltip component
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="p-0.5 text-text-secondary/50 hover:text-text-secondary transition-colors"
      >
        <Info size={12} />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 text-xs bg-bg-primary border border-border rounded-lg shadow-lg w-48 text-text-secondary">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-border" />
        </div>
      )}
    </div>
  );
};

// Styled slider component
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
  info?: string;
  disabled?: boolean;
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step = 1, onChange, formatValue, info, disabled = false }) => {
  const percent = ((value - min) / (max - min)) * 100;
  
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center gap-1">
          <span className="text-text-secondary">{label}</span>
          {info && <InfoTooltip text={info} />}
        </div>
        <span className="text-text-primary font-medium">{formatValue(value)}</span>
      </div>
      <div style={{ position: 'relative', height: '24px' }}>
        <div style={{ position: 'absolute', top: '8px', left: 0, right: 0, height: '8px', borderRadius: '4px', backgroundColor: '#313131' }} />
        <div style={{ position: 'absolute', top: '8px', left: 0, height: '8px', borderRadius: '4px', background: disabled ? '#666' : 'linear-gradient(to right, #12e6c8, #a287f4)', width: `${percent}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => !disabled && onChange(Number(e.target.value))}
          disabled={disabled}
          style={{ position: 'relative', width: '100%', height: '24px', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
      </div>
    </div>
  );
};

// Dual range slider component
interface DualRangeSliderProps {
  min: number;
  max: number;
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  label: string;
  info?: string;
}

const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  min,
  max,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  label,
  info,
}) => {
  const range = max - min;
  const minPercent = ((minValue - min) / range) * 100;
  const maxPercent = ((maxValue - min) / range) * 100;

  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), maxValue);
    onMinChange(value);
  }, [maxValue, onMinChange]);

  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), minValue);
    onMaxChange(value);
  }, [minValue, onMaxChange]);

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center gap-1">
          <span className="text-text-secondary">{label}</span>
          {info && <InfoTooltip text={info} />}
        </div>
        <span className="text-text-primary font-medium">{minValue} - {maxValue}</span>
      </div>
      <div style={{ position: 'relative', height: '24px' }}>
        <div style={{ position: 'absolute', top: '8px', left: 0, right: 0, height: '8px', borderRadius: '4px', backgroundColor: '#313131' }} />
        <div style={{ position: 'absolute', top: '8px', left: `${minPercent}%`, height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #12e6c8, #a287f4)', width: `${maxPercent - minPercent}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          value={minValue}
          onChange={handleMinChange}
          style={{ position: 'relative', width: '100%', height: '24px', background: 'transparent', cursor: 'pointer', pointerEvents: 'none' }}
          className="[&::-webkit-slider-thumb]:pointer-events-auto"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxValue}
          onChange={handleMaxChange}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '24px', background: 'transparent', cursor: 'pointer', pointerEvents: 'none' }}
          className="[&::-webkit-slider-thumb]:pointer-events-auto"
        />
      </div>
    </div>
  );
};

interface SoundItemProps {
  sound: AmbientSoundDef;
  categoryPath: string;
  categoryName: string;
  isActive: boolean;
  onToggle: () => void;
  onUpdateSettings: (settings: Record<string, number | string>) => void;
  onResetToDefaults: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  activeSettings?: {
    volume: number;
    pitch: number;
    pan: number;
    lowPassFreq: number;
    reverbType: 'off' | 'small-room' | 'large-hall' | 'cathedral';
    algorithmicReverb: number;
    repeatRangeMin: number;
    repeatRangeMax: number;
    pauseRangeMin: number;
    pauseRangeMax: number;
    volumeVariation: number;
  };
}

const SoundItem: React.FC<SoundItemProps> = ({
  sound,
  isActive,
  onToggle,
  onUpdateSettings,
  onResetToDefaults,
  isExpanded,
  onToggleExpanded,
  activeSettings,
}) => {

  return (
    <div className="rounded-lg bg-bg-secondary/30 overflow-hidden">
      <div className="flex items-center gap-2 p-2">
        <button
          onClick={onToggle}
          className={`p-1 rounded transition-colors ${
            isActive ? 'text-accent-green' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {isActive ? <Check size={18} /> : <Square size={18} />}
        </button>
        
        <span className="flex-1 text-sm text-text-primary">{sound.name}</span>
        
        {isActive && (
          <div className="flex items-center gap-1">
            <button
              onClick={onResetToDefaults}
              className="p-1 text-text-secondary hover:text-accent-cyan transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={onToggleExpanded}
              className="p-1 text-text-secondary hover:text-text-primary transition-colors"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>
      
      {isActive && isExpanded && activeSettings && (
        <div style={{ padding: '8px 12px 8px 12px' }} className="space-y-4">
          <Slider
            label="Volume"
            value={activeSettings.volume}
            min={0}
            max={100}
            onChange={(v) => onUpdateSettings({ volume: v })}
            formatValue={(v) => `${v}%`}
            info={settingInfo.volume}
          />
          
          <Slider
            label="Pitch"
            value={activeSettings.pitch * 100}
            min={50}
            max={200}
            onChange={(v) => onUpdateSettings({ pitch: v / 100 })}
            formatValue={(v) => `${(v / 100).toFixed(2)}x`}
            info={settingInfo.pitch}
          />
          
          <Slider
            label="Pan"
            value={activeSettings.pan}
            min={-100}
            max={100}
            onChange={(v) => onUpdateSettings({ pan: v })}
            formatValue={(v) => v > 0 ? `R${v}` : v < 0 ? `L${Math.abs(v)}` : 'Center'}
            info={settingInfo.pan}
          />
          
          <Slider
            label="Low-Pass Filter"
            value={activeSettings.lowPassFreq}
            min={200}
            max={22000}
            step={100}
            onChange={(v) => onUpdateSettings({ lowPassFreq: v })}
            formatValue={(v) => v >= 22000 ? 'Off' : `${v}Hz`}
            info={settingInfo.lowPassFreq}
          />
          
          <Slider
            label="Reverb"
            value={activeSettings.algorithmicReverb}
            min={0}
            max={100}
            onChange={(v) => onUpdateSettings({ algorithmicReverb: v })}
            formatValue={(v) => v === 0 ? 'Off' : `${v}%`}
            info="Adds spacious reverb effect to the sound."
          />
          
          <Slider
            label="Volume Variation"
            value={activeSettings.volumeVariation}
            min={0}
            max={50}
            onChange={(v) => onUpdateSettings({ volumeVariation: v })}
            formatValue={(v) => `±${v}%`}
            info={settingInfo.volumeVariation}
          />
          
          <DualRangeSlider
            label="Repeat Range"
            min={1}
            max={10}
            minValue={activeSettings.repeatRangeMin}
            maxValue={activeSettings.repeatRangeMax}
            onMinChange={(value) => onUpdateSettings({ repeatRangeMin: value })}
            onMaxChange={(value) => onUpdateSettings({ repeatRangeMax: value })}
            info={settingInfo.repeatRange}
          />
          
          <DualRangeSlider
            label="Pause Range"
            min={0}
            max={10}
            minValue={activeSettings.pauseRangeMin}
            maxValue={activeSettings.pauseRangeMax}
            onMinChange={(value) => onUpdateSettings({ pauseRangeMin: value })}
            onMaxChange={(value) => onUpdateSettings({ pauseRangeMax: value })}
            info={settingInfo.pauseRange}
          />
        </div>
      )}
    </div>
  );
};

export const AmbientSoundscapes: React.FC = () => {
  const {
    categories,
    activeSounds,
    resetSoundToDefaults,
    expandedCategories,
    hideUnselected,
    toggleSound,
    loadSoundWithSettings,
    updateSoundSettings,
    toggleCategory,
    selectAllInCategory,
    deselectAllInCategory,
    setHideUnselected,
    clearAll,
    syncActiveFromBackend,
    transitionToSounds,
    prepareFadeOut,
  } = useAmbientStore();

  const {
    presets,
    currentPresetId,
    loadPresets,
    savePreset,
    loadPreset,
    deletePreset,
    setCurrentPresetId,
  } = usePresetStore();

  const { stopSchedule, clearItems: clearSchedulerItems } = useSchedulerStore();

  const [showSaveNewDialog, setShowSaveNewDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [showSaveCurrentDialog, setShowSaveCurrentDialog] = useState(false);
  const [expandedSounds, setExpandedSounds] = useState<Set<string>>(new Set());
  const [showScheduler, setShowScheduler] = useState(false);
  const originalWidth = useRef<number | null>(null);

  // Toggle scheduler and resize window
  const toggleScheduler = useCallback(async () => {
    const appWindow = getCurrentWindow();
    try {
      const scaleFactor = await appWindow.scaleFactor();
      const physicalSize = await appWindow.innerSize();
      // Convert physical to logical
      const logicalWidth = physicalSize.width / scaleFactor;
      const logicalHeight = physicalSize.height / scaleFactor;
      
      if (!showScheduler) {
        // Opening scheduler - save original width and double it
        originalWidth.current = logicalWidth;
        await appWindow.setSize(new LogicalSize(logicalWidth * 2, logicalHeight));
      } else {
        // Closing scheduler - restore original width
        const restoreWidth = originalWidth.current || logicalWidth / 2;
        await appWindow.setSize(new LogicalSize(restoreWidth, logicalHeight));
      }
      setShowScheduler(!showScheduler);
    } catch (error) {
      console.error('Error resizing window:', error);
      setShowScheduler(!showScheduler);
    }
  }, [showScheduler]);

  // Toggle a single sound's expanded state
  const toggleSoundExpanded = (soundId: string) => {
    setExpandedSounds(prev => {
      const next = new Set(prev);
      if (next.has(soundId)) {
        next.delete(soundId);
      } else {
        next.add(soundId);
      }
      return next;
    });
  };

  // Expand all active sounds
  const expandAllSounds = () => {
    const allActiveIds = Array.from(activeSounds.keys());
    setExpandedSounds(new Set(allActiveIds));
  };

  // Collapse all sounds
  const collapseAllSounds = () => {
    setExpandedSounds(new Set());
  };

  // Check if all active sounds are expanded
  const allSoundsExpanded = activeSounds.size > 0 && 
    Array.from(activeSounds.keys()).every(id => expandedSounds.has(id));

  // Expand all active sounds in a category
  const expandAllInCategory = (categoryName: string) => {
    const categorySounds = categories.find(c => c.name === categoryName)?.sounds || [];
    const activeInCategory = categorySounds.filter(s => activeSounds.has(s.id)).map(s => s.id);
    setExpandedSounds(prev => {
      const next = new Set(prev);
      activeInCategory.forEach(id => next.add(id));
      return next;
    });
  };

  // Collapse all sounds in a category
  const collapseAllInCategory = (categoryName: string) => {
    const categorySounds = categories.find(c => c.name === categoryName)?.sounds || [];
    const idsInCategory = categorySounds.map(s => s.id);
    setExpandedSounds(prev => {
      const next = new Set(prev);
      idsInCategory.forEach(id => next.delete(id));
      return next;
    });
  };

  // Check if all active sounds in a category are expanded
  const allInCategoryExpanded = (categoryName: string) => {
    const categorySounds = categories.find(c => c.name === categoryName)?.sounds || [];
    const activeInCategory = categorySounds.filter(s => activeSounds.has(s.id));
    return activeInCategory.length > 0 && activeInCategory.every(s => expandedSounds.has(s.id));
  };

  // Load presets on mount
  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // Sync active sounds from backend when window opens (restores UI state)
  useEffect(() => {
    if (categories.length > 0) {
      syncActiveFromBackend();
    }
  }, [categories, syncActiveFromBackend]);

  // Check if preset name already exists
  const getExistingPresetByName = (name: string) => {
    const normalizedName = name.trim().toLowerCase();
    return presets.find(p => p.name.toLowerCase() === normalizedName);
  };

  // Get current preset name
  const currentPresetName = currentPresetId 
    ? presets.find(p => p.id === currentPresetId)?.name 
    : null;

  // Handle "Save New" - create a new preset
  const handleSaveNew = async () => {
    if (!presetName.trim() || activeSounds.size === 0) return;
    
    // Check if a preset with this name already exists
    const existingPreset = getExistingPresetByName(presetName);
    if (existingPreset) {
      setShowOverwriteDialog(true);
      return;
    }
    
    await doSaveNewPreset();
  };

  // Actually save a new preset
  const doSaveNewPreset = async () => {
    setIsSaving(true);
    try {
      await savePreset(presetName.trim(), activeSounds);
      setShowSaveNewDialog(false);
      setPresetName('');
      setShowOverwriteDialog(false);
    } catch (error) {
      console.error('Error saving preset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle confirming overwrite (for Save New with existing name)
  const confirmOverwrite = async () => {
    await doSaveNewPreset();
  };

  // Handle "Save Current" - overwrite the currently selected preset
  const handleSaveCurrent = async () => {
    if (!currentPresetId || !currentPresetName || activeSounds.size === 0) return;
    
    setIsSaving(true);
    try {
      await savePreset(currentPresetName, activeSounds);
      setShowSaveCurrentDialog(false);
    } catch (error) {
      console.error('Error saving preset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle loading a preset
  const handleLoadPreset = useCallback(async (presetId: string) => {
    try {
      const preset = await loadPreset(presetId);
      
      // Clear existing sounds first
      clearAll();
      
      // Small delay to let clearAll complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Load each sound from the preset sequentially with small delays to prevent audio glitches
      for (let i = 0; i < preset.sounds.length; i++) {
        const presetSound = preset.sounds[i];
        // Create the sound object with preset settings
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
          reverbType: DEFAULT_AMBIENT_SETTINGS.reverbType,
          algorithmicReverb: presetSound.algorithmicReverb,
          repeatRangeMin: presetSound.repeatRangeMin,
          repeatRangeMax: presetSound.repeatRangeMax,
          pauseRangeMin: presetSound.pauseRangeMin,
          pauseRangeMax: presetSound.pauseRangeMax,
          volumeVariation: presetSound.volumeVariation,
        };
        
        // Load the sound with all its settings in one operation
        await loadSoundWithSettings(sound);
        
        // Small delay between sounds to prevent audio buffer overload
        if (i < preset.sounds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      }
    } catch (error) {
      console.error('Error loading preset:', error);
    }
  }, [loadPreset, clearAll, loadSoundWithSettings]);

  // Handle deleting a preset
  const handleDeletePreset = (presetId: string) => {
    setPresetToDelete(presetId);
    setShowDeleteDialog(true);
  };

  const confirmDeletePreset = async () => {
    if (!presetToDelete) return;
    
    try {
      await deletePreset(presetToDelete);
    } catch (error) {
      console.error('Error deleting preset:', error);
    } finally {
      setShowDeleteDialog(false);
      setPresetToDelete(null);
    }
  };

  // Handle clearing all (including stopping scheduler)
  const handleClearAll = useCallback(() => {
    clearAll();
    setCurrentPresetId(null);
    stopSchedule();
    clearSchedulerItems();
  }, [clearAll, setCurrentPresetId, stopSchedule, clearSchedulerItems]);

  // Handle clearing just ambient sounds (for scheduler use - doesn't clear scheduler items)
  const handleClearAmbientOnly = useCallback(() => {
    clearAll();
    setCurrentPresetId(null);
  }, [clearAll, setCurrentPresetId]);

  // Handle loading a preset (stops scheduler) - for manual preset selection on left panel
  const handleLoadPresetWithSchedulerStop = useCallback(async (presetId: string) => {
    stopSchedule();
    await handleLoadPreset(presetId);
  }, [stopSchedule, handleLoadPreset]);

  // Handle loading a preset for scheduler playback using smart transitions
  // Only stops/starts sounds that differ between presets, keeps common sounds playing
  const handleLoadPresetForScheduler = useCallback(async (presetId: string) => {
    try {
      const preset = await loadPreset(presetId);
      
      // Build the list of sounds from the preset
      const newSounds: AmbientSound[] = preset.sounds.map(presetSound => ({
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
        reverbType: DEFAULT_AMBIENT_SETTINGS.reverbType,
        algorithmicReverb: presetSound.algorithmicReverb,
        repeatRangeMin: presetSound.repeatRangeMin,
        repeatRangeMax: presetSound.repeatRangeMax,
        pauseRangeMin: presetSound.pauseRangeMin,
        pauseRangeMax: presetSound.pauseRangeMax,
        volumeVariation: presetSound.volumeVariation,
      }));
      
      // Use smart transition - only stop/start what's needed
      await transitionToSounds(newSounds);
    } catch (error) {
      console.error('Error loading preset for scheduler:', error);
    }
  }, [loadPreset, transitionToSounds]);

  // Prepare fade out 2 seconds before transition - gets next preset's sound IDs
  const handlePrepareFadeOut = useCallback(async (nextPresetId: string) => {
    try {
      const preset = await loadPreset(nextPresetId);
      const nextSoundIds = new Set(preset.sounds.map(s => s.soundId));
      await prepareFadeOut(nextSoundIds);
    } catch (error) {
      console.error('Error preparing fade out:', error);
    }
  }, [loadPreset, prepareFadeOut]);

  return (
    <div className="flex h-full">
      {/* Left Panel - Ambient Sounds */}
      <div className="flex flex-col h-full flex-1" style={{ padding: '8px 8px 8px 10px' }}>
        <div className="flex items-center justify-between border-b border-border" style={{ paddingBottom: '6px', marginBottom: '6px' }}>
          <h2 className="text-lg font-semibold text-text-primary">Ambient Sounds</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHideUnselected(!hideUnselected)}
              className={`p-2 rounded-lg transition-colors ${
                hideUnselected ? 'text-accent-cyan' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
              title={hideUnselected ? 'Show all sounds' : 'Hide unselected'}
            >
              {hideUnselected ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
            <button
              onClick={() => allSoundsExpanded ? collapseAllSounds() : expandAllSounds()}
              disabled={activeSounds.size === 0}
              className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                allSoundsExpanded ? 'text-accent-purple' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
              title={allSoundsExpanded ? 'Collapse all settings' : 'Expand all settings'}
            >
              <ChevronsUpDown size={20} />
            </button>
            <button
              onClick={handleClearAll}
              className="p-2 rounded-lg text-text-secondary hover:text-accent-red hover:bg-bg-secondary transition-colors"
              title="Clear all"
            >
              <XCircle size={20} />
            </button>
            <button
              onClick={toggleScheduler}
              className={`p-2 rounded-lg transition-colors ${
                showScheduler ? 'text-accent-purple bg-accent-purple/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
              }`}
              title={showScheduler ? 'Hide scheduler' : 'Show scheduler'}
            >
              <Calendar size={20} />
            </button>
          </div>
        </div>

      {/* Preset Controls */}
      <div className="flex items-center gap-2 border-b border-border" style={{ paddingBottom: '6px', marginBottom: '6px' }}>
        <select
          value={currentPresetId || ''}
          onChange={(e) => {
            if (e.target.value) {
              handleLoadPresetWithSchedulerStop(e.target.value);
            } else {
              setCurrentPresetId(null);
            }
          }}
          className="flex-1 px-2 py-1.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-purple"
        >
          <option value="">Select Preset...</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} ({preset.soundCount} sounds)
            </option>
          ))}
        </select>
        
        {/* Save Current - only show when a preset is selected */}
        {currentPresetId && (
          <button
            onClick={() => setShowSaveCurrentDialog(true)}
            disabled={activeSounds.size === 0}
            className="p-1.5 rounded-lg text-text-secondary hover:text-accent-blue hover:bg-bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Update current preset"
          >
            <Save size={18} />
          </button>
        )}
        
        {/* Save New */}
        <button
          onClick={() => {
            setPresetName('');
            setShowSaveNewDialog(true);
          }}
          disabled={activeSounds.size === 0}
          className="px-2 py-1 rounded-lg text-xs text-text-secondary hover:text-accent-green hover:bg-bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-border"
          title="Save as new preset"
        >
          <FilePlus size={16} />
        </button>
        
        {currentPresetId && (
          <button
            onClick={() => handleDeletePreset(currentPresetId)}
            className="p-1.5 rounded-lg text-text-secondary hover:text-accent-red hover:bg-bg-secondary transition-colors"
            title="Delete preset"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Save New Preset Dialog */}
      {showSaveNewDialog && (
        <div className="mb-3 p-3 bg-bg-secondary rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="New preset name..."
              className="flex-1 px-2 py-1.5 bg-bg-primary border border-border rounded text-sm text-text-primary focus:outline-none focus:border-accent-purple"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNew();
                if (e.key === 'Escape') setShowSaveNewDialog(false);
              }}
            />
            <button
              onClick={handleSaveNew}
              disabled={!presetName.trim() || isSaving}
              className="px-3 py-1.5 bg-accent-green text-bg-primary rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSaving ? '...' : 'Save'}
            </button>
            <button
              onClick={() => setShowSaveNewDialog(false)}
              className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
            >
              <XCircle size={18} />
            </button>
          </div>
          <p className="text-xs text-text-secondary">
            Create new preset with {activeSounds.size} sound{activeSounds.size !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ paddingRight: '4px' }}>
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.name);
          const activeCount = category.sounds.filter(s => activeSounds.has(s.id)).length;
          
          return (
            <div key={category.name} className="mb-2">
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-bg-secondary transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown size={20} className="text-text-secondary" />
                ) : (
                  <ChevronRight size={20} className="text-text-secondary" />
                )}
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-text-primary">{category.name}</p>
                  <p className="text-xs text-text-secondary">
                    {activeCount} / {category.sounds.length} active
                  </p>
                </div>
              </button>
              
              {isExpanded && (
                <div className="mt-1 pl-6 pr-2">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => selectAllInCategory(category.path, category.sounds, category.name)}
                      className="text-xs px-2 py-1 rounded bg-bg-secondary text-text-secondary hover:text-accent-green transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => deselectAllInCategory(category.name)}
                      className="text-xs px-2 py-1 rounded bg-bg-secondary text-text-secondary hover:text-accent-red transition-colors"
                    >
                      Select None
                    </button>
                    <button
                      onClick={() => allInCategoryExpanded(category.name) 
                        ? collapseAllInCategory(category.name) 
                        : expandAllInCategory(category.name)}
                      disabled={activeCount === 0}
                      className={`text-xs px-2 py-1 rounded bg-bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        allInCategoryExpanded(category.name) ? 'text-accent-purple' : 'text-text-secondary hover:text-text-primary'
                      }`}
                      title={allInCategoryExpanded(category.name) ? 'Collapse all settings' : 'Expand all settings'}
                    >
                      <ChevronsUpDown size={14} className="inline" />
                    </button>
                  </div>
                  
                  <div className="space-y-1">
                    {category.sounds
                      .filter(sound => !hideUnselected || activeSounds.has(sound.id))
                      .map((sound) => {
                        const activeSound = activeSounds.get(sound.id);
                        
                        return (
                          <SoundItem
                            key={sound.id}
                            sound={sound}
                            categoryPath={category.path}
                            categoryName={category.name}
                            isActive={!!activeSound}
                            onToggle={() => toggleSound(category.path, sound, category.name)}
                            onUpdateSettings={(settings) => updateSoundSettings(sound.id, settings)}
                            onResetToDefaults={() => resetSoundToDefaults(sound.id, sound)}
                            isExpanded={expandedSounds.has(sound.id)}
                            onToggleExpanded={() => toggleSoundExpanded(sound.id)}
                            activeSettings={activeSound ? {
                              volume: activeSound.volume,
                              pitch: activeSound.pitch,
                              pan: activeSound.pan,
                              lowPassFreq: activeSound.lowPassFreq,
                              reverbType: activeSound.reverbType,
                              algorithmicReverb: activeSound.algorithmicReverb,
                              repeatRangeMin: activeSound.repeatRangeMin,
                              repeatRangeMax: activeSound.repeatRangeMax,
                              pauseRangeMin: activeSound.pauseRangeMin,
                              pauseRangeMax: activeSound.pauseRangeMax,
                              volumeVariation: activeSound.volumeVariation,
                            } : undefined}
                          />
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {categories.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary">
            <Volume2 size={48} className="mb-4 opacity-50" />
            <p>No ambient sounds found</p>
            <p className="text-sm">Add sounds to your Ambient folder</p>
          </div>
        )}
      </div>

      {/* Delete Preset Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm rounded-xl">
          <div 
            className="bg-bg-primary rounded-xl border border-border/50 shadow-2xl"
            style={{ padding: '24px', minWidth: '280px', maxWidth: '340px' }}
          >
            <h3 className="text-lg font-semibold text-text-primary" style={{ marginBottom: '8px' }}>
              Delete Preset?
            </h3>
            <p className="text-text-secondary text-sm" style={{ marginBottom: '24px' }}>
              Are you sure you want to delete this preset? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setPresetToDelete(null);
                }}
                className="flex-1 rounded-lg bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-secondary/80 transition-all"
                style={{ padding: '10px 14px', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePreset}
                className="flex-1 rounded-lg bg-accent-red text-white hover:opacity-90 transition-all"
                style={{ padding: '10px 14px', fontWeight: 500 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite Preset Confirmation Dialog (for Save New with existing name) */}
      {showOverwriteDialog && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm rounded-xl">
          <div 
            className="bg-bg-primary rounded-xl border border-border/50 shadow-2xl"
            style={{ padding: '24px', minWidth: '280px', maxWidth: '340px' }}
          >
            <h3 className="text-lg font-semibold text-text-primary" style={{ marginBottom: '8px' }}>
              Overwrite Preset?
            </h3>
            <p className="text-text-secondary text-sm" style={{ marginBottom: '24px' }}>
              A preset named "{presetName}" already exists. Do you want to replace it?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowOverwriteDialog(false);
                }}
                className="flex-1 rounded-lg bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-secondary/80 transition-all"
                style={{ padding: '10px 14px', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmOverwrite}
                className="flex-1 rounded-lg bg-accent-orange text-white hover:opacity-90 transition-all"
                style={{ padding: '10px 14px', fontWeight: 500 }}
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Current Preset Confirmation Dialog */}
      {showSaveCurrentDialog && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm rounded-xl">
          <div 
            className="bg-bg-primary rounded-xl border border-border/50 shadow-2xl"
            style={{ padding: '24px', minWidth: '280px', maxWidth: '340px' }}
          >
            <h3 className="text-lg font-semibold text-text-primary" style={{ marginBottom: '8px' }}>
              Update Preset?
            </h3>
            <p className="text-text-secondary text-sm" style={{ marginBottom: '24px' }}>
              This will update "<span className="text-text-primary font-medium">{currentPresetName}</span>" with your current {activeSounds.size} sound{activeSounds.size !== 1 ? 's' : ''} and settings.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowSaveCurrentDialog(false)}
                className="flex-1 rounded-lg bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-secondary/80 transition-all"
                style={{ padding: '10px 14px', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrent}
                disabled={isSaving}
                className="flex-1 rounded-lg bg-accent-blue text-white hover:opacity-90 transition-all disabled:opacity-50"
                style={{ padding: '10px 14px', fontWeight: 500 }}
              >
                {isSaving ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Right Panel - Scheduler */}
      {showScheduler && (
        <div className="flex-1 h-full">
          <Scheduler
            onLoadPreset={handleLoadPresetForScheduler}
            onClearAmbient={handleClearAmbientOnly}
            onPrepareFadeOut={handlePrepareFadeOut}
          />
        </div>
      )}
    </div>
  );
};
