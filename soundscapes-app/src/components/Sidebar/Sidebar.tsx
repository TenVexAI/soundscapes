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
    colorClass = isHovered ? 'text-red-400' : 'text-accent-cyan';
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-bg-secondary rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-border">
        <h3 className="text-lg font-semibold text-text-primary mb-2">Exit Soundscapes?</h3>
        <p className="text-text-secondary mb-6">Are you sure you want to close the application?</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg bg-bg-primary text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
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
      <div className="w-14 bg-bg-primary border-r border-border flex flex-col items-center py-4">
        <div className="flex-1 flex flex-col gap-2">
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
        
        <div className="mt-auto">
          <button
            onClick={() => setShowExitDialog(true)}
            title="Exit"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-red-400/70 hover:text-red-400 transition-all duration-200"
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
