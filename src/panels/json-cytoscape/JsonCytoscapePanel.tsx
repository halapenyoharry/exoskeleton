import { useEffect, useMemo, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import cytoscape from "cytoscape";
import type { Core, ElementDefinition, LayoutOptions } from "cytoscape";
import fcose from "cytoscape-fcose";
import { getJson, onJsonChange, type JsonValue } from "../../data/json-bus";
import {
  detectGraph,
  type DetectedGraph,
} from "../../data/json-utils/graphDetect";
import {
  buildLayerVisibility,
  colorForLayer,
} from "../../data/json-utils/layers";
import "./JsonCytoscapePanel.css";

cytoscape.use(fcose);

export type CytoscapeLayoutName =
  | "fcose"
  | "cose"
  | "breadthfirst"
  | "concentric"
  | "circle"
  | "grid"
  | "random";

export interface JsonCytoscapeParams {
  documentId: string;
  layout: CytoscapeLayoutName;
  curveEdges: boolean;
  layerVisibility: Record<string, boolean>;
  wheelSensitivity: number;
  minZoom: number;
  maxZoom: number;
  hideEdgesOnViewport: boolean;
  hideLabelsOnViewport: boolean;
  textureOnViewport: boolean;
  motionBlur: boolean;
  fitPadding: number;
  tooltipMaxAttrs: number;
  tooltipValueMaxLen: number;
  bypassPerf: boolean;
  nodeThreshold: number;
}

export const jsonCytoscapeDefaults: JsonCytoscapeParams = {
  documentId: "default",
  layout: "fcose",
  curveEdges: true,
  layerVisibility: {},
  wheelSensitivity: 0.2,
  minZoom: 0.1,
  maxZoom: 4,
  hideEdgesOnViewport: true,
  hideLabelsOnViewport: true,
  textureOnViewport: true,
  motionBlur: true,
  fitPadding: 40,
  tooltipMaxAttrs: 12,
  tooltipValueMaxLen: 80,
  bypassPerf: false,
  nodeThreshold: 1500,
};

interface TooltipState {
  x: number;
  y: number;
  header: string;
  attrs?: Record<string, unknown>;
}

function formatAttrs(
  attrs: Record<string, unknown> | undefined,
  maxAttrs: number,
  maxLen: number,
): [string, string][] {
  if (!attrs) return [];
  return Object.entries(attrs)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .slice(0, maxAttrs)
    .map(([k, v]) => {
      const val = typeof v === "object" ? JSON.stringify(v) : String(v);
      const truncated =
        val.length > maxLen ? val.slice(0, maxLen - 3) + "..." : val;
      return [k, truncated];
    });
}

function buildLayout(name: CytoscapeLayoutName): LayoutOptions {
  switch (name) {
    case "fcose":
      return {
        name: "fcose",
        animate: true,
        animationDuration: 600,
        randomize: true,
        nodeRepulsion: 4500,
        idealEdgeLength: 90,
        edgeElasticity: 0.45,
      } as LayoutOptions;
    case "cose":
      return {
        name: "cose",
        animate: true,
        idealEdgeLength: () => 90,
      } as LayoutOptions;
    case "breadthfirst":
      return {
        name: "breadthfirst",
        directed: true,
        padding: 30,
        spacingFactor: 1.2,
      } as LayoutOptions;
    case "concentric":
      return {
        name: "concentric",
        padding: 30,
        minNodeSpacing: 20,
      } as LayoutOptions;
    case "circle":
      return { name: "circle", padding: 30 } as LayoutOptions;
    case "grid":
      return { name: "grid", padding: 30 } as LayoutOptions;
    case "random":
      return { name: "random", padding: 30 } as LayoutOptions;
  }
}

export default function JsonCytoscapePanel(
  props: IDockviewPanelProps<JsonCytoscapeParams>,
) {
  const params: JsonCytoscapeParams = {
    ...jsonCytoscapeDefaults,
    ...(props.params ?? {}),
  };

  const updateParam = <K extends keyof JsonCytoscapeParams>(
    key: K,
    value: JsonCytoscapeParams[K],
  ) => {
    props.api.updateParameters({ ...params, [key]: value });
  };

  const [doc, setDoc] = useState<JsonValue | undefined>(() =>
    getJson(params.documentId),
  );
  useEffect(
    () => onJsonChange(params.documentId, setDoc),
    [params.documentId],
  );

  const graph = useMemo<DetectedGraph | null>(() => {
    if (doc === undefined) return null;
    return detectGraph(doc);
  }, [doc]);

  // Keep params.layerVisibility in sync with the detected graph's layers.
  useEffect(() => {
    const next = buildLayerVisibility(graph, params.layerVisibility);
    if (JSON.stringify(next) !== JSON.stringify(params.layerVisibility)) {
      updateParam("layerVisibility", next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodeCount = graph?.nodes.length ?? 0;
  const perfBlocked = nodeCount > params.nodeThreshold && !params.bypassPerf;

  const cyRef = useRef<Core | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;
    if (size.width === 0 || size.height === 0) return;
    if (perfBlocked) return;

    const elements: ElementDefinition[] = [
      ...graph.nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.label || n.id,
          kind: n.kind ?? "node",
          attrs: n.attrs,
        },
        classes:
          n.kind && n.kind !== "node" ? `kind-${n.kind}` : undefined,
      })),
      ...graph.links.map((l, i) => ({
        data: {
          id: `e${i}-${l.source}-${l.target}`,
          source: l.source,
          target: l.target,
          label: l.label || "",
          directed: l.directed !== false,
          role: l.role ?? "",
          layer: l.layer ?? "",
          layerColor: l.layer ? colorForLayer(l.layer) : "",
          attrs: l.attrs,
        },
        classes:
          [
            l.directed === false ? "undirected" : null,
            l.layer ? "has-layer" : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#0d1233",
            "border-color": "rgba(0, 229, 255, 0.5)",
            "border-width": 1.5,
            label: "data(label)",
            color: "#7ddff5",
            "font-size": 11,
            "text-valign": "bottom",
            "text-margin-y": 6,
            "text-outline-color": "#0a0e26",
            "text-outline-width": 2,
            width: 28,
            height: 28,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#00e5ff",
            "border-width": 2.5,
            "background-color": "#131940",
          },
        },
        {
          selector: "node.kind-hyperedge",
          style: {
            "background-color": "#1a1d33",
            "border-color": "rgba(122, 127, 153, 0.7)",
            "border-style": "dashed",
            shape: "diamond",
            width: 18,
            height: 18,
            color: "rgba(125, 223, 245, 0.6)",
          },
        },
        {
          selector: "node.kind-edge-as-node",
          style: {
            "background-color": "#1a1233",
            "border-color": "rgba(179, 136, 255, 0.7)",
            shape: "diamond",
            width: 22,
            height: 22,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "rgba(0, 229, 255, 0.25)",
            "target-arrow-color": "rgba(0, 229, 255, 0.4)",
            "target-arrow-shape": "triangle",
            "curve-style": params.curveEdges ? "bezier" : "straight",
            label: "data(label)",
            "font-size": 9,
            color: "rgba(0, 229, 255, 0.5)",
            "text-rotation": "autorotate" as unknown as undefined,
            "text-background-color": "#0a0e26",
            "text-background-opacity": 0.8,
            "text-background-padding": "2px",
          },
        },
        {
          selector: "edge.undirected",
          style: { "target-arrow-shape": "none" },
        },
        {
          selector: "edge.has-layer",
          style: {
            "line-color": "data(layerColor)",
            "target-arrow-color": "data(layerColor)",
            color: "data(layerColor)",
          },
        },
        {
          selector: "edge.layer-hidden",
          style: { display: "none" },
        },
        {
          selector: "edge:selected",
          style: {
            "line-color": "#00e5ff",
            "target-arrow-color": "#00e5ff",
            width: 2.5,
          },
        },
      ],
      layout: buildLayout(params.layout),
      wheelSensitivity: params.wheelSensitivity,
      minZoom: params.minZoom,
      maxZoom: params.maxZoom,
      hideEdgesOnViewport: params.hideEdgesOnViewport,
      hideLabelsOnViewport: params.hideLabelsOnViewport,
      textureOnViewport: params.textureOnViewport,
      motionBlur: params.motionBlur,
      motionBlurOpacity: 0.2,
      pixelRatio: 1,
    });

    cyRef.current = cy;

    cy.on("mouseover", "node, edge", (evt) => {
      const ele = evt.target;
      const attrs = ele.data("attrs") as Record<string, unknown> | undefined;
      const label = (ele.data("label") as string) || "";
      const role = (ele.data("role") as string) || "";
      const isEdge = ele.isEdge();
      const renderedPos = isEdge ? ele.midpoint() : ele.renderedPosition();
      const pan = cy.pan();
      const zoom = cy.zoom();
      const screenX = isEdge
        ? renderedPos.x * zoom + pan.x
        : renderedPos.x;
      const screenY = isEdge
        ? renderedPos.y * zoom + pan.y
        : renderedPos.y;
      setTooltip({
        x: screenX + 12,
        y: screenY + 12,
        header: role ? `${label} (${role})` : label,
        attrs,
      });
    });

    cy.on("mouseout", "node, edge", () => setTooltip(null));
    cy.on("pan zoom drag", () => setTooltip(null));

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [
    graph,
    size.width,
    size.height,
    params.layout,
    params.curveEdges,
    params.wheelSensitivity,
    params.minZoom,
    params.maxZoom,
    params.hideEdgesOnViewport,
    params.hideLabelsOnViewport,
    params.textureOnViewport,
    params.motionBlur,
    perfBlocked,
  ]);

  // Apply layer visibility without rebuilding the cytoscape instance.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.edges().forEach((edge) => {
        const layer = edge.data("layer") as string | undefined;
        if (!layer) return;
        const on = params.layerVisibility[layer] !== false;
        if (on) edge.removeClass("layer-hidden");
        else edge.addClass("layer-hidden");
      });
    });
  }, [params.layerVisibility]);

  const resetView = () => {
    cyRef.current?.fit(undefined, params.fitPadding);
  };

  return (
    <>
      <div className="panel-header json-cytoscape-header">
        <span>json-cytoscape</span>
        <div className="json-cytoscape-controls">
          <select
            value={params.layout}
            onChange={(e) =>
              updateParam("layout", e.target.value as CytoscapeLayoutName)
            }
            title="Layout algorithm"
          >
            <option value="fcose">fcose</option>
            <option value="cose">cose</option>
            <option value="breadthfirst">breadthfirst</option>
            <option value="concentric">concentric</option>
            <option value="circle">circle</option>
            <option value="grid">grid</option>
            <option value="random">random</option>
          </select>
          <label title="Curve multi-edges">
            <input
              type="checkbox"
              checked={params.curveEdges}
              onChange={(e) => updateParam("curveEdges", e.target.checked)}
            />
            curve
          </label>
          <button
            onClick={resetView}
            title="Fit graph to view"
            className="json-cytoscape-reset-btn"
          >
            ⤢
          </button>
        </div>
      </div>
      <div className="panel-body json-cytoscape-body">
        {!graph && (
          <div className="json-cytoscape-empty">
            {doc === undefined
              ? "Waiting for JSON…"
              : "No graph structure detected in this JSON."}
          </div>
        )}
        {graph && perfBlocked && (
          <div className="json-cytoscape-perf-warning">
            <p>
              <strong>{nodeCount.toLocaleString()}</strong> nodes detected
              (threshold {params.nodeThreshold.toLocaleString()}).
            </p>
            <button onClick={() => updateParam("bypassPerf", true)}>
              Render anyway
            </button>
          </div>
        )}
        {graph && !perfBlocked && (
          <div
            className="json-cytoscape-canvas"
            ref={containerRef}
          />
        )}
        {tooltip && !perfBlocked && (
          <div
            className="json-cytoscape-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <strong>{tooltip.header}</strong>
            {formatAttrs(
              tooltip.attrs,
              params.tooltipMaxAttrs,
              params.tooltipValueMaxLen,
            ).map(([k, v]) => (
              <div key={k} className="json-cytoscape-tooltip-row">
                <span className="json-cytoscape-tooltip-key">{k}</span>: {v}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
