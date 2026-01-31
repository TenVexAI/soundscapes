import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ScheduledItem, SchedulePreset, SchedulePresetInfo } from '../types';

interface SchedulerState {
  // Schedule presets management
  schedules: SchedulePresetInfo[];
  currentScheduleId: string | null;
  isLoading: boolean;
  
  // Current editing state
  editingItems: ScheduledItem[];
  hasUnsavedChanges: boolean;
  
  // Playback state
  isPlaying: boolean;
  currentItemIndex: number;
  currentDuration: number; // Random duration chosen for current item
  timeRemaining: number; // Seconds remaining on current item
  
  // Actions - CRUD
  loadSchedules: () => Promise<void>;
  saveSchedule: (name: string) => Promise<SchedulePresetInfo>;
  loadSchedule: (id: string) => Promise<SchedulePreset>;
  deleteSchedule: (id: string) => Promise<void>;
  
  // Actions - Editing
  addItem: (presetId: string, presetName: string) => void;
  removeItem: (itemId: string) => void;
  updateItemTiming: (itemId: string, minMinutes: number, maxMinutes: number) => void;
  reorderItems: (fromIndex: number, toIndex: number) => void;
  clearItems: () => void;
  setCurrentScheduleId: (id: string | null) => void;
  
  // Actions - Playback
  startSchedule: () => void;
  stopSchedule: () => void;
  advanceToNext: () => void;
  tick: () => void; // Called every second to update timeRemaining
}

// Generate unique ID
function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get random duration between min and max
function getRandomDuration(minMinutes: number, maxMinutes: number): number {
  const min = Math.min(minMinutes, maxMinutes);
  const max = Math.max(minMinutes, maxMinutes);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
  schedules: [],
  currentScheduleId: null,
  isLoading: false,
  
  editingItems: [],
  hasUnsavedChanges: false,
  
  isPlaying: false,
  currentItemIndex: 0,
  currentDuration: 0,
  timeRemaining: 0,
  
  loadSchedules: async () => {
    set({ isLoading: true });
    try {
      const schedules = await invoke<SchedulePresetInfo[]>('list_schedules');
      set({ schedules, isLoading: false });
    } catch (error) {
      console.error('Error loading schedules:', error);
      set({ isLoading: false });
    }
  },
  
  saveSchedule: async (name: string) => {
    const { editingItems } = get();
    const result = await invoke<SchedulePresetInfo>('save_schedule', { 
      name, 
      items: editingItems 
    });
    
    // Refresh the list
    await get().loadSchedules();
    set({ currentScheduleId: result.id, hasUnsavedChanges: false });
    
    return result;
  },
  
  loadSchedule: async (id: string) => {
    const schedule = await invoke<SchedulePreset>('load_schedule', { id });
    set({ 
      currentScheduleId: id,
      editingItems: schedule.items,
      hasUnsavedChanges: false,
    });
    return schedule;
  },
  
  deleteSchedule: async (id: string) => {
    await invoke('delete_schedule', { id });
    
    // Clear current if deleted
    if (get().currentScheduleId === id) {
      set({ 
        currentScheduleId: null,
        editingItems: [],
        hasUnsavedChanges: false,
        isPlaying: false,
      });
    }
    
    // Refresh the list
    await get().loadSchedules();
  },
  
  addItem: (presetId: string, presetName: string) => {
    const { editingItems } = get();
    const newItem: ScheduledItem = {
      id: generateId(),
      presetId,
      presetName,
      minMinutes: 1,
      maxMinutes: 1,
      order: editingItems.length,
    };
    set({ 
      editingItems: [...editingItems, newItem],
      hasUnsavedChanges: true,
    });
  },
  
  removeItem: (itemId: string) => {
    const { editingItems } = get();
    const filtered = editingItems.filter(item => item.id !== itemId);
    // Reorder remaining items
    const reordered = filtered.map((item, index) => ({ ...item, order: index }));
    set({ 
      editingItems: reordered,
      hasUnsavedChanges: true,
    });
  },
  
  updateItemTiming: (itemId: string, minMinutes: number, maxMinutes: number) => {
    const { editingItems } = get();
    set({
      editingItems: editingItems.map(item => 
        item.id === itemId 
          ? { ...item, minMinutes, maxMinutes }
          : item
      ),
      hasUnsavedChanges: true,
    });
  },
  
  reorderItems: (fromIndex: number, toIndex: number) => {
    const { editingItems } = get();
    const items = [...editingItems];
    const [removed] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, removed);
    // Update order values
    const reordered = items.map((item, index) => ({ ...item, order: index }));
    set({ 
      editingItems: reordered,
      hasUnsavedChanges: true,
    });
  },
  
  clearItems: () => {
    set({
      editingItems: [],
      currentScheduleId: null,
      hasUnsavedChanges: false,
      isPlaying: false,
      currentItemIndex: 0,
      timeRemaining: 0,
    });
  },
  
  setCurrentScheduleId: (id: string | null) => {
    set({ currentScheduleId: id });
  },
  
  startSchedule: () => {
    const { editingItems } = get();
    if (editingItems.length === 0) return;
    
    const firstItem = editingItems[0];
    const duration = getRandomDuration(firstItem.minMinutes, firstItem.maxMinutes);
    
    set({
      isPlaying: true,
      currentItemIndex: 0,
      currentDuration: duration,
      timeRemaining: duration * 60, // Convert to seconds
    });
  },
  
  stopSchedule: () => {
    set({
      isPlaying: false,
      currentItemIndex: 0,
      currentDuration: 0,
      timeRemaining: 0,
    });
  },
  
  advanceToNext: () => {
    const { editingItems, currentItemIndex } = get();
    if (editingItems.length === 0) return;
    
    // Loop back to start if at end
    const nextIndex = (currentItemIndex + 1) % editingItems.length;
    const nextItem = editingItems[nextIndex];
    const duration = getRandomDuration(nextItem.minMinutes, nextItem.maxMinutes);
    
    set({
      currentItemIndex: nextIndex,
      currentDuration: duration,
      timeRemaining: duration * 60,
    });
  },
  
  tick: () => {
    const { isPlaying, timeRemaining } = get();
    if (!isPlaying) return;
    
    if (timeRemaining <= 0) {
      // Time's up, advance to next
      get().advanceToNext();
    } else {
      set({ timeRemaining: timeRemaining - 1 });
    }
  },
}));
