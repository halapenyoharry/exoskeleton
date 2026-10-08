import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import ForceGraph3D from "react-force-graph-3d";
import type { ForceGraphMethods } from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import {
  getActiveDocumentId,
  onActiveDocumentIdChange,
  areGraphsConnected,
  onGraphsConnectionChange,
  broadcastNodeSelection,
  onNodeSelectionBroadcast,
  broadcastNodeFocus,
  onNodeFocusBroadcast,
} from "../../osc/channels";
import type { DetectedGraph, GraphNode } from "../../data/json-utils/graphDetect";
import { useJsonDoc } from "../../data/useJsonDoc";
import { getDocStats, getDetectedGraph } from "../../data/json-utils/docStats";
import { useElementSize } from "../../useElementSize";
import { buildLayerVisibility } from "../../data/json-utils/layers";
import type { EdgeCategory } from "../json-dyadic/types";
import { CATEGORY_ORDER, CATEGORY_TOKENS } from "../json-dyadic/categories";
import {
  CATEGORY_WIDTH,
  containmentGroups,
  degreeMap,
  linkColor,
  linkInlineText,
  nodeColor,
  resolveLinkCategory,
  slug,
  type ColorOverrides,
  type ContainmentGroup,
  type EdgeColorBy,
} from "./inspect-model";
import "./JsonGraph3DInspectPanel.css";

export type InspectLabelMode = "always" | "hover" | "never";
export type NodeSizeBy = "degree" | "uniform";
export type HullMode = "ellipsoid" | "convex";

export interface JsonGraph3DInspectParams {
  documentId: string;
  dimensions: 2 | 3;
  freezeLayout: boolean;
  layerVisibility: Record<string, boolean>;
  backgroundColor: string;

  // Node text
  labelMaxWords: number;
  fontFace: string;
  fontWeight: string;
  fontResolution: number;
  strokeWidth: number;
  strokeColor: string;
  nodeSizeBy: NodeSizeBy;
  nodeTextHeightMin: number;
  nodeTextHeightMax: number;
  hyperedgeTextScale: number;
  nodeDefaultColor: string;
  selectedColor: string;

  // Edges
  edgeLabels: InspectLabelMode;
  edgeLabelTextHeight: number;
  edgeColorBy: EdgeColorBy;
  colorOverrides: ColorOverrides;
  linkWidth: number;
  linkOpacity: number;
  arrowLength: number;
  curvature: number;
  showContainmentLinks: boolean;
  particles: boolean;
  particleCount: number;
  particleSpeed: number;

  // Containment hulls
  hulls: boolean;
  hullMode: HullMode;
  hullOpacity: number;
  hullPadding: number;
  hullRebuildEveryTicks: number;

  // Misc
  showLegend: boolean;
  tooltipMaxAttrs: number;
  tooltipValueMaxLen: number;
  fitDuration: number;
  fitPadding: number;
  fitDelayMs: number;
  cooldownTicks: number;
  nodeThreshold: number;
}

export const jsonGraph3DInspectDefaults: JsonGraph3DInspectParams = {
  documentId: "default",
  dimensions: 3,
  freezeLayout: false,
  layerVisibility: {},
  backgroundColor: "#0a0e26",

  labelMaxWords: 5,
  // Sans, heavy, with a dark stroke: the brief is "readable from the
  // chair with glasses on", not "pretty up close".
  fontFace: "system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  fontWeight: "700",
  fontResolution: 120,
  strokeWidth: 0.08,
  strokeColor: "#05071a",
  nodeSizeBy: "degree",
  nodeTextHeightMin: 3.5,
  nodeTextHeightMax: 9,
  hyperedgeTextScale: 0.7,
  nodeDefaultColor: "#dff6ff",
  selectedColor: "#ff007f",

  edgeLabels: "always",
  edgeLabelTextHeight: 1.8,
  edgeColorBy: "category",
  colorOverrides: {},
  linkWidth: 0.8,
  linkOpacity: 0.55,
  arrowLength: 3.5,
  curvature: 0.25,
  showContainmentLinks: false,
  particles: false,
  particleCount: 2,
  particleSpeed: 0.006,

  hulls: true,
  hullMode: "ellipsoid",
  hullOpacity: 0.12,
  hullPadding: 8,
  hullRebuildEveryTicks: 2,

  showLegend: true,
  tooltipMaxAttrs: 12,
  tooltipValueMaxLen: 80,
  fitDuration: 600,
  fitPadding: 60,
  fitDelayMs: 800,
  cooldownTicks: 200,
  nodeThreshold: 5000,
};

