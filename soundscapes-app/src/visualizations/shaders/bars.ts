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
  uniform vec2 u_center_offset;
  
  const float PI = 3.14159265;
  const float bars = 32.0;
  
  // HSV to RGB
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
  
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    // Apply center offset (in pixels) to shift visualization center
    vec2 p = uv * 2.0 - 1.0 - (u_center_offset * 2.0 / u_resolution.xy);
    p.x *= u_resolution.x / u_resolution.y;
    
    vec3 c = vec3(0.0, 0.0, 0.08);
    
    // Center the bars
    float barWidth = 1.6 / bars;
    float gap = barWidth * 0.2;
    float totalWidth = bars * barWidth;
    float startX = -totalWidth * 0.5;
    
    for (float i = 0.0; i < bars; i++) {
      // Sample frequency - use 2 bins per bar for smoother look
      float freq1 = texture2D(u_frequencies, vec2((i * 2.0 + 0.5) / 64.0, 0.5)).r;
      float freq2 = texture2D(u_frequencies, vec2((i * 2.0 + 1.5) / 64.0, 0.5)).r;
      float freq = (freq1 + freq2) * 0.5;
      
      float barX = startX + i * barWidth + barWidth * 0.5;
      float barHeight = freq * 0.8 + 0.02; // Min height so bars are visible
      
      // Check if pixel is inside this bar
      float halfWidth = (barWidth - gap) * 0.5;
      if (abs(p.x - barX) < halfWidth && p.y > -0.4 && p.y < -0.4 + barHeight) {
        // Color based on bar index (rainbow)
        vec3 barCol = hsv2rgb(vec3(i / bars, 0.8, 1.0));
        
        // Gradient from bottom to top
        float gradientT = (p.y + 0.4) / barHeight;
        barCol *= 0.5 + gradientT * 0.5;
        
        c = barCol;
      }
      
      // Reflection (dimmer, below)
      float reflHeight = barHeight * 0.3;
      if (abs(p.x - barX) < halfWidth && p.y < -0.42 && p.y > -0.42 - reflHeight) {
        vec3 barCol = hsv2rgb(vec3(i / bars, 0.8, 1.0));
        float reflT = 1.0 - (-0.42 - p.y) / reflHeight;
        c = barCol * reflT * 0.3;
      }
    }
    
    // Dim when inactive
    if (!u_active) {
      c *= 0.2;
    }
    
    gl_FragColor = vec4(c, 1.0);
  }
`;

export const barsVisualization: Visualization = {
  meta: {
    id: 'bars',
    name: 'Bars',
    description: 'Classic frequency bar visualizer with reflection',
  },
  shaders: {
    vertex,
    fragment,
  },
};
