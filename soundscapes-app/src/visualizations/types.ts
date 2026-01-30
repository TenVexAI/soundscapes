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

export interface Visualization {
  meta: VisualizationMeta;
  shaders: VisualizationShaders;
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
