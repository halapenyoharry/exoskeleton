// TopoViewer types — mirrors the hypergraph.topothink.json format

export interface HypergraphMetadata {
  "topothink-version"?: string;
  adapter?: string;
  "source-format"?: string;
  "source-meta"?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface HyperNode {
  id: string;
  attrs?: Record<string, unknown>;
}

export interface HyperEdge {
  id: string;
  directed?: boolean;
  attrs?: Record<string, unknown>;
}

export interface Incidence {
  edge: string;
  node: string;
  role?: string;
  attrs?: Record<string, unknown>;
}

export interface Hypergraph {
  metadata?: HypergraphMetadata;
  nodes: HyperNode[];
  edges: HyperEdge[];
  incidences: Incidence[];
}

// Layout node with position + simulation fields
export interface LayoutNode {
  id: string;
  label: string;
  type: string;
  color: string;
  attrs: Record<string, unknown>;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  degree: number;
  predicates: Set<string>;
}

// Layout link derived from incidences
export interface LayoutLink {
  source: string | LayoutNode;
  target: string | LayoutNode;
  edgeId: string;
  predicate: string;
  label: string;
  directed: boolean;
  color: string;
}

// Layer info for the toggle sidebar
export interface Layer {
  predicate: string;
  count: number;
  color: string;
  visible: boolean;
}
