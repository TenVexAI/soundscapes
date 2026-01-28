import React, { useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAudioStore } from '../../stores/audioStore';

interface PlaybackState {
  music_playing: boolean;
  music_volume: number;
  ambient_count: number;
  ambient_volume: number;
  master_volume: number;
  is_muted: boolean;
  frequencies: number[];
}

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform sampler2D u_frequencies;
  uniform bool u_active;
  
  const float dots = 64.0;
  const float radius = 0.22; // Position dots inside the dark circle edge
  const float brightness = 0.02;
  const float PI = 3.14159265;
  
  // HSV to RGB
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
  
  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float time = u_time;
    
    // Get bass energy from first few frequency bins for tempo-reactive rotation
    float bassEnergy = 0.0;
    for (float i = 0.0; i < 8.0; i++) {
      bassEnergy += texture2D(u_frequencies, vec2((i + 0.5) / 64.0, 0.5)).r;
    }
    bassEnergy = bassEnergy / 8.0; // Average of first 8 bins (bass frequencies)
    
    // Constant base rotation + bass adds extra rotation (never goes backwards)
    float baseAngle = time * 0.2;
    float bassBoost = bassEnergy * 0.5; // Bass adds up to 0.5 radians extra
    float angle = baseAngle + bassBoost;
    float cosR = cos(angle);
    float sinR = sin(angle);
    p = vec2(p.x * cosR - p.y * sinR, p.x * sinR + p.y * cosR);
    
    vec3 c = vec3(0.0, 0.0, 0.1); // background color
    
    for (float i = 0.0; i < dots; i++) {
      // Read frequency for this dot from audio texture
      float vol = texture2D(u_frequencies, vec2((i + 0.5) / dots, 0.5)).r;
      float b = vol * brightness;
      
      // Get location of dot on the circle
      float angle = 2.0 * PI * i / dots;
      float x = radius * cos(angle);
      float y = radius * sin(angle);
      vec2 o = vec2(x, y);
      
      // Get color of dot based on its index (static rainbow: bass=red, treble=violet)
      vec3 dotCol = hsv2rgb(vec3(i / dots, 1.0, 1.0));
      
      // Get brightness based on distance to dot (squared falloff for tighter glow)
      float d = length(p - o);
      c += b / (d * d * 8.0 + 0.01) * dotCol;
    }
    
    // Black circle overlay covers the dots - only their glow extends outside
    float dist = length(p);
    c = c * smoothstep(0.24, 0.26, dist);
    
    // Dim when inactive
    if (!u_active) {
      c *= 0.2;
    }
    
    gl_FragColor = vec4(c, 1.0);
  }
`;

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

export const Orb: React.FC = () => {
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
  });
  const frequencyTextureRef = useRef<WebGLTexture | null>(null);
  const smoothedFreqRef = useRef<Float32Array>(new Float32Array(64));
  const { isMasterMuted } = useAudioStore();

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

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
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
    const freqTexture = gl.createTexture();
    frequencyTextureRef.current = freqTexture;
    gl.bindTexture(gl.TEXTURE_2D, freqTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Initialize with zeros
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 64, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(64));

    startTimeRef.current = Date.now();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

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

      // Smooth frequency values (higher = more reactive, lower = smoother)
      const frequencies = state.frequencies || [];
      for (let i = 0; i < 64; i++) {
        const target = frequencies[i] || 0;
        smoothedFreqRef.current[i] += (target - smoothedFreqRef.current[i]) * 0.5;
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
      const time = (Date.now() - startTimeRef.current) / 1000;
      
      gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(program, 'u_time'), time);
      gl.uniform1i(gl.getUniformLocation(program, 'u_active'), isActive ? 1 : 0);
      
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
  }, [isMasterMuted]);

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
