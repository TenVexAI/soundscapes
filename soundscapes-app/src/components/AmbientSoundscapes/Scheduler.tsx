import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, ChevronUp, ChevronDown, FilePlus, Save, XCircle, Play, Square, Clock } from 'lucide-react';
import { useSchedulerStore } from '../../stores/schedulerStore';
import { usePresetStore } from '../../stores/presetStore';
import { ScheduledItem } from '../../types';

// Dual range slider for minutes
interface DualRangeSliderProps {
  min: number;
  max: number;
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}

const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  min,
  max,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
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
  );
};

// Scheduled item component
interface ScheduledItemRowProps {
  item: ScheduledItem;
  index: number;
  totalItems: number;
  isActive: boolean;
  onRemove: () => void;
  onUpdateTiming: (min: number, max: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const ScheduledItemRow: React.FC<ScheduledItemRowProps> = ({
  item,
  index,
  totalItems,
  isActive,
  onRemove,
  onUpdateTiming,
  onMoveUp,
  onMoveDown,
}) => {
  return (
    <div
      className={`rounded-lg bg-bg-secondary/50 border transition-all ${
        isActive ? 'border-accent-cyan bg-accent-cyan/10' : 'border-border'
      }`}
      style={{ padding: '10px 12px', marginTop: '2px', marginBottom: '2px' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-0.5 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move up"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === totalItems - 1}
            className="p-0.5 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move down"
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <span className="flex-1 text-sm text-text-primary font-medium truncate">
          {item.presetName}
        </span>
        {isActive && (
          <div className="flex items-center gap-1 text-accent-cyan">
            <Play size={12} fill="currentColor" />
            <span className="text-xs">Playing</span>
          </div>
        )}
        <button
          onClick={onRemove}
          className="p-1 text-text-secondary hover:text-accent-red transition-colors"
          title="Remove from schedule"
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      <div className="flex items-center gap-2">
        <Clock size={12} className="text-text-secondary" />
        <span className="text-xs text-text-secondary w-16">{item.minMinutes} - {item.maxMinutes} min</span>
        <div className="flex-1">
          <DualRangeSlider
            min={1}
            max={60}
            minValue={item.minMinutes}
            maxValue={item.maxMinutes}
            onMinChange={(v) => onUpdateTiming(v, item.maxMinutes)}
            onMaxChange={(v) => onUpdateTiming(item.minMinutes, v)}
          />
        </div>
      </div>
    </div>
  );
};

// Format seconds to mm:ss
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface SchedulerProps {
  onLoadPreset: (presetId: string) => Promise<void>;
  onClearAmbient: () => void;
  onPrepareFadeOut: (nextPresetId: string) => Promise<void>;
}

export const Scheduler: React.FC<SchedulerProps> = ({ onLoadPreset, onClearAmbient, onPrepareFadeOut }) => {
  const {
    schedules,
    currentScheduleId,
    editingItems,
    isPlaying,
    currentItemIndex,
    timeRemaining,
    loadSchedules,
    saveSchedule,
    loadSchedule,
    deleteSchedule,
    addItem,
    removeItem,
    updateItemTiming,
    reorderItems,
    clearItems,
    startSchedule,
    stopSchedule,
    syncWithBackend,
  } = useSchedulerStore();

  const { presets, loadPresets } = usePresetStore();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Load schedules and presets on mount
  useEffect(() => {
    loadSchedules();
    loadPresets();
  }, [loadSchedules, loadPresets]);

  // Track last loaded preset to avoid reloading
  const lastLoadedRef = useRef<{ index: number; playing: boolean } | null>(null);
  // Track if we've already prepared fade out for current transition
  const fadeOutPreparedRef = useRef<number | null>(null);

  // Poll backend state for real-time updates
  useEffect(() => {
    // Initial sync
    syncWithBackend();
    
    // Poll backend every second for timer updates
    const interval = setInterval(() => {
      syncWithBackend();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [syncWithBackend]);

  // Prepare fade out 2 seconds before transition
  useEffect(() => {
    if (!isPlaying || editingItems.length === 0) return;
    
    // At exactly 2 seconds remaining, prepare fade out for sounds that won't continue
    if (timeRemaining === 2 && fadeOutPreparedRef.current !== currentItemIndex) {
      fadeOutPreparedRef.current = currentItemIndex;
      // Get the next preset ID
      const nextIndex = (currentItemIndex + 1) % editingItems.length;
      const nextItem = editingItems[nextIndex];
      if (nextItem) {
        onPrepareFadeOut(nextItem.presetId);
      }
    }
  }, [isPlaying, timeRemaining, currentItemIndex, editingItems, onPrepareFadeOut]);

  // Load preset when current item changes during playback
  useEffect(() => {
    if (!isPlaying || editingItems.length === 0) return;
    
    // Check if we already loaded this preset
    if (lastLoadedRef.current?.index === currentItemIndex && lastLoadedRef.current?.playing === isPlaying) {
      return;
    }
    
    const currentItem = editingItems[currentItemIndex];
    if (currentItem) {
      lastLoadedRef.current = { index: currentItemIndex, playing: isPlaying };
      // Use smart transition - onLoadPreset handles starting new sounds and updating settings
      onLoadPreset(currentItem.presetId);
    }
  }, [isPlaying, currentItemIndex, editingItems, onLoadPreset]);
  
  // Reset refs when playback stops
  useEffect(() => {
    if (!isPlaying) {
      lastLoadedRef.current = null;
      fadeOutPreparedRef.current = null;
    }
  }, [isPlaying]);

  // Handle loading a schedule - just load and display, don't auto-play
  const handleLoadSchedule = async (scheduleId: string) => {
    if (!scheduleId) {
      clearItems();
      return;
    }
    
    try {
      await loadSchedule(scheduleId);
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!scheduleName.trim() || editingItems.length === 0) return;
    
    try {
      await saveSchedule(scheduleName.trim());
      setShowSaveDialog(false);
      setScheduleName('');
    } catch (error) {
      console.error('Error saving schedule:', error);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!currentScheduleId) return;
    
    try {
      await deleteSchedule(currentScheduleId);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  // Get current schedule name
  const currentScheduleName = currentScheduleId
    ? schedules.find(s => s.id === currentScheduleId)?.name
    : null;

  return (
    <div className="flex flex-col h-full border-l border-border" style={{ padding: '8px 10px 8px 8px' }}>
      <div className="flex items-center justify-between border-b border-border" style={{ paddingBottom: '6px', marginBottom: '6px' }}>
        <h2 className="text-lg font-semibold text-text-primary">Scheduler</h2>
        {isPlaying && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-accent-cyan">{formatTime(timeRemaining)}</span>
            <button
              onClick={() => {
                stopSchedule();
                onClearAmbient();
              }}
              className="p-1.5 rounded bg-accent-red/20 text-accent-red hover:bg-accent-red/30 transition-colors"
              title="Stop schedule"
            >
              <Square size={14} fill="currentColor" />
            </button>
          </div>
        )}
      </div>

      {/* Schedule Preset Controls */}
      <div className="flex items-center gap-2 border-b border-border" style={{ paddingBottom: '6px', marginBottom: '6px' }}>
        <select
          value={currentScheduleId || ''}
          onChange={(e) => handleLoadSchedule(e.target.value)}
          className="flex-1 px-2 py-1.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-purple"
        >
          <option value="">Select Schedule...</option>
          {schedules.map((schedule) => (
            <option key={schedule.id} value={schedule.id}>
              {schedule.name} ({schedule.itemCount} presets)
            </option>
          ))}
        </select>
        
        {/* Update Current */}
        {currentScheduleId && (
          <button
            onClick={async () => {
              const currentName = schedules.find(s => s.id === currentScheduleId)?.name;
              if (currentName) {
                await saveSchedule(currentName);
              }
            }}
            disabled={editingItems.length === 0}
            className="p-1.5 rounded-lg text-text-secondary hover:text-accent-blue hover:bg-bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-border"
            title="Update current schedule"
          >
            <Save size={16} />
          </button>
        )}
        
        {/* Save New */}
        <button
          onClick={() => {
            setScheduleName('');
            setShowSaveDialog(true);
          }}
          disabled={editingItems.length === 0}
          className="p-1.5 rounded-lg text-text-secondary hover:text-accent-green hover:bg-bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-border"
          title="Save as new schedule"
        >
          <FilePlus size={16} />
        </button>
        
        {/* Delete */}
        {currentScheduleId && (
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="p-1.5 rounded-lg text-text-secondary hover:text-accent-red hover:bg-bg-secondary transition-colors border border-border"
            title="Delete schedule"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="mb-3 p-3 bg-bg-secondary rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              placeholder="Schedule name..."
              className="flex-1 px-2 py-1.5 bg-bg-primary border border-border rounded text-sm text-text-primary focus:outline-none focus:border-accent-purple"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
            />
            <button
              onClick={handleSave}
              disabled={!scheduleName.trim()}
              className="px-3 py-1.5 bg-accent-green text-bg-primary rounded text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
            >
              <XCircle size={18} />
            </button>
          </div>
          <p className="text-xs text-text-secondary">
            Save schedule with {editingItems.length} preset{editingItems.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Add Preset Selector */}
      <div className="mb-3">
        <select
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              const preset = presets.find(p => p.id === e.target.value);
              if (preset) {
                addItem(preset.id, preset.name);
              }
              e.target.value = '';
            }
          }}
          className="w-full px-2 py-1.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-purple"
        >
          <option value="">Add preset to schedule...</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      {/* Scheduled Items List */}
      <div className="flex-1 overflow-y-auto space-y-2" style={{ paddingRight: '4px' }}>
        {editingItems.length > 0 ? (
          editingItems.map((item, index) => (
            <ScheduledItemRow
              key={item.id}
              item={item}
              index={index}
              totalItems={editingItems.length}
              isActive={isPlaying && currentItemIndex === index}
              onRemove={() => removeItem(item.id)}
              onUpdateTiming={(min, max) => updateItemTiming(item.id, min, max)}
              onMoveUp={() => reorderItems(index, index - 1)}
              onMoveDown={() => reorderItems(index, index + 1)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary">
            <Clock size={36} className="mb-3 opacity-50" />
            <p className="text-sm">No presets scheduled</p>
            <p className="text-xs">Add presets above to create a schedule</p>
          </div>
        )}
      </div>

      {/* Playback Controls */}
      {editingItems.length > 0 && !isPlaying && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={() => {
              onClearAmbient();
              setTimeout(() => {
                startSchedule();
              }, 200);
            }}
            className="w-full py-2 rounded-lg bg-accent-purple text-white font-medium hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <Play size={16} fill="currentColor" />
            Start Schedule
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm rounded-xl">
          <div 
            className="bg-bg-primary rounded-xl border border-border/50 shadow-2xl"
            style={{ padding: '24px', minWidth: '280px', maxWidth: '340px' }}
          >
            <h3 className="text-lg font-semibold text-text-primary" style={{ marginBottom: '8px' }}>
              Delete Schedule?
            </h3>
            <p className="text-text-secondary text-sm" style={{ marginBottom: '24px' }}>
              Are you sure you want to delete "{currentScheduleName}"? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 rounded-lg bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-secondary/80 transition-all"
                style={{ padding: '10px 14px', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-accent-red text-white hover:opacity-90 transition-all"
                style={{ padding: '10px 14px', fontWeight: 500 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
