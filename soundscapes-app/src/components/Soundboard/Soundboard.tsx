import React, { useState, useEffect } from 'react';
import { Volume2, Settings } from 'lucide-react';
import { useSoundboardStore } from '../../stores/soundboardStore';
import { SoundEditModal } from './SoundEditModal';
import { SoundboardSound } from '../../types';

export const Soundboard: React.FC = () => {
  const { sounds, currentlyPlaying, playSound, playSoundByHotkey, updateSoundVolume, updateSound } = useSoundboardStore();
  const [editingSound, setEditingSound] = useState<SoundboardSound | null>(null);

  // Global hotkey listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkeys when typing in inputs or when modal is open
      if (editingSound) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Build hotkey string to match
      let hotkeyStr = '';
      if (e.ctrlKey) hotkeyStr += 'Ctrl+';
      if (e.altKey) hotkeyStr += 'Alt+';
      if (e.shiftKey) hotkeyStr += 'Shift+';
      
      if (e.key === ' ') {
        hotkeyStr += 'Space';
      } else if (e.key.length === 1) {
        hotkeyStr += e.key.toUpperCase();
      } else {
        hotkeyStr += e.key;
      }

      // Check if any sound matches this hotkey
      const matchingSound = sounds.find(s => s.hotkey?.toLowerCase() === hotkeyStr.toLowerCase());
      if (matchingSound) {
        e.preventDefault();
        playSoundByHotkey(hotkeyStr);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sounds, playSoundByHotkey, editingSound]);

  const handleEditSave = (updates: { name: string; hotkey: string | null; color: string }) => {
    if (editingSound) {
      updateSound(editingSound.id, updates);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ padding: '8px 8px 8px 10px' }}>
      <div className="flex items-center justify-between pb-3 border-b border-border" style={{ marginBottom: '16px' }}>
        <h2 className="text-lg font-semibold text-text-primary">Soundboard</h2>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingRight: '4px' }}>
        {sounds.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sounds.map((sound) => (
              <div
                key={sound.id}
                className={`relative rounded-xl overflow-hidden transition-all duration-200 ${
                  currentlyPlaying === sound.id ? 'ring-2 ring-accent-cyan scale-95' : ''
                }`}
              >
                {/* Edit button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingSound(sound);
                  }}
                  className="absolute top-2 left-2 p-1.5 rounded bg-black/30 hover:bg-black/50 transition-colors z-10"
                  title="Edit sound"
                >
                  <Settings size={14} className="text-white/80" />
                </button>

                <button
                  onClick={() => playSound(sound.id)}
                  className="w-full aspect-square flex flex-col items-center justify-center p-4 transition-all hover:brightness-110"
                  style={{ backgroundColor: sound.color }}
                >
                  <span className="text-sm font-medium text-white text-center drop-shadow-md">
                    {sound.name}
                  </span>
                  {sound.hotkey && (
                    <span className="absolute top-2 right-2 text-xs bg-black/30 px-1.5 py-0.5 rounded text-white/80">
                      {sound.hotkey}
                    </span>
                  )}
                </button>
                
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sound.volume}
                    onChange={(e) => updateSoundVolume(sound.id, Number(e.target.value))}
                    className="w-full h-1 rounded appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, white 0%, white ${sound.volume}%, rgba(255,255,255,0.3) ${sound.volume}%, rgba(255,255,255,0.3) 100%)`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary">
            <Volume2 size={48} className="mb-4 opacity-50" />
            <p>No soundboard sounds found</p>
            <p className="text-sm">Add sounds to your Soundboard folder</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingSound && (
        <SoundEditModal
          sound={editingSound}
          onClose={() => setEditingSound(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
};
