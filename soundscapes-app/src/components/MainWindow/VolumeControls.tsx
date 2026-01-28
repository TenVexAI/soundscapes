import React from 'react';
import { Volume2, VolumeX, Music, Waves, Grid3X3 } from 'lucide-react';
import { useAudioStore } from '../../stores/audioStore';

interface VerticalVolumeSliderProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  isMuted: boolean;
  onChange: (value: number) => void;
  onToggleMute: () => void;
  color: string;
}

const VerticalVolumeSlider: React.FC<VerticalVolumeSliderProps> = ({
  label,
  icon,
  value,
  isMuted,
  onChange,
  onToggleMute,
  color,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
    {/* Icon/mute button at top */}
    <button
      onClick={onToggleMute}
      className={`p-1.5 rounded-lg transition-all ${
        isMuted ? 'text-accent-red' : 'text-text-secondary hover:text-text-primary'
      }`}
      title={`${isMuted ? 'Unmute' : 'Mute'} ${label}`}
    >
      {isMuted ? <VolumeX size={18} /> : icon}
    </button>
    
    {/* Vertical slider - fills remaining height */}
    <div style={{ position: 'relative', width: '24px', flex: 1, marginTop: '8px', marginBottom: '8px' }}>
      {/* Track background - centered horizontally */}
      <div style={{ 
        position: 'absolute', 
        left: '50%', 
        transform: 'translateX(-50%)',
        top: 0, 
        bottom: 0, 
        width: '8px', 
        borderRadius: '4px', 
        backgroundColor: '#1a1a1a' 
      }} />
      {/* Filled track (from bottom) - centered horizontally */}
      <div style={{ 
        position: 'absolute', 
        left: '50%', 
        transform: 'translateX(-50%)',
        bottom: 0, 
        width: '8px', 
        height: `${value}%`, 
        borderRadius: '4px', 
        backgroundColor: color, 
        opacity: isMuted ? 0.3 : 1, 
        transition: 'opacity 0.2s, height 0.1s' 
      }} />
      {/* Vertical input - use orient attribute for Firefox, writing-mode for others */}
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="vertical-slider"
        style={{ 
          position: 'absolute',
          width: '24px',
          height: '100%',
          left: 0,
          top: 0,
          writingMode: 'vertical-lr',
          direction: 'rtl',
          background: 'transparent', 
          cursor: 'pointer' 
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
    <div className="h-full border-l border-border bg-bg-primary" style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: '8px', padding: '12px 8px' }}>
      <VerticalVolumeSlider
        label="Master"
        icon={<Volume2 size={18} />}
        value={masterVolume}
        isMuted={isMasterMuted}
        onChange={setMasterVolume}
        onToggleMute={toggleMasterMute}
        color="#3cf281"
      />
      <VerticalVolumeSlider
        label="Music"
        icon={<Music size={18} />}
        value={musicVolume}
        isMuted={isMusicMuted}
        onChange={setMusicVolume}
        onToggleMute={toggleMusicMute}
        color="#12e6c8"
      />
      <VerticalVolumeSlider
        label="Ambient"
        icon={<Waves size={18} />}
        value={ambientVolume}
        isMuted={isAmbientMuted}
        onChange={setAmbientVolume}
        onToggleMute={toggleAmbientMute}
        color="#a287f4"
      />
      <VerticalVolumeSlider
        label="Soundboard"
        icon={<Grid3X3 size={18} />}
        value={soundboardVolume}
        isMuted={isSoundboardMuted}
        onChange={setSoundboardVolume}
        onToggleMute={toggleSoundboardMute}
        color="#e44c55"
      />
    </div>
  );
};
