import { sendOsc, subscribeOsc, retain } from "../../osc";

export { sendOsc, subscribeOsc, retain };

// --- Channel paths for the Procedural Visuals Suite ---

export const getAvailableAddress = (docId: string, vizType: string) => `/procedural-suite/${docId}/${vizType}/available`;
export const getControlAddress = (docId: string, vizType: string, param: string) => `/procedural-suite/${docId}/${vizType}/control/${param}`;
export const getPingAddress = (docId: string) => `/procedural-suite/${docId}/ping`;

// The panel IDs mapped to the visualizations
export const VIZ_PANELS = {
  'bouncing-balls': 'Bouncing Balls',
  'fountain': 'Fountain',
  'recursive-subdivision': 'Recursive Subdivision',
  'topological-surfaces': 'Topological Surfaces',
};
