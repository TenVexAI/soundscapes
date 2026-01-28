import { create } from 'zustand';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export type WindowType = 'music' | 'ambient' | 'soundboard' | 'settings';

interface WindowState {
  openWindows: Set<WindowType>;
  openWindow: (type: WindowType) => Promise<void>;
  closeWindow: (type: WindowType) => Promise<void>;
  toggleWindow: (type: WindowType) => Promise<void>;
  isWindowOpen: (type: WindowType) => boolean;
  setWindowClosed: (type: WindowType) => void;
}

const windowConfigs: Record<WindowType, { title: string; width: number; height: number }> = {
  music: { title: 'Music Playlist', width: 400, height: 600 },
  ambient: { title: 'Ambient Soundscapes', width: 400, height: 700 },
  soundboard: { title: 'Soundboard', width: 500, height: 400 },
  settings: { title: 'Advanced Settings', width: 450, height: 500 },
};

export const useWindowStore = create<WindowState>((set, get) => ({
  openWindows: new Set(),

  openWindow: async (type: WindowType) => {
    const { openWindows } = get();
    if (openWindows.has(type)) {
      // Window already open, focus it
      const existingWindow = await WebviewWindow.getByLabel(type);
      if (existingWindow) {
        await existingWindow.setFocus();
      }
      return;
    }

    const config = windowConfigs[type];
    
    try {
      const webview = new WebviewWindow(type, {
        url: `/${type}.html`,
        title: config.title,
        width: config.width,
        height: config.height,
        resizable: true,
        decorations: true,
        center: true,
      });

      // Mark as open immediately
      set({ openWindows: new Set([...get().openWindows, type]) });

      // Listen for window destruction to update state
      webview.once('tauri://destroyed', () => {
        get().setWindowClosed(type);
      });

      webview.once('tauri://error', (e) => {
        console.error(`Window ${type} error:`, e);
        get().setWindowClosed(type);
      });
    } catch (e) {
      console.error(`Failed to create ${type} window:`, e);
    }
  },

  closeWindow: async (type: WindowType) => {
    try {
      const window = await WebviewWindow.getByLabel(type);
      if (window) {
        await window.close();
      }
    } catch (e) {
      console.error(`Failed to close ${type} window:`, e);
    }
    get().setWindowClosed(type);
  },

  toggleWindow: async (type: WindowType) => {
    const { openWindows, openWindow, closeWindow } = get();
    if (openWindows.has(type)) {
      await closeWindow(type);
    } else {
      await openWindow(type);
    }
  },

  isWindowOpen: (type: WindowType) => {
    return get().openWindows.has(type);
  },

  setWindowClosed: (type: WindowType) => {
    const newWindows = new Set(get().openWindows);
    newWindows.delete(type);
    set({ openWindows: newWindows });
  },
}));
