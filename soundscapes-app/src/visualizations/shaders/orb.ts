import { Visualization } from '../types';

const vertex = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragment = `
  precision highp float;
  
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform sampler2D u_frequencies;
  uniform bool u_active;
  uniform bool u_ambient_only;
  uniform float u_ambient_count;
  uniform float u_ambient_volume;
  
  const float dots = 64.0;
  const float radius = 0.22;
  const float brightness = 0.02;
  const float PI = 3.14159265;
  
  // HSV to RGB
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
  
  // Simple noise function for ambient mode
  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }
  
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), smoothstep(0.0, 1.0, f));
  }
  
  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float time = u_time;
    
    // Get bass energy from first few frequency bins for tempo-reactive rotation
    float bassEnergy = 0.0;
    for (float i = 0.0; i < 8.0; i++) {
      bassEnergy += texture2D(u_frequencies, vec2((i + 0.5) / 64.0, 0.5)).r;
    }
    bassEnergy = bassEnergy / 8.0;
    
    // Constant base rotation + bass adds extra rotation
    float baseAngle = time * 0.2;
    float bassBoost = bassEnergy * 0.5;
    float angle = baseAngle + bassBoost;
    float cosR = cos(angle);
    float sinR = sin(angle);
    p = vec2(p.x * cosR - p.y * sinR, p.x * sinR + p.y * cosR);
    
    vec3 c = vec3(0.0, 0.0, 0.1);
    
    for (float i = 0.0; i < dots; i++) {
      // Read frequency for this dot from audio texture
      float vol = texture2D(u_frequencies, vec2((i + 0.5) / dots, 0.5)).r;
      float b = vol * brightness;
      
      // Get location of dot on the circle
      float dotAngle = 2.0 * PI * i / dots;
      float x = radius * cos(dotAngle);
      float y = radius * sin(dotAngle);
      vec2 o = vec2(x, y);
      
      // Get color of dot based on its index
      vec3 dotCol = hsv2rgb(vec3(i / dots, 1.0, 1.0));
      
      // Get brightness based on distance to dot
      float d = length(p - o);
      c += b / (d * d * 8.0 + 0.01) * dotCol;
    }
    
    // Black circle overlay
    float dist = length(p);
    c = c * smoothstep(0.24, 0.26, dist);
    
    // Dim when inactive
    if (!u_active) {
      c *= 0.2;
    }
    
    gl_FragColor = vec4(c, 1.0);
  }
`;

export const orbVisualization: Visualization = {
  meta: {
    id: 'orb',
    name: 'Orb',
    description: 'Glowing frequency orb with rotating dots',
  },
  shaders: {
    vertex,
    fragment,
  },
};
