import { useEffect, useMemo, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import ForceGraph3D from "react-force-graph-3d";
import type { ForceGraphMethods } from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import type { Object3D } from "three";
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
import { type DetectedGraph } from "../../data/json-utils/graphDetect";
import { useJsonDoc } from "../../data/useJsonDoc";
import { getDocStats, getDetectedGraph } from "../../data/json-utils/docStats";
import { useElementSize } from "../../useElementSize";
import {
  buildLayerVisibility,
  colorForLayer,
} from "../../data/json-utils/layers";
import "./JsonGraph3DPanel.css";

export type Graph3DLabelMode = "always" | "hover" | "never";

export interface JsonGraph3DParams {
  documentId: string;
  dimensions: 2 | 3;
  particles: boolean;
  labelMode: Graph3DLabelMode;
  curvature: number;
  freezeLayout: boolean;
  layerVisibility: Record<string, boolean>;
  nodeRelSize: number;
  nodeOpacity: number;
  linkOpacity: number;
  linkWidth: number;
  arrowLength: number;
  arrowRelPos: number;
  particleCount: number;
  particleWidth: number;
  particleSpeed: number;
  backgroundColor: string;
  nodeKindColors: { node: string; hyperedge: string; "edge-as-node": string };
  inlineLabelTextHeight: number;
  inlineLabelBg: string;
  inlineLabelPadding: number;
  tooltipMaxAttrs: number;
  tooltipValueMaxLen: number;
  fitDuration: number;
  fitPadding: number;
  fitDelayMs: number;
  cooldownTicks: number;
  showNavInfo: boolean;
  nodeThreshold: number;
}

export const jsonGraph3DDefaults: JsonGraph3DParams = {
  documentId: "default",
  dimensions: 3,
  particles: true,
  labelMode: "hover",
  curvature: 0.3,
  freezeLayout: false,
  layerVisibility: {},
  nodeRelSize: 4,
  nodeOpacity: 0.9,
  linkOpacity: 0.6,
  linkWidth: 0.6,
  arrowLength: 3,
  arrowRelPos: 1,
  particleCount: 2,
  particleWidth: 1.5,
  particleSpeed: 0.006,
  backgroundColor: "#0a0e26",
  nodeKindColors: {
    node: "#00e5ff",
    hyperedge: "#7a7f99",
    "edge-as-node": "#b388ff",
  },
  inlineLabelTextHeight: 2,
  inlineLabelBg: "rgba(10, 14, 38, 0.7)",
  inlineLabelPadding: 2,
  tooltipMaxAttrs: 12,
  tooltipValueMaxLen: 80,
  fitDuration: 600,
  fitPadding: 60,
  fitDelayMs: 800,
  cooldownTicks: 150,
  showNavInfo: false,
  // WebGL is the one renderer here built for big graphs; the gate is the
  // fallback (malformed/absurd inputs), not the norm. Above BIG_GRAPH
  // nodes the panel auto-degrades detail instead of blocking.
  nodeThreshold: 50000,
};

/** Node count above which scale-aware settings kick in: shorter cooldown,
 *  1px GL lines instead of cylinder links, no curvature/arrows/particles,
 *  lower sphere resolution. Cosmetic detail traded for interactivity. */
const BIG_GRAPH = 5000;

interface FGLink {
  source: string;
  target: string;
  label: string;
  curvature: number;
  rotation: number;
  directed: boolean;
  attrs?: Record<string, unknown>;
  role?: string;
  layer?: string;
}

interface FGNode {
  id: string;
  name: string;
  kind?: "node" | "hyperedge" | "edge-as-node";
  attrs?: Record<string, unknown>;
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

function annotateLinks(
  links: {
    source: string;
    target: string;
    label?: string;
    directed?: boolean;
    role?: string;
    layer?: string;
    attrs?: Record<string, unknown>;
  }[],
  baseCurvature: number,
): FGLink[] {
  const groups = new Map<string, number[]>();
  links.forEach((_, i) => {
    const a = links[i].source;
    const b = links[i].target;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const arr = groups.get(key) ?? [];
    arr.push(i);
    groups.set(key, arr);
  });

  const out = new Array<FGLink>(links.length);
  for (const indices of groups.values()) {
    const n = indices.length;
    indices.forEach((idx, i) => {
      const link = links[idx];
      out[idx] = {
        source: link.source,
        target: link.target,
        label: link.label ?? "",
        curvature: n === 1 ? 0 : baseCurvature,
        rotation: n === 1 ? 0 : (i / n) * Math.PI * 2,
        directed: link.directed !== false,
        role: link.role,
        layer: link.layer,
        attrs: link.attrs,
      };
    });
  }
  return out;
}

export default function JsonGraph3DPanel(
  props: IDockviewPanelProps<JsonGraph3DParams>,
) {
  const params: JsonGraph3DParams = {
    ...jsonGraph3DDefaults,
    ...(props.params ?? {}),
  };

  const updateParam = <K extends keyof JsonGraph3DParams>(
    key: K,
    value: JsonGraph3DParams[K],
  ) => {
    props.api.updateParameters({ ...params, [key]: value });
  };

  const [activeDocId, setActiveDocId] = useState(params.documentId);
  const [connected, setConnected] = useState(areGraphsConnected());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    return onGraphsConnectionChange(setConnected);
  }, []);

  useEffect(() => {
    if (!connected) {
      setActiveDocId(params.documentId);
      return;
    }
    setActiveDocId(getActiveDocumentId());
    return onActiveDocumentIdChange((id) => {
      setActiveDocId(id);
    });
  }, [connected, params.documentId]);

  // Visibility-aware doc subscription (hidden tabs buffer, not render).
  const doc = useJsonDoc(props.api, activeDocId);

  // Perf gate BEFORE the transform (cached stats read); bypass is
  // session-only so it never persists into the saved layout.
  const [bypassPerf, setBypassPerf] = useState(false);
  const stats = doc === undefined ? null : getDocStats(doc);
  const isGraph = stats?.isGraph ?? false;
  const nodeCount = stats?.graphNodeCount ?? 0;
  const perfBlocked = nodeCount > params.nodeThreshold && !bypassPerf;
  const bigGraph = nodeCount > BIG_GRAPH;

  // Scale-aware effective settings. User params win below BIG_GRAPH;
  // above it, the expensive cosmetics are clamped: linkWidth 0 renders
  // 1px GL lines instead of per-link cylinder geometry, curvature 0
  // avoids segmented curves, arrows/particles are per-link Objects that
  // don't survive 30k links, and a shorter cooldown stops the force sim
  // burning frames long after the shape has emerged.
  const fx = {
    cooldownTicks: bigGraph
      ? Math.min(params.cooldownTicks, 60)
      : params.cooldownTicks,
    curvature: bigGraph ? 0 : params.curvature,
    linkWidth: bigGraph ? 0 : params.linkWidth,
    linkOpacity: bigGraph
      ? Math.min(params.linkOpacity, 0.3)
      : params.linkOpacity,
    particles: bigGraph ? false : params.particles,
    arrowLength: bigGraph ? 0 : params.arrowLength,
    nodeResolution: bigGraph ? 4 : 8,
  };

  const graph = useMemo<DetectedGraph | null>(() => {
    if (doc === undefined || perfBlocked) return null;
    // Cached per document version — shared with the other graph viewers.
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

  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(
    undefined,
  );

  const data = useMemo(() => {
    if (!graph) return { nodes: [] as FGNode[], links: [] as FGLink[] };
    const nodes: FGNode[] = graph.nodes.map((n) => ({
      id: n.id,
      name: n.label || n.id,
      kind: n.kind,
      attrs: n.attrs,
    }));
    const links = annotateLinks(graph.links, fx.curvature);
    return { nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, fx.curvature]);

  useEffect(() => {
    if (!fgRef.current || perfBlocked) return;
    const t = setTimeout(
      () => fgRef.current?.zoomToFit(params.fitDuration, params.fitPadding),
      params.fitDelayMs,
    );
    return () => clearTimeout(t);
  }, [data, perfBlocked, params.fitDuration, params.fitPadding, params.fitDelayMs]);

  // Freeze: pin every node to its current position.
  useEffect(() => {
    if (perfBlocked) return;
    const nodes = data.nodes as Array<
      FGNode & {
        x?: number;
        y?: number;
        z?: number;
        fx?: number;
        fy?: number;
        fz?: number;
      }
    >;
    if (params.freezeLayout) {
      for (const n of nodes) {
        n.fx = n.x;
        n.fy = n.y;
        n.fz = n.z;
      }
    } else {
      for (const n of nodes) {
        n.fx = undefined;
        n.fy = undefined;
        n.fz = undefined;
      }
      fgRef.current?.d3ReheatSimulation();
    }
  }, [params.freezeLayout, data, perfBlocked]);

  const resetView = () => {
    fgRef.current?.zoomToFit(params.fitDuration, params.fitPadding);
  };

  // Listen for external Selection & Focus broadcasts
  useEffect(() => {
    const unsubSelection = onNodeSelectionBroadcast((event) => {
      if (!areGraphsConnected() || event.sourcePanelId === props.api.id || event.documentId !== activeDocId) {
        return;
      }
      setSelectedNodeId(event.nodeId);
    });

    const unsubFocus = onNodeFocusBroadcast((event) => {
      if (!areGraphsConnected() || event.sourcePanelId === props.api.id || event.documentId !== activeDocId) {
        return;
      }
      const target = data.nodes.find((n) => n.id === event.nodeId) as (FGNode & { x?: number; y?: number; z?: number }) | undefined;
      if (target && target.x !== undefined && target.y !== undefined && fgRef.current) {
        const x = target.x;
        const y = target.y;
        const z = target.z ?? 0;
        const distance = 80;
        const distRatio = 1 + distance / Math.hypot(x, y, z);
        fgRef.current.cameraPosition(
          { x: x * distRatio, y: y * distRatio, z: z * distRatio },
          target as { x: number; y: number; z: number },
          1000
        );
      }
    });

    return () => {
      unsubSelection();
      unsubFocus();
    };
  }, [activeDocId, data, props.api.id]);

  const showInlineLabels = params.labelMode === "always";
  const tooltipsEnabled = params.labelMode !== "never";

  return (
    <>
      <div className="panel-header json-graph3d-header">
        <span>json-graph3d</span>
        <div className="json-graph3d-controls">
          <select
            value={params.dimensions}
            onChange={(e) =>
              updateParam(
                "dimensions",
                Number(e.target.value) as 2 | 3,
              )
            }
            title="2D or 3D layout"
          >
            <option value={2}>2D</option>
            <option value={3}>3D</option>
          </select>
          <select
            value={params.labelMode}
            onChange={(e) =>
              updateParam("labelMode", e.target.value as Graph3DLabelMode)
            }
            title="Label visibility mode"
          >
            <option value="always">always</option>
            <option value="hover">hover</option>
            <option value="never">never</option>
          </select>
          <label title="Show traveling particles on directed edges">
            <input
              type="checkbox"
              checked={params.particles}
              onChange={(e) => updateParam("particles", e.target.checked)}
            />
            particles
          </label>
          <label title="Freeze the physics simulation">
            <input
              type="checkbox"
              checked={params.freezeLayout}
              onChange={(e) => updateParam("freezeLayout", e.target.checked)}
            />
            freeze
          </label>
          <button
            onClick={resetView}
            title="Fit graph to view"
            className="json-graph3d-reset-btn"
          >
            ⤢
          </button>
        </div>
      </div>
      <div className="panel-body json-graph3d-body" ref={containerRef}>
        {!isGraph && (
          <div className="json-graph3d-empty">
            {doc === undefined
              ? "Waiting for JSON…"
              : "No graph structure detected in this JSON."}
          </div>
        )}
        {isGraph && perfBlocked && (
          <div className="json-graph3d-perf-warning">
            <p>
              <strong>{nodeCount.toLocaleString()}</strong> nodes detected
              (threshold {params.nodeThreshold.toLocaleString()}).
            </p>
            <button onClick={() => setBypassPerf(true)}>
              Render anyway
            </button>
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
            showNavInfo={params.showNavInfo}
            nodeRelSize={params.nodeRelSize}
            nodeVal={(n) => (n.kind && n.kind !== "node" ? 0.5 : 1)}
            nodeColor={(n) =>
              n.id === selectedNodeId
                ? "#ff007f"
                : (params.nodeKindColors[n.kind ?? "node"] ?? "#00e5ff")
            }
            onNodeHover={(node) => {
              if (areGraphsConnected()) {
                broadcastNodeSelection(activeDocId, node ? node.id : null, props.api.id, node ? node.name : undefined);
              }
              setSelectedNodeId(node ? node.id : null);
            }}
            onNodeClick={(node) => {
              if (node && areGraphsConnected()) {
                broadcastNodeFocus(activeDocId, node.id, props.api.id);
              }
            }}
            nodeOpacity={params.nodeOpacity}
            nodeLabel={
              tooltipsEnabled
                ? (n) =>
                    attrsToHtml(
                      n.attrs,
                      n.name,
                      params.tooltipMaxAttrs,
                      params.tooltipValueMaxLen,
                    )
                : () => ""
            }
            linkColor={(l) =>
              l.layer ? colorForLayer(l.layer) : "rgba(0, 229, 255, 0.45)"
            }
            linkOpacity={fx.linkOpacity}
            linkWidth={fx.linkWidth}
            linkVisibility={(l) =>
              !l.layer || params.layerVisibility[l.layer] !== false
            }
            linkCurvature={(l) => l.curvature}
            linkCurveRotation={(l) => l.rotation}
            linkDirectionalArrowLength={(l) =>
              l.directed ? fx.arrowLength : 0
            }
            linkDirectionalArrowRelPos={params.arrowRelPos}
            linkDirectionalArrowColor={(l) =>
              l.layer ? colorForLayer(l.layer) : "rgba(0, 229, 255, 0.8)"
            }
            linkDirectionalParticles={(l) =>
              fx.particles &&
              !params.freezeLayout &&
              (!l.layer || params.layerVisibility[l.layer] !== false)
                ? params.particleCount
                : 0
            }
            linkDirectionalParticleWidth={params.particleWidth}
            linkDirectionalParticleSpeed={params.particleSpeed}
            linkDirectionalParticleColor={(l) =>
              l.layer ? colorForLayer(l.layer) : "#00e5ff"
            }
            linkLabel={
              tooltipsEnabled
                ? (l) =>
                    attrsToHtml(
                      l.attrs,
                      l.role ? `${l.label} (${l.role})` : l.label,
                      params.tooltipMaxAttrs,
                      params.tooltipValueMaxLen,
                    )
                : () => ""
            }
            linkThreeObjectExtend={showInlineLabels}
            linkThreeObject={
              showInlineLabels
                ? ((l: FGLink) => {
                    // Spokes of a reified relation carry a role, not a
                    // label; without this fallback "always" drew empty
                    // sprites on every TopoThink dyadic document.
                    const sprite = new SpriteText(l.label || l.role || "");
                    sprite.color = "#7ddff5";
                    sprite.textHeight = params.inlineLabelTextHeight;
                    sprite.backgroundColor = params.inlineLabelBg;
                    sprite.padding = params.inlineLabelPadding;
                    sprite.borderRadius = 2;
                    return sprite as unknown as Object3D;
                  })
                : undefined
            }
            linkPositionUpdate={
              showInlineLabels
                ? (sprite, { start, end }) => {
                    const mid = {
                      x: start.x + (end.x - start.x) / 2,
                      y: start.y + (end.y - start.y) / 2,
                      z: start.z + (end.z - start.z) / 2,
                    };
                    Object.assign(
                      (sprite as unknown as { position: typeof mid }).position,
                      mid,
                    );
                  }
                : undefined
            }
            cooldownTicks={fx.cooldownTicks}
            warmupTicks={0}
            nodeResolution={fx.nodeResolution}
          />
        )}
      </div>
    </>
  );
}