interface FGLink {
  source: string;
  target: string;
  text: string;
  category?: EdgeCategory;
  color: string;
  width: number;
  curvature: number;
  rotation: number;
  directed: boolean;
  layer?: string;
  label?: string;
  role?: string;
  attrs?: Record<string, unknown>;
}

interface FGNode {
  id: string;
  name: string;
  kind?: GraphNode["kind"];
  attrs?: Record<string, unknown>;
  degree: number;
  color: string;
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attrsToHtml(
  attrs: Record<string, unknown> | undefined,
  header: string,
  maxAttrs: number,
  maxLen: number,
): string {
  if (!attrs) return escapeHtml(header);
  const rows = Object.entries(attrs)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .slice(0, maxAttrs)
    .map(([k, v]) => {
      const val = typeof v === "object" ? JSON.stringify(v) : String(v);
      const truncated =
        val.length > maxLen ? val.slice(0, maxLen - 3) + "..." : val;
      return `<div><span style="opacity:0.6">${escapeHtml(k)}</span>: ${escapeHtml(truncated)}</div>`;
    })
    .join("");
  return `<div><strong>${escapeHtml(header)}</strong>${rows}</div>`;
}

/** Fan out multi-edges between the same pair so each one is visible. */
function fanOut(links: FGLink[], baseCurvature: number): void {
  const groups = new Map<string, number[]>();
  links.forEach((l, i) => {
    const key = l.source < l.target ? `${l.source}|${l.target}` : `${l.target}|${l.source}`;
    const arr = groups.get(key) ?? [];
    arr.push(i);
    groups.set(key, arr);
  });
  for (const indices of groups.values()) {
    const n = indices.length;
    indices.forEach((idx, i) => {
      links[idx].curvature = n === 1 ? 0 : baseCurvature;
      links[idx].rotation = n === 1 ? 0 : (i / n) * Math.PI * 2;
    });
  }
}

/** One live hull: the mesh in the scene plus the group it tracks. */
interface HullHandle {
  group: ContainmentGroup;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
}

export default function JsonGraph3DInspectPanel(
  props: IDockviewPanelProps<JsonGraph3DInspectParams>,
) {
  const params: JsonGraph3DInspectParams = {
    ...jsonGraph3DInspectDefaults,
    ...(props.params ?? {}),
  };
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const updateParam = <K extends keyof JsonGraph3DInspectParams>(
    key: K,
    value: JsonGraph3DInspectParams[K],
  ) => {
    props.api.updateParameters({ ...params, [key]: value });
  };

  const [activeDocId, setActiveDocId] = useState(params.documentId);
  const [connected, setConnected] = useState(areGraphsConnected());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => onGraphsConnectionChange(setConnected), []);

  useEffect(() => {
    if (!connected) {
      setActiveDocId(params.documentId);
      return;
    }
    setActiveDocId(getActiveDocumentId());
    return onActiveDocumentIdChange(setActiveDocId);
  }, [connected, params.documentId]);

  const doc = useJsonDoc(props.api, activeDocId);

  const [bypassPerf, setBypassPerf] = useState(false);
  const stats = doc === undefined ? null : getDocStats(doc);
  const isGraph = stats?.isGraph ?? false;
  const nodeCount = stats?.graphNodeCount ?? 0;
  const perfBlocked = nodeCount > params.nodeThreshold && !bypassPerf;

  const graph = useMemo<DetectedGraph | null>(() => {
    if (doc === undefined || perfBlocked) return null;
    return getDetectedGraph(doc);
  }, [doc, perfBlocked]);

