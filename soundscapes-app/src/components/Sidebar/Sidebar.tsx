import React, { useState } from 'react';
import { Music, Waves, Grid3X3, Settings, Power } from 'lucide-react';
import { useWindowStore, WindowType } from '../../stores/windowStore';
import { exit } from '@tauri-apps/plugin-process';

interface SidebarButtonProps {
  icon: React.ReactNode;
  isOpen: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  title: string;
}

const SidebarButton: React.FC<SidebarButtonProps> = ({ 
  icon, 
  isOpen, 
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick, 
  title 
}) => {
  // Color logic: white when closed, cyan when open, red on hover when open (to close)
  let colorClass = 'text-text-secondary hover:text-text-primary'; // closed
  if (isOpen) {
    colorClass = isHovered ? 'text-accent-red' : 'text-accent-cyan';
  }
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={isOpen && isHovered ? `Close ${title}` : title}
      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 ${colorClass}`}
    >
      {icon}
    </button>
  );
};

interface ExitDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ExitDialog: React.FC<ExitDialogProps> = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div 
        className="bg-bg-primary rounded-xl border border-border/50 shadow-2xl"
        style={{ padding: '24px', minWidth: '320px', maxWidth: '400px' }}
      >
        <h3 className="text-xl font-semibold text-text-primary" style={{ marginBottom: '8px' }}>
          Exit Soundscapes?
        </h3>
        <p className="text-text-secondary text-sm" style={{ marginBottom: '24px' }}>
          Are you sure you want to close the application?
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-secondary/80 transition-all"
            style={{ padding: '12px 16px', fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-accent-red text-white hover:opacity-90 transition-all"
            style={{ padding: '12px 16px', fontWeight: 500 }}
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { openWindows, toggleWindow } = useWindowStore();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<WindowType | null>(null);

  const handleExit = async () => {
    try {
      await exit(0);
    } catch {
      window.close();
    }
  };

  const buttons: { type: WindowType; icon: React.ReactNode; title: string }[] = [
    { type: 'music', icon: <Music size={22} />, title: 'Music Playlist' },
    { type: 'ambient', icon: <Waves size={22} />, title: 'Ambient Soundscapes' },
    { type: 'soundboard', icon: <Grid3X3 size={22} />, title: 'Soundboard' },
    { type: 'settings', icon: <Settings size={22} />, title: 'Settings' },
  ];

  return (
    <>
      <div className="w-14 bg-bg-primary/70 backdrop-blur-md border-r border-border/50 flex flex-col items-center" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
        <div className="flex-1 flex flex-col gap-2" style={{ paddingTop: '8px' }}>
          {buttons.map(({ type, icon, title }) => (
            <SidebarButton
              key={type}
              icon={icon}
              isOpen={openWindows.has(type)}
              isHovered={hoveredButton === type}
              onMouseEnter={() => setHoveredButton(type)}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={() => toggleWindow(type)}
              title={title}
            />
          ))}
        </div>
        
        <div style={{ paddingBottom: '8px' }}>
          <button
            onClick={() => setShowExitDialog(true)}
            title="Exit"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-accent-red/70 hover:text-accent-red transition-all duration-200"
          >
            <Power size={22} />
          </button>
        </div>
      </div>
      
      <ExitDialog
        isOpen={showExitDialog}
        onConfirm={handleExit}
        onCancel={() => setShowExitDialog(false)}
      />
    </>
  );
};
