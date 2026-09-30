export interface ProceduralSuiteParams {
  documentId?: string;
}

export type VizType = 'bouncing-balls' | 'fountain' | 'recursive-subdivision' | 'topological-surfaces';

export interface SuiteState {
  activeVisualizations: Record<VizType, boolean>;
}

export interface BouncingBallsState {
  count: number;
  gravity: number;
  restitution: number;
}

export interface FountainState {
  trailFade: number;
  sources: number;
  particleSize: number;
  animSpeed: number;
  colorScheme: string;
}

export interface RecursiveSubdivisionState {
  depth: number;
  variation: number;
  hue: string;
  triggerSeed: number; // A number to trigger new seed generation
}

export interface TopologicalSurfacesState {
  surface: string;
  shaderMode: number;
  colorPalette: number;
  speed: number;
  frequency: number;
  intensity: number;
  roughness: number;
  fresnel: number;
  wireframe: boolean;
  wireframeOpacity: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
}
