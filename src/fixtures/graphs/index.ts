// Bundled graph library: sample JSON documents across shapes, loaded lazily.
// Each entry's `shape` tells a viewer which family it belongs to:
//   hierarchy - nested objects/arrays (json-tree, json-circles, json-mass)
//   graph     - nodes + links arrays (json-graph, json-cytoscape, json-graph3d)
//   topology  - TopoThink kind node|hyperedge documents (json-dyadic)
//   messy     - deliberately irregular, for parser tolerance

export interface GraphLibraryEntry {
  id: string;
  title: string;
  description: string;
  shape: 'hierarchy' | 'graph' | 'topology' | 'messy';
  load: () => Promise<unknown>;
}

export const graphLibrary: GraphLibraryEntry[] = [
  {
    id: 'star-hub',
    title: 'Star hub',
    description: 'One hub, 12 spokes; two spokes are sub-hubs with three leaves each.',
    shape: 'graph',
    load: () => import('./star-hub.json').then((m) => m.default),
  },
  {
    id: 'deep-hierarchy',
    title: 'Deep hierarchy',
    description: 'Six levels of uneven nesting with 80 leaves. Tree and circles stress test.',
    shape: 'hierarchy',
    load: () => import('./deep-hierarchy.json').then((m) => m.default),
  },
  {
    id: 'dense-mesh',
    title: 'Dense mesh',
    description: '40 nodes, 120 links, four groups. Force and 3D stress test.',
    shape: 'graph',
    load: () => import('./dense-mesh.json').then((m) => m.default),
  },
  {
    id: 'state-chain',
    title: 'State chain',
    description: 'TopoThink topology: a chain of 8 state changes across 9 states, inside 3 containment enclosures.',
    shape: 'topology',
    load: () => import('./state-chain.json').then((m) => m.default),
  },
  {
    id: 'les-miserables',
    title: 'Les Misérables',
    description: 'Character co-appearance network: 77 characters, 254 links. Classic D3 dataset.',
    shape: 'graph',
    load: () => import('./les-miserables.json').then((m) => m.default),
  },
  {
    id: 'karate-club',
    title: 'Karate club',
    description: 'Zachary karate club: 34 members, 78 friendships, two factions.',
    shape: 'graph',
    load: () => import('./karate-club.json').then((m) => m.default),
  },
  {
    id: 'repo-file-tree',
    title: 'Repo file tree',
    description: 'Nested tree of this repo src/ directory. Leaves are file sizes in bytes.',
    shape: 'hierarchy',
    load: () => import('./repo-file-tree.json').then((m) => m.default),
  },
  {
    id: 'package-deps',
    title: 'Package dependencies',
    description: 'package.json as a graph: project node linked to each dependency and devDependency.',
    shape: 'graph',
    load: () => import('./package-deps.json').then((m) => m.default),
  },
  {
    id: 'messy',
    title: 'Messy (tolerance test)',
    description: 'Irregular JSON: mixed types, nulls, numeric strings, unicode keys, empty containers.',
    shape: 'messy',
    load: () => import('./messy.json').then((m) => m.default),
  },
  {
    id: 'berry-thief',
    title: 'Berry Thief',
    description: 'The Epic of Elinor Jones, Act 1, Chapter 1: 70 entities, 117 relations, hand-built gold extraction (information2topology/data/examples/berry-thief).',
    shape: 'topology',
    load: () => import('./berry-thief.json').then((m) => m.default),
  },
  {
    id: 'exoskeleton-system',
    title: 'Exoskeleton system map',
    description: 'Hand-verified TopoThink map of the Exoskeleton app: containment, state change, interactivity, reference.',
    shape: 'topology',
    load: () => import('./exoskeleton-system.json').then((m) => m.default),
  },
];
