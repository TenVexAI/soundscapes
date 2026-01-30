import { Visualization } from './types';
import { orbVisualization } from './shaders/orb';
import { barsVisualization } from './shaders/bars';
import { simplebarsVisualization } from './shaders/simplebars';

// Registry of all available visualizations
export const visualizations: Record<string, Visualization> = {
  orb: orbVisualization,
  bars: barsVisualization,
  simplebars: simplebarsVisualization,
};

// Get visualization by ID, with fallback to orb
export function getVisualization(id: string): Visualization {
  return visualizations[id] || visualizations.orb;
}

// Get list of all visualizations for UI
export function getVisualizationList(): Array<{ id: string; name: string; description: string }> {
  return Object.values(visualizations).map(v => v.meta);
}

// Default visualization ID
export const DEFAULT_VISUALIZATION = 'orb';

export * from './types';
