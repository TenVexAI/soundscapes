import React, { useRef, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAudioStore } from '../../stores/audioStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getVisualization, DEFAULT_VISUALIZATION } from '../../visualizations';

interface PlaybackState {
  music_playing: boolean;
  music_volume: number;
  ambient_count: number;
  ambient_volume: number;
  master_volume: number;
  is_muted: boolean;
  frequencies: number[];
  ambient_frequencies: number[];
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  
  return program;
}

export const Visualizer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const stateRef = useRef<PlaybackState>({
    music_playing: false,
    music_volume: 0,
    ambient_count: 0,
    ambient_volume: 0,
    master_volume: 1,
    is_muted: false,
    frequencies: new Array(64).fill(0),
    ambient_frequencies: new Array(64).fill(0),
  });
  const frequencyTextureRef = useRef<WebGLTexture | null>(null);
  const smoothedFreqRef = useRef<Float32Array>(new Float32Array(64));
  const { isMasterMuted } = useAudioStore();
  const { settings } = useSettingsStore();
  
  const [currentVizId, setCurrentVizId] = useState<string>(DEFAULT_VISUALIZATION);

  // Track visualization setting changes
  useEffect(() => {
    const vizId = settings?.visualization_type || DEFAULT_VISUALIZATION;
    if (vizId !== currentVizId) {
      setCurrentVizId(vizId);
    }
  }, [settings?.visualization_type, currentVizId]);

  // Poll playback state from backend
  useEffect(() => {
    let mounted = true;
    
    const pollState = async () => {
      if (!mounted) return;
      try {
        const state = await invoke<PlaybackState>('get_playback_state');
        stateRef.current = state;
      } catch {
        // Ignore errors during polling
      }
      if (mounted) {
        setTimeout(pollState, 100);
      }
    };
    
    pollState();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize/reinitialize WebGL when visualization changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clean up existing program
    if (programRef.current && glRef.current) {
      glRef.current.deleteProgram(programRef.current);
      programRef.current = null;
    }

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    // Get current visualization shaders
    const viz = getVisualization(currentVizId);

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, viz.shaders.vertex);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, viz.shaders.fragment);
    
    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;
    programRef.current = program;

    // Set up geometry (full-screen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1, 1,   1, -1,   1, 1,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Create frequency texture (64x1 texture for FFT data)
    if (!frequencyTextureRef.current) {
      const freqTexture = gl.createTexture();
      frequencyTextureRef.current = freqTexture;
      gl.bindTexture(gl.TEXTURE_2D, freqTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 64, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(64));
    }

    startTimeRef.current = Date.now();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentVizId]);

  // Animation loop
  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const canvas = canvasRef.current;
    const freqTexture = frequencyTextureRef.current;
    
    if (!gl || !program || !canvas || !freqTexture) return;

    const render = () => {
      animationRef.current = requestAnimationFrame(render);

      const state = stateRef.current;
      const isActive = !isMasterMuted && !state.is_muted && 
        (state.music_playing || state.ambient_count > 0);
      
      // Determine if we're in ambient-only mode (no music playing)
      const ambientOnly = !state.music_playing && state.ambient_count > 0;
      const time = (Date.now() - startTimeRef.current) / 1000;

      // Get frequencies - use music FFT when playing, otherwise use real ambient FFT
      let frequencies: number[];
      if (ambientOnly) {
        // Use real ambient FFT data from backend
        frequencies = state.ambient_frequencies || [];
      } else {
        frequencies = state.frequencies || [];
      }

      // Smooth frequency values
      for (let i = 0; i < 64; i++) {
        const target = frequencies[i] || 0;
        // Slightly different smoothing for ambient mode (slower, more organic)
        const smoothFactor = ambientOnly ? 0.15 : 0.5;
        smoothedFreqRef.current[i] += (target - smoothedFreqRef.current[i]) * smoothFactor;
      }

      // Update frequency texture
      const freqData = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        freqData[i] = Math.min(255, Math.floor(smoothedFreqRef.current[i] * 255));
      }
      gl.bindTexture(gl.TEXTURE_2D, freqTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 64, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, freqData);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);

      // Set uniforms
      gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(program, 'u_time'), time);
      gl.uniform1i(gl.getUniformLocation(program, 'u_active'), isActive ? 1 : 0);
      gl.uniform1i(gl.getUniformLocation(program, 'u_ambient_only'), ambientOnly ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(program, 'u_ambient_count'), state.ambient_count);
      gl.uniform1f(gl.getUniformLocation(program, 'u_ambient_volume'), state.ambient_volume);
      
      // Bind frequency texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, freqTexture);
      gl.uniform1i(gl.getUniformLocation(program, 'u_frequencies'), 0);

      // Draw
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isMasterMuted, currentVizId]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex-1 w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
};
