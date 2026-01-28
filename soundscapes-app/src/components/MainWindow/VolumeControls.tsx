import React from 'react';
import { Volume2, VolumeX, Music, Waves, Grid3X3 } from 'lucide-react';
import { useAudioStore } from '../../stores/audioStore';

interface VolumeSliderProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  isMuted: boolean;
  onChange: (value: number) => void;
  onToggleMute: () => void;
  color: string;
}

const VolumeSlider: React.FC<VolumeSliderProps> = ({
  label,
  icon,
  value,
  isMuted,
  onChange,
  onToggleMute,
  color,
}) => (
  <div className="flex items-center gap-4 p-3 rounded-xl bg-bg-secondary/30 hover:bg-bg-secondary/50 transition-colors">
    <button
      onClick={onToggleMute}
      className={`p-2 rounded-lg transition-colors ${
        isMuted ? 'text-red-400 bg-red-400/10' : 'text-text-primary'
      } hover:bg-bg-secondary`}
      title={`${isMuted ? 'Unmute' : 'Mute'} ${label}`}
    >
      {isMuted ? <VolumeX size={22} /> : icon}
    </button>
    <div className="flex-1">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-text-secondary font-medium">{label}</span>
        <span className="text-text-primary font-semibold">{Math.round(value)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, #313131 ${value}%, #313131 100%)`,
        }}
      />
    </div>
  </div>
);

export const VolumeControls: React.FC = () => {
  const {
    masterVolume,
    musicVolume,
    ambientVolume,
    soundboardVolume,
    isMasterMuted,
    isMusicMuted,
    isAmbientMuted,
    isSoundboardMuted,
    setMasterVolume,
    setMusicVolume,
    setAmbientVolume,
    setSoundboardVolume,
    toggleMasterMute,
    toggleMusicMute,
    toggleAmbientMute,
    toggleSoundboardMute,
  } = useAudioStore();

  return (
    <div className="space-y-3 p-5 bg-bg-secondary/50 rounded-2xl border border-border backdrop-blur-sm">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">
        Volume Controls
      </h3>
      
      <VolumeSlider
        label="Master"
        icon={<Volume2 size={22} />}
        value={masterVolume}
        isMuted={isMasterMuted}
        onChange={setMasterVolume}
        onToggleMute={toggleMasterMute}
        color="#a287f4"
      />
      
      <VolumeSlider
        label="Music"
        icon={<Music size={22} />}
        value={musicVolume}
        isMuted={isMusicMuted}
        onChange={setMusicVolume}
        onToggleMute={toggleMusicMute}
        color="#12e6c8"
      />
      
      <VolumeSlider
        label="Ambient"
        icon={<Waves size={22} />}
        value={ambientVolume}
        isMuted={isAmbientMuted}
        onChange={setAmbientVolume}
        onToggleMute={toggleAmbientMute}
        color="#3cf281"
      />
      
      <VolumeSlider
        label="Soundboard"
        icon={<Grid3X3 size={22} />}
        value={soundboardVolume}
        isMuted={isSoundboardMuted}
        onChange={setSoundboardVolume}
        onToggleMute={toggleSoundboardMute}
        color="#a287f4"
      />
    </div>
  );
};
