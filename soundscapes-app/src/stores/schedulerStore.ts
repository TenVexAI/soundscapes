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
  
  // Playback state (synced from backend)
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
  
  // Actions - Playback (now backed by Rust backend)
  startSchedule: () => Promise<void>;
  stopSchedule: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
  
  // Legacy (kept for compatibility but no longer used)
  advanceToNext: () => void;
  tick: () => void;
}

// Generate unique ID
function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
  
  startSchedule: async () => {
    const { editingItems, currentScheduleId } = get();
    if (editingItems.length === 0) return;
    
    try {
      // Start scheduler in backend
      await invoke('start_scheduler_playback', {
        items: editingItems,
        scheduleId: currentScheduleId,
      });
      
      // Sync state from backend
      await get().syncWithBackend();
    } catch (error) {
      console.error('Error starting scheduler:', error);
    }
  },
  
  stopSchedule: async () => {
    try {
      await invoke('stop_scheduler_playback');
      
      set({
        isPlaying: false,
        currentItemIndex: 0,
        currentDuration: 0,
        timeRemaining: 0,
      });
    } catch (error) {
      console.error('Error stopping scheduler:', error);
    }
  },
  
  syncWithBackend: async () => {
    try {
      const backendState = await invoke<{
        isPlaying: boolean;
        currentItemIndex: number;
        currentDuration: number;
        timeRemaining: number;
        items: ScheduledItem[];
        currentScheduleId: string | null;
      }>('get_scheduler_state');
      
      set({
        isPlaying: backendState.isPlaying,
        currentItemIndex: backendState.currentItemIndex,
        currentDuration: backendState.currentDuration,
        timeRemaining: backendState.timeRemaining,
        // Only update editingItems if backend has items and we don't have local changes
        ...(backendState.items.length > 0 && !get().hasUnsavedChanges ? {
          editingItems: backendState.items,
          currentScheduleId: backendState.currentScheduleId,
        } : {}),
      });
    } catch (error) {
      console.error('Error syncing with backend:', error);
    }
  },
  
  // Legacy functions - kept for compatibility but scheduler now runs in backend
  advanceToNext: () => {
    // No-op - backend handles this now
  },
  
  tick: () => {
    // No-op - backend handles this now
    // Frontend should poll syncWithBackend instead
  },
}));
