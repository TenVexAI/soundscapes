import React, { useRef, useEffect } from 'react';
import { useAudioStore } from '../../stores/audioStore';

export const Orb: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const { isMasterMuted } = useAudioStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      time += 0.02;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      if (isMasterMuted) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
        ctx.fillStyle = '#313131';
        ctx.fill();
        return;
      }

      // Animated orb without audio analyser
      const baseRadius = 70;
      const pulse = Math.sin(time) * 10;
      const radius = baseRadius + pulse;

      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 1.5
      );

      const hue = (Math.sin(time * 0.5) + 1) * 30 + 250; // Purple to cyan range
      const primaryColor = `hsla(${hue}, 70%, 60%, 1)`;
      
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(0.5, `hsla(${hue}, 60%, 50%, 0.6)`);
      gradient.addColorStop(1, 'rgba(20, 20, 20, 0)');

      ctx.beginPath();
      
      const points = 64;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const distortion = Math.sin(angle * 3 + time * 2) * 5;
        
        const r = radius + distortion;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 30;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isMasterMuted]);

  return (
    <div className="flex items-center justify-center flex-1">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="rounded-full"
      />
    </div>
  );
};
