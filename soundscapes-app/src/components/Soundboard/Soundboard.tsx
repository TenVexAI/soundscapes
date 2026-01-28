import React from 'react';
import { Volume2 } from 'lucide-react';
import { useSoundboardStore } from '../../stores/soundboardStore';

export const Soundboard: React.FC = () => {
  const { sounds, currentlyPlaying, playSound, updateSoundVolume } = useSoundboardStore();

  return (
    <div className="flex flex-col h-full" style={{ padding: '8px 8px 8px 10px' }}>
      <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
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
    </div>
  );
};
