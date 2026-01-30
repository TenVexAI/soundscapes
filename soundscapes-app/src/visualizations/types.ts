// Visualization system types

export interface VisualizationMeta {
  id: string;
  name: string;
  description: string;
}

export interface VisualizationShaders {
  vertex: string;
  fragment: string;
}

// Buffer pass definition for multi-pass shaders
export interface BufferPass {
  fragment: string;
  // Scale factor for buffer size (1.0 = full resolution, 0.25 = quarter, etc.)
  scale?: number;
  // Which previous buffers this pass reads from (by index)
  inputs?: number[];
}

export interface Visualization {
  meta: VisualizationMeta;
  shaders: VisualizationShaders;
  // Optional multi-pass buffers (rendered before main shader)
  buffers?: BufferPass[];
}

// Uniforms that all visualizations receive
export interface VisualizationUniforms {
  u_resolution: [number, number];
  u_time: number;
  u_frequencies: WebGLTexture;
  u_active: boolean;
  u_ambient_only: boolean;  // True when only ambient is playing (no music)
  u_ambient_count: number;  // Number of active ambient sounds
  u_ambient_volume: number; // Combined ambient volume
}
