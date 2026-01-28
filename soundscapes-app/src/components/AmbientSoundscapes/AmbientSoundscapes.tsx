import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Check, Square, Volume2, Eye, EyeOff, Trash2, Info, RotateCcw } from 'lucide-react';
import { useAmbientStore } from '../../stores/ambientStore';
import { AmbientSoundDef } from '../../types';

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
}

const Slider: React.FC<SliderProps> = ({ label, value, min, max, step = 1, onChange, formatValue, info }) => {
  const percent = ((value - min) / (max - min)) * 100;
  
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <div className="flex items-center gap-1">
          <span className="text-text-secondary">{label}</span>
          {info && <InfoTooltip text={info} />}
        </div>
        <span className="text-text-primary font-medium">{formatValue(value)}</span>
      </div>
      <div style={{ position: 'relative', height: '24px' }}>
        <div style={{ position: 'absolute', top: '8px', left: 0, right: 0, height: '8px', borderRadius: '4px', backgroundColor: '#313131' }} />
        <div style={{ position: 'absolute', top: '8px', left: 0, height: '8px', borderRadius: '4px', background: 'linear-gradient(to right, #12e6c8, #a287f4)', width: `${percent}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: 'relative', width: '100%', height: '24px', background: 'transparent', cursor: 'pointer' }}
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
  activeSettings?: {
    volume: number;
    pitch: number;
    pan: number;
    lowPassFreq: number;
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
  activeSettings,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

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
              onClick={() => setIsExpanded(!isExpanded)}
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
    updateSoundSettings,
    toggleCategory,
    selectAllInCategory,
    deselectAllInCategory,
    setHideUnselected,
    clearAll,
  } = useAmbientStore();

  return (
    <div className="flex flex-col h-full" style={{ padding: '8px 8px 8px 10px' }}>
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
        <h2 className="text-lg font-semibold text-text-primary">Ambient Sounds</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHideUnselected(!hideUnselected)}
            className={`p-2 rounded-lg transition-colors ${
              hideUnselected ? 'bg-accent-purple text-bg-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
            }`}
            title={hideUnselected ? 'Show all sounds' : 'Hide unselected'}
          >
            {hideUnselected ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
          <button
            onClick={clearAll}
            className="p-2 rounded-lg text-text-secondary hover:text-accent-red hover:bg-bg-secondary transition-colors"
            title="Clear all"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

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
                            activeSettings={activeSound ? {
                              volume: activeSound.volume,
                              pitch: activeSound.pitch,
                              pan: activeSound.pan,
                              lowPassFreq: activeSound.lowPassFreq,
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
    </div>
  );
};