  useEffect(() => {
    const next = buildLayerVisibility(graph, params.layerVisibility);
    if (JSON.stringify(next) !== JSON.stringify(params.layerVisibility)) {
      updateParam("layerVisibility", next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(containerRef);
  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);

  // Everything color/size-shaped is computed once per (graph, scheme) so
  // the accessor functions handed to the renderer stay cheap and stable.
  const overridesKey = JSON.stringify(params.colorOverrides);
  const model = useMemo(() => {
    if (!graph) {
      return {
        data: { nodes: [] as FGNode[], links: [] as FGLink[] },
        groups: [] as ContainmentGroup[],
        nodesById: new Map<string, FGNode>(),
        maxDegree: 1,
      };
    }
    const byId = new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]));
    const degrees = degreeMap(graph);
    let maxDegree = 1;
    for (const d of degrees.values()) maxDegree = Math.max(maxDegree, d);
    const nodes: FGNode[] = graph.nodes.map((n) => ({
      id: n.id,
      name: n.label || n.id,
      kind: n.kind,
      attrs: n.attrs,
      degree: degrees.get(n.id) ?? 0,
      color: nodeColor(n, params.colorOverrides, params.nodeDefaultColor),
    }));
    const links: FGLink[] = graph.links.map((l) => {
      const category = resolveLinkCategory(l, byId);
      return {
        source: l.source,
        target: l.target,
        text: linkInlineText(l),
        category,
        color: linkColor(l, category, params.edgeColorBy, params.colorOverrides),
        width: params.linkWidth * (category ? CATEGORY_WIDTH[category] : 1),
        curvature: 0,
        rotation: 0,
        directed: l.directed !== false,
        layer: l.layer,
        label: l.label,
        role: l.role,
        attrs: l.attrs,
      };
    });
    fanOut(links, params.curvature);
    return {
      data: { nodes, links },
      groups: containmentGroups(graph, byId),
      nodesById: new Map(nodes.map((n) => [n.id, n])),
      maxDegree,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, overridesKey, params.edgeColorBy, params.linkWidth, params.curvature, params.nodeDefaultColor]);

  const { data, groups, nodesById, maxDegree } = model;

  // --- Node sprites -------------------------------------------------------
  // Sprites are kept in a map so selection can recolor one sprite instead
  // of rebuilding all of them. The accessor identity only changes when a
  // text-shaping param changes (styleKey), which is when a rebuild is
  // actually needed.
  const spritesRef = useRef(new Map<string, SpriteText>());
  const styleKey = [
    params.labelMaxWords,
    params.fontFace,
    params.fontWeight,
    params.fontResolution,
    params.strokeWidth,
    params.strokeColor,
    params.nodeSizeBy,
    params.nodeTextHeightMin,
    params.nodeTextHeightMax,
    params.hyperedgeTextScale,
    maxDegree,
  ].join("|");

  const nodeThreeObject = useCallback(
    (n: FGNode) => {
      const p = paramsRef.current;
      const sprite = new SpriteText(slug(n.name, p.labelMaxWords));
      const t =
        p.nodeSizeBy === "degree"
          ? Math.sqrt(n.degree / Math.max(1, maxDegree))
          : 0.5;
      let height = p.nodeTextHeightMin + t * (p.nodeTextHeightMax - p.nodeTextHeightMin);
      if (n.kind === "hyperedge") height *= p.hyperedgeTextScale;
      sprite.textHeight = height;
      sprite.fontFace = p.fontFace;
      sprite.fontWeight = p.fontWeight;
      sprite.fontSize = p.fontResolution;
      sprite.strokeWidth = p.strokeWidth;
      sprite.strokeColor = p.strokeColor;
      sprite.color = n.id === selectedNodeId ? p.selectedColor : n.color;
      spritesRef.current.set(n.id, sprite);
      return sprite as unknown as THREE.Object3D;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [styleKey],
  );

  // Selection: recolor in place.
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const p = paramsRef.current;
    const prev = prevSelectedRef.current;
    if (prev && prev !== selectedNodeId) {
      const s = spritesRef.current.get(prev);
      const n = nodesById.get(prev);
      if (s && n) s.color = n.color;
    }
    if (selectedNodeId) {
      const s = spritesRef.current.get(selectedNodeId);
      if (s) s.color = p.selectedColor;
    }
    prevSelectedRef.current = selectedNodeId;
  }, [selectedNodeId, nodesById]);

  // --- Edge label sprites -------------------------------------------------
  const showEdgeLabels = params.edgeLabels === "always";
  const tooltipsEnabled = params.edgeLabels !== "never";
  const edgeStyleKey = `${params.edgeLabelTextHeight}|${params.fontFace}|${params.strokeWidth}|${params.strokeColor}`;
  const linkThreeObject = useCallback(
    (l: FGLink) => {
      const p = paramsRef.current;
      const sprite = new SpriteText(l.text);
      sprite.color = l.color;
      sprite.textHeight = p.edgeLabelTextHeight;
      sprite.fontFace = p.fontFace;
      sprite.fontWeight = "600";
      sprite.fontSize = p.fontResolution;
      sprite.strokeWidth = p.strokeWidth;
      sprite.strokeColor = p.strokeColor;
      sprite.backgroundColor = "rgba(10, 14, 38, 0.55)";
      sprite.padding = 1;
      sprite.borderRadius = 1.5;
      return sprite as unknown as THREE.Object3D;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edgeStyleKey],
  );

