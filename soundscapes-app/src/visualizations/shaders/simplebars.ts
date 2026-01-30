import { Visualization } from '../types';

// Simple Bars Visualization
// Minimalist white bars on black background

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
  uniform vec2 u_center_offset;
  
  void main() {
    vec2 fragCoord = gl_FragCoord.xy - u_center_offset;
    vec2 R = u_resolution.xy;
    vec2 U = fragCoord / R;
    U = 100.0 * vec2(U.x * 1.305 - 0.145, abs(U.y - 0.5));
    
    float freq = texture2D(u_frequencies, vec2(floor(U.x) * 0.01, 0.5)).r * 15.0 + 0.5;
    
    float bar = max(
      smoothstep(0.1, 0.2 + 120.0 / R.x, length(vec2(fract(U.x) - 0.5, U.y - freq * min(U.y / freq, 1.0)))),
      step(50.0, abs(U.x - 50.0))
    );
    
    // Invert: black background, cyan bars
    float col = 1.0 - bar;
    vec3 cyan = vec3(0.07, 0.90, 0.78); // #12e6c8
    
    // Dim when inactive
    if (!u_active) {
      col *= 0.2;
    }
    
    gl_FragColor = vec4(cyan * col, 1.0);
  }
`;

export const simplebarsVisualization: Visualization = {
  meta: {
    id: 'simplebars',
    name: 'Simple Bars',
    description: 'Minimalist white bars on black background',
  },
  shaders: {
    vertex,
    fragment,
  },
};
