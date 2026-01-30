import React, { useRef, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAudioStore } from '../../stores/audioStore';
import { getVisualization, DEFAULT_VISUALIZATION } from '../../visualizations';
import { Visualization } from '../../visualizations/types';

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

interface BufferTarget {
  framebuffers: WebGLFramebuffer[];  // Two for ping-pong
  textures: WebGLTexture[];          // Two for ping-pong
  program: WebGLProgram;
  width: number;
  height: number;
  pingPong: number;                  // 0 or 1, toggles each frame
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error('Failed to create shader');
    return null;
  }
  
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const typeStr = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
    console.error(`${typeStr} shader compile error:`, gl.getShaderInfoLog(shader));
    console.error('Shader source:', source.substring(0, 200));
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

function createBufferTarget(gl: WebGLRenderingContext, width: number, height: number, vertexSource: string, fragmentSource: string, bufferIndex: number): BufferTarget | null {
  // Each program needs its own vertex shader instance
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  if (!vertexShader) {
    console.error(`Buffer ${bufferIndex}: Failed to create vertex shader`);
    return null;
  }
  
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!fragmentShader) {
    console.error(`Buffer ${bufferIndex}: Failed to create fragment shader`);
    return null;
  }
  
  const program = createProgram(gl, vertexShader, fragmentShader);
  if (!program) {
    console.error(`Buffer ${bufferIndex}: Failed to create program`);
    return null;
  }
  
  console.log(`Buffer ${bufferIndex}: Created successfully (${width}x${height})`);
  
  // Create two textures and framebuffers for ping-pong rendering
  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];
  
  for (let i = 0; i < 2; i++) {
    const texture = gl.createTexture();
    if (!texture) return null;
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.push(texture);
    
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) return null;
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    framebuffers.push(framebuffer);
  }
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  
  return { framebuffers, textures, program, width, height, pingPong: 0 };
}

function setupMultiPassRendering(
  gl: WebGLRenderingContext, 
  viz: Visualization, 
  vertexSource: string,
  canvasWidth: number,
  canvasHeight: number
): BufferTarget[] {
  const buffers: BufferTarget[] = [];
  
  if (!viz.buffers) return buffers;
  
  for (let i = 0; i < viz.buffers.length; i++) {
    const bufferDef = viz.buffers[i];
    const scale = bufferDef.scale || 1.0;
    const width = Math.max(1, Math.floor(canvasWidth * scale));
    const height = Math.max(1, Math.floor(canvasHeight * scale));
    
    const buffer = createBufferTarget(gl, width, height, vertexSource, bufferDef.fragment, i);
    if (buffer) {
      buffers.push(buffer);
    } else {
      console.error(`Failed to create buffer ${i}`);
    }
  }
  
  return buffers;
}