  // --- Containment hulls --------------------------------------------------
  const hullsRef = useRef<HullHandle[]>([]);
  const tickRef = useRef(0);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || perfBlocked) return;
    const scene = fg.scene();
    const handles: HullHandle[] = [];
    if (params.hulls) {
      for (const group of groups) {
        const container = group.containerId ? nodesById.get(group.containerId) : undefined;
        const color = new THREE.Color(container?.color ?? CATEGORY_TOKENS.containment.color);
        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: params.hullOpacity,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), material);
        mesh.visible = false;
        mesh.renderOrder = -1;
        scene.add(mesh);
        handles.push({ group, mesh, material });
      }
    }
    hullsRef.current = handles;
    return () => {
      for (const h of handles) {
        scene.remove(h.mesh);
        h.mesh.geometry.dispose();
        h.material.dispose();
      }
      hullsRef.current = [];
    };
  }, [groups, nodesById, params.hulls, params.hullOpacity, params.hullMode, perfBlocked, isGraph, size.width, size.height]);

  const updateHulls = useCallback(() => {
    const p = paramsRef.current;
    const handles = hullsRef.current;
    if (handles.length === 0) return;
    tickRef.current += 1;
    if (tickRef.current % Math.max(1, p.hullRebuildEveryTicks) !== 0) return;
    const pad = p.hullPadding;
    for (const h of handles) {
      const pts: THREE.Vector3[] = [];
      for (const id of h.group.participantIds) {
        const n = nodesById.get(id);
        if (n && n.x !== undefined && n.y !== undefined) {
          pts.push(new THREE.Vector3(n.x, n.y, n.z ?? 0));
        }
      }
      if (pts.length === 0) {
        h.mesh.visible = false;
        continue;
      }
      h.mesh.visible = true;
      const convexOk = p.hullMode === "convex" && pts.length >= 4 && p.dimensions === 3;
      if (convexOk) {
        // Pad each point outward from the centroid so the hull clears the
        // labels, then let ConvexGeometry do the wrapping.
        const c = pts.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / pts.length);
        const padded: THREE.Vector3[] = [];
        for (const v of pts) {
          const dir = v.clone().sub(c);
          if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
          dir.normalize();
          // Six jittered copies per point give the hull some roundness
          // instead of a hard polytope through label centers.
          for (const o of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            padded.push(v.clone().add(new THREE.Vector3(o[0], o[1], o[2]).multiplyScalar(pad)));
          }
          padded.push(v.clone().add(dir.multiplyScalar(pad * 1.4)));
        }
        try {
          const geom = new ConvexGeometry(padded);
          h.mesh.geometry.dispose();
          h.mesh.geometry = geom;
          h.mesh.position.set(0, 0, 0);
          h.mesh.scale.set(1, 1, 1);
          continue;
        } catch {
          // Degenerate (coplanar) input — fall through to the ellipsoid.
        }
      }
      if (!(h.mesh.geometry instanceof THREE.SphereGeometry)) {
        h.mesh.geometry.dispose();
        h.mesh.geometry = new THREE.SphereGeometry(1, 28, 18);
      }
      const min = new THREE.Vector3(Infinity, Infinity, Infinity);
      const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const v of pts) {
        min.min(v);
        max.max(v);
      }
      const center = min.clone().add(max).multiplyScalar(0.5);
      const radii = max.clone().sub(min).multiplyScalar(0.5).addScalar(pad);
      if (p.dimensions === 2) radii.z = pad * 0.25;
      h.mesh.position.copy(center);
      h.mesh.scale.copy(radii);
    }
  }, [nodesById]);

  // --- Camera / freeze / sync ---------------------------------------------
  useEffect(() => {
    if (!fgRef.current || perfBlocked) return;
    const t = setTimeout(
      () => fgRef.current?.zoomToFit(params.fitDuration, params.fitPadding),
      params.fitDelayMs,
    );
    return () => clearTimeout(t);
  }, [data, perfBlocked, params.fitDuration, params.fitPadding, params.fitDelayMs]);

  useEffect(() => {
    if (perfBlocked) return;
    if (params.freezeLayout) {
      for (const n of data.nodes) {
        n.fx = n.x;
        n.fy = n.y;
        n.fz = n.z;
      }
    } else {
      for (const n of data.nodes) {
        n.fx = undefined;
        n.fy = undefined;
        n.fz = undefined;
      }
      fgRef.current?.d3ReheatSimulation();
    }
  }, [params.freezeLayout, data, perfBlocked]);

  useEffect(() => {
    const unsubSelection = onNodeSelectionBroadcast((event) => {
      if (!areGraphsConnected() || event.sourcePanelId === props.api.id || event.documentId !== activeDocId) return;
      setSelectedNodeId(event.nodeId);
    });
    const unsubFocus = onNodeFocusBroadcast((event) => {
      if (!areGraphsConnected() || event.sourcePanelId === props.api.id || event.documentId !== activeDocId) return;
      const target = nodesById.get(event.nodeId);
      if (target && target.x !== undefined && target.y !== undefined && fgRef.current) {
        const { x, y } = target;
        const z = target.z ?? 0;
        const distRatio = 1 + 80 / Math.max(1e-6, Math.hypot(x, y, z));
        fgRef.current.cameraPosition(
          { x: x * distRatio, y: y * distRatio, z: z * distRatio },
          { x, y, z },
          1000,
        );
      }
    });
    return () => {
      unsubSelection();
      unsubFocus();
    };
  }, [activeDocId, nodesById, props.api.id]);

  const resetView = () => fgRef.current?.zoomToFit(params.fitDuration, params.fitPadding);

  const linkVisible = (l: FGLink) => {
    if (l.layer && params.layerVisibility[l.layer] === false) return false;
    if (l.category === "containment" && !params.showContainmentLinks) return false;
    return true;
  };

  return (
    <>
      <div className="panel-header json-graph3d-inspect-header">
        <span>3D-Inspect</span>
        <div className="json-graph3d-inspect-controls">
          <select
            value={params.dimensions}
            onChange={(e) => updateParam("dimensions", Number(e.target.value) as 2 | 3)}
            title="2D or 3D layout"
          >
            <option value={2}>2D</option>
            <option value={3}>3D</option>
          </select>
          <select
            value={params.edgeLabels}
            onChange={(e) => updateParam("edgeLabels", e.target.value as InspectLabelMode)}
            title="Edge label visibility"
          >
            <option value="always">edges: always</option>
            <option value="hover">edges: hover</option>
            <option value="never">edges: never</option>
          </select>
          <select
            value={params.nodeSizeBy}
            onChange={(e) => updateParam("nodeSizeBy", e.target.value as NodeSizeBy)}
            title="What drives node text size"
          >
            <option value="degree">size: degree</option>
            <option value="uniform">size: uniform</option>
          </select>
          <select
            value={params.edgeColorBy}
            onChange={(e) => updateParam("edgeColorBy", e.target.value as EdgeColorBy)}
            title="What drives edge color"
          >
            <option value="category">color: category</option>
            <option value="layer">color: layer</option>
            <option value="predicate">color: predicate</option>
          </select>
          <label title="Draw transparent hulls around containment groups">
            <input
              type="checkbox"
              checked={params.hulls}
              onChange={(e) => updateParam("hulls", e.target.checked)}
            />
            hulls
          </label>
          <select
            value={params.hullMode}
            onChange={(e) => updateParam("hullMode", e.target.value as HullMode)}
            title="Hull shape"
            disabled={!params.hulls}
          >
            <option value="ellipsoid">blob</option>
            <option value="convex">convex</option>
          </select>
          <label title="Also draw containment spoke lines (the whitepaper says hull only)">
            <input
              type="checkbox"
              checked={params.showContainmentLinks}
              onChange={(e) => updateParam("showContainmentLinks", e.target.checked)}
            />
            contain-lines
          </label>
          <label title="Freeze the physics simulation">
            <input
              type="checkbox"
              checked={params.freezeLayout}
              onChange={(e) => updateParam("freezeLayout", e.target.checked)}
            />
            freeze
          </label>
          <button onClick={resetView} title="Fit graph to view" className="json-graph3d-inspect-reset-btn">
            ⤢
          </button>
        </div>
      </div>
      <div className="panel-body json-graph3d-inspect-body" ref={containerRef}>
        {!isGraph && (
          <div className="json-graph3d-inspect-empty">
            {doc === undefined ? "Waiting for JSON…" : "No graph structure detected in this JSON."}
          </div>
        )}
        {isGraph && perfBlocked && (
          <div className="json-graph3d-inspect-perf-warning">
            <p>
              <strong>{nodeCount.toLocaleString()}</strong> nodes detected (threshold{" "}
              {params.nodeThreshold.toLocaleString()}). Text sprites per node are heavy.
            </p>
            <button onClick={() => setBypassPerf(true)}>Render anyway</button>
          </div>
        )}
        {isGraph && !perfBlocked && params.showLegend && (
          <div className="json-graph3d-inspect-legend">
            {CATEGORY_ORDER.map((c) => (
              <span key={c} style={{ color: params.colorOverrides[`category:${c}`] ?? CATEGORY_TOKENS[c].color }}>
                {c === "containment" ? "◌" : "—"} {CATEGORY_TOKENS[c].label}
              </span>
            ))}
          </div>
        )}
        {isGraph && !perfBlocked && size.width > 0 && size.height > 0 && (
          <ForceGraph3D<FGNode, FGLink>
            ref={fgRef}
            graphData={data}
            width={size.width}
            height={size.height}
            numDimensions={params.dimensions}
            backgroundColor={params.backgroundColor}
            showNavInfo={false}
            nodeThreeObject={nodeThreeObject}
            nodeThreeObjectExtend={false}
            nodeVal={(n) => 1 + (params.nodeSizeBy === "degree" ? n.degree : 0)}
            onNodeHover={(node) => {
              if (areGraphsConnected()) {
                broadcastNodeSelection(activeDocId, node ? node.id : null, props.api.id, node ? node.name : undefined);
              }
              setSelectedNodeId(node ? node.id : null);
            }}
            onNodeClick={(node) => {
              if (node && areGraphsConnected()) broadcastNodeFocus(activeDocId, node.id, props.api.id);
            }}
            nodeLabel={(n) =>
              attrsToHtml(n.attrs, n.name, params.tooltipMaxAttrs, params.tooltipValueMaxLen)
            }
            linkColor={(l) => l.color}
            linkOpacity={params.linkOpacity}
            linkWidth={(l) => l.width}
            linkVisibility={linkVisible}
            linkCurvature={(l) => l.curvature}
            linkCurveRotation={(l) => l.rotation}
            linkDirectionalArrowLength={(l) =>
              l.directed && l.category !== "containment" ? params.arrowLength : 0
            }
            linkDirectionalArrowRelPos={1}
            linkDirectionalArrowColor={(l) => l.color}
            linkDirectionalParticles={(l) =>
              params.particles && !params.freezeLayout && linkVisible(l) && l.category === "state_change"
                ? params.particleCount
                : 0
            }
            linkDirectionalParticleSpeed={params.particleSpeed}
            linkDirectionalParticleColor={(l) => l.color}
            linkLabel={
              tooltipsEnabled
                ? (l) =>
                    attrsToHtml(
                      l.attrs,
                      [l.label, l.role ? `(${l.role})` : ""].filter(Boolean).join(" ") || l.text,
                      params.tooltipMaxAttrs,
                      params.tooltipValueMaxLen,
                    )
                : () => ""
            }
            linkThreeObjectExtend={showEdgeLabels}
            linkThreeObject={showEdgeLabels ? linkThreeObject : undefined}
            linkPositionUpdate={
              showEdgeLabels
                ? (sprite, { start, end }, link) => {
                    const l = link as unknown as FGLink;
                    if (!linkVisible(l)) {
                      (sprite as unknown as THREE.Object3D).visible = false;
                      return;
                    }
                    (sprite as unknown as THREE.Object3D).visible = l.text.length > 0;
                    Object.assign((sprite as unknown as { position: { x: number; y: number; z: number } }).position, {
                      x: start.x + (end.x - start.x) / 2,
                      y: start.y + (end.y - start.y) / 2,
                      z: start.z + (end.z - start.z) / 2,
                    });
                  }
                : undefined
            }
            onEngineTick={updateHulls}
            cooldownTicks={params.cooldownTicks}
            warmupTicks={0}
          />
        )}
      </div>
    </>
  );
}
