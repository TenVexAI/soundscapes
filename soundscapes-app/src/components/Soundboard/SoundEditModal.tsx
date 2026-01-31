import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { SoundboardSound } from '../../types';

interface SoundEditModalProps {
  sound: SoundboardSound;
  onClose: () => void;
  onSave: (updates: { name: string; hotkey: string | null; color: string }) => void;
}

const PRESET_COLORS = [
  '#a287f4', // Purple (default)
  '#f472b6', // Pink
  '#fb7185', // Rose
  '#f87171', // Red
  '#fb923c', // Orange
  '#facc15', // Yellow
  '#a3e635', // Lime
  '#4ade80', // Green
  '#2dd4bf', // Teal
  '#22d3ee', // Cyan
  '#38bdf8', // Sky
  '#60a5fa', // Blue
  '#818cf8', // Indigo
  '#c084fc', // Violet
];

export const SoundEditModal: React.FC<SoundEditModalProps> = ({ sound, onClose, onSave }) => {
  const [name, setName] = useState(sound.name);
  const [hotkey, setHotkey] = useState(sound.hotkey || '');
  const [color, setColor] = useState(sound.color);
  const [isCapturingHotkey, setIsCapturingHotkey] = useState(false);
  const hotkeyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCapturingHotkey) {
        e.preventDefault();
        e.stopPropagation();
        
        // Ignore modifier keys alone
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
          return;
        }
        
        // Build hotkey string
        let hotkeyStr = '';
        if (e.ctrlKey) hotkeyStr += 'Ctrl+';
        if (e.altKey) hotkeyStr += 'Alt+';
        if (e.shiftKey) hotkeyStr += 'Shift+';
        
        // Handle special keys
        if (e.key === ' ') {
          hotkeyStr += 'Space';
        } else if (e.key.length === 1) {
          hotkeyStr += e.key.toUpperCase();
        } else {
          hotkeyStr += e.key;
        }
        
        setHotkey(hotkeyStr);
        setIsCapturingHotkey(false);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCapturingHotkey, onClose]);

  const handleSave = () => {
    onSave({
      name: name.trim() || sound.name,
      hotkey: hotkey.trim() || null,
      color,
    });
    onClose();
  };

  const handleClearHotkey = () => {
    setHotkey('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div 
        className="bg-bg-secondary rounded-xl w-80 shadow-xl border border-border"
        style={{ padding: '8px 8px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Edit Sound</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary transition-colors"
          >
            <X size={18} className="text-text-secondary" />
          </button>
        </div>

        {/* Name Input */}
        <div style={{ marginBottom: '20px' }}>
          <label className="block text-sm text-text-secondary" style={{ marginBottom: '6px' }}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple"
            placeholder="Sound name"
          />
        </div>

        {/* Hotkey Input */}
        <div style={{ marginBottom: '20px' }}>
          <label className="block text-sm text-text-secondary" style={{ marginBottom: '6px' }}>Hotkey</label>
          <div className="flex gap-2">
            <input
              ref={hotkeyInputRef}
              type="text"
              value={isCapturingHotkey ? 'Press a key...' : hotkey}
              readOnly
              onClick={() => setIsCapturingHotkey(true)}
              className={`flex-1 px-3 py-2 bg-bg-tertiary border rounded-lg text-text-primary focus:outline-none cursor-pointer ${
                isCapturingHotkey ? 'border-accent-cyan ring-2 ring-accent-cyan' : 'border-border'
              }`}
              placeholder="Click to set hotkey"
            />
            {hotkey && (
              <button
                onClick={handleClearHotkey}
                className="px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-text-secondary" style={{ margin: '4px' }}>Click the field and press any key combination</p>
        </div>

        {/* Color Picker */}
        <div style={{ marginBottom: '24px' }}>
          <label className="block text-sm text-text-secondary" style={{ marginBottom: '6px' }}>Color</label>
          <div className="grid grid-cols-7 gap-2">
            {PRESET_COLORS.map((presetColor) => (
              <button
                key={presetColor}
                onClick={() => setColor(presetColor)}
                className={`w-8 h-8 rounded-lg transition-all ${
                  color === presetColor ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: presetColor }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1 px-3 py-1 bg-bg-tertiary border border-border rounded text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-purple"
              placeholder="#000000"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-bg-tertiary border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-accent-purple rounded-lg text-white font-medium hover:brightness-110 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