export const Visualizer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const buffersRef = useRef<BufferTarget[]>([]);
  const frameCountRef = useRef<number>(0);
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
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const { isMasterMuted } = useAudioStore();
  
  const [currentVizId, setCurrentVizId] = useState<string>(DEFAULT_VISUALIZATION);

  // Poll visualization type from backend (settings window is separate process)
  useEffect(() => {
    let mounted = true;
    
    const pollVizType = async () => {
      if (!mounted) return;
      try {
        const backendSettings = await invoke<{ visualization_type?: string }>('get_settings');
        const vizId = backendSettings?.visualization_type || DEFAULT_VISUALIZATION;
        if (vizId !== currentVizId) {
          setCurrentVizId(vizId);
        }
      } catch {
        // Ignore errors
      }
      if (mounted) {
        setTimeout(pollVizType, 500); // Check every 500ms
      }
    };
    
    pollVizType();
    
    return () => {
      mounted = false;
    };
  }, [currentVizId]);

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

  // Initialize WebGL and run animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clean up existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }

    // Clean up existing program and buffers
    if (glRef.current) {
      if (programRef.current) {
        glRef.current.deleteProgram(programRef.current);
        programRef.current = null;
      }
      for (const buf of buffersRef.current) {
        for (const fb of buf.framebuffers) glRef.current.deleteFramebuffer(fb);
        for (const tex of buf.textures) glRef.current.deleteTexture(tex);
        glRef.current.deleteProgram(buf.program);
      }
      buffersRef.current = [];
    }

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    // Get current visualization
    const viz = getVisualization(currentVizId);

    // Set up geometry (full-screen quad) - shared by all passes
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1, 1,   1, -1,   1, 1,
    ]), gl.STATIC_DRAW);

    // Create buffer passes if visualization has them (pass vertex source, not compiled shader)
    const buffers = setupMultiPassRendering(gl, viz, viz.shaders.vertex, canvas.width, canvas.height);
    buffersRef.current = buffers;

    // Set up position attribute for each buffer program
    for (const buf of buffers) {
      gl.useProgram(buf.program);
      const posLoc = gl.getAttribLocation(buf.program, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    }

    // Create main shader program (needs its own vertex shader instance)
    const mainVertexShader = createShader(gl, gl.VERTEX_SHADER, viz.shaders.vertex);
    if (!mainVertexShader) return;
    
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, viz.shaders.fragment);
    if (!fragmentShader) return;

    const program = createProgram(gl, mainVertexShader, fragmentShader);
    if (!program) return;
    programRef.current = program;

    // Set up position attribute for main program
    gl.useProgram(program);
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Create frequency texture (64x1 texture for FFT data)
    const freqTexture = gl.createTexture();
    frequencyTextureRef.current = freqTexture;
    gl.bindTexture(gl.TEXTURE_2D, freqTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 64, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(64));

    startTimeRef.current = Date.now();
    frameCountRef.current = 0;

    // Animation loop
    const render = () => {
      animationRef.current = requestAnimationFrame(render);
      frameCountRef.current++;

      const state = stateRef.current;
      const isActive = !isMasterMuted && !state.is_muted && 
        (state.music_playing || state.ambient_count > 0);
      
      const ambientOnly = !state.music_playing && state.ambient_count > 0;
      const time = (Date.now() - startTimeRef.current) / 1000;

      // Get frequencies
      let frequencies: number[];
      if (ambientOnly) {
        frequencies = state.ambient_frequencies || [];
      } else {
        frequencies = state.frequencies || [];
      }

      // Smooth frequency values
      for (let i = 0; i < 64; i++) {
        const target = frequencies[i] || 0;
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

      // Helper to set common uniforms
      const setCommonUniforms = (prog: WebGLProgram, width: number, height: number) => {
        gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), width, height);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), time);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_frame'), frameCountRef.current);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_active'), isActive ? 1 : 0);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_ambient_only'), ambientOnly ? 1 : 0);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_ambient_count'), state.ambient_count);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_ambient_volume'), state.ambient_volume);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_center_offset'), -40.0, 36.0);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_mouse'), mouseRef.current.x * width, mouseRef.current.y * height);
      };

      // Render buffer passes with ping-pong to avoid feedback loops
      for (let i = 0; i < buffers.length; i++) {
        const buf = buffers[i];
        const writeIdx = buf.pingPong;
        const readIdx = 1 - buf.pingPong;
        
        // Write to current framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, buf.framebuffers[writeIdx]);
        gl.viewport(0, 0, buf.width, buf.height);
        gl.useProgram(buf.program);
        
        setCommonUniforms(buf.program, buf.width, buf.height);

        // Bind frequency texture to unit 0
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, freqTexture);
        gl.uniform1i(gl.getUniformLocation(buf.program, 'u_frequencies'), 0);

        // Bind previous buffer textures as iChannel0, iChannel1, etc.
        for (let j = 0; j < i; j++) {
          const prevBuf = buffers[j];
          gl.activeTexture(gl.TEXTURE1 + j);
          // Read from the texture that was just written to (current pingPong index)
          gl.bindTexture(gl.TEXTURE_2D, prevBuf.textures[prevBuf.pingPong]);
          gl.uniform1i(gl.getUniformLocation(buf.program, `iChannel${j}`), 1 + j);
          gl.uniform2f(gl.getUniformLocation(buf.program, `iChannelResolution${j}`), prevBuf.width, prevBuf.height);
        }

        // Bind self for feedback - read from OTHER texture (previous frame)
        gl.activeTexture(gl.TEXTURE1 + i);
        gl.bindTexture(gl.TEXTURE_2D, buf.textures[readIdx]);
        gl.uniform1i(gl.getUniformLocation(buf.program, `iChannel${i}`), 1 + i);
        gl.uniform2f(gl.getUniformLocation(buf.program, `iChannelResolution${i}`), buf.width, buf.height);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // Toggle ping-pong for next frame
        buf.pingPong = writeIdx;
      }

      // Render final pass to screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      
      setCommonUniforms(program, canvas.width, canvas.height);

      // Bind frequency texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, freqTexture);
      gl.uniform1i(gl.getUniformLocation(program, 'u_frequencies'), 0);

      // Bind all buffer textures for final pass (read from just-written textures)
      for (let i = 0; i < buffers.length; i++) {
        const buf = buffers[i];
        gl.activeTexture(gl.TEXTURE1 + i);
        gl.bindTexture(gl.TEXTURE_2D, buf.textures[buf.pingPong]);
        gl.uniform1i(gl.getUniformLocation(program, `iChannel${i}`), 1 + i);
        gl.uniform2f(gl.getUniformLocation(program, `iChannelResolution${i}`), buf.width, buf.height);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentVizId, isMasterMuted]);

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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.x = (e.clientX - rect.left) / rect.width;
    mouseRef.current.y = 1.0 - (e.clientY - rect.top) / rect.height; // Flip Y for GL
  };

  return (
    <div ref={containerRef} className="flex-1 w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
      />
    </div>
  );
};
