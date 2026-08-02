import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import * as d3 from "d3";
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
import {
  type DetectedGraph,
  type GraphNode,
} from "../../data/json-utils/graphDetect";
import { useJsonDoc } from "../../data/useJsonDoc";
import { getDocStats, getDetectedGraph } from "../../data/json-utils/docStats";
import { useElementSize } from "../../useElementSize";
import {
  buildLayerVisibility,
  colorForLayer,
} from "../../data/json-utils/layers";
import "./JsonGraphPanel.css";

interface SimNode extends GraphNode, d3.SimulationNodeDatum {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  label?: string;
  directed?: boolean;
  layer?: string;
}

export interface JsonGraphParams {
  documentId: string;
  freezeLayout: boolean;
  layerVisibility: Record<string, boolean>;
  // Force simulation
  linkDistance: number;
  chargeStrength: number;
  collideRadius: number;
  collideStrength: number;
  velocityDecay: number;
  alphaDecay: number;
  alphaMin: number;
  // Sizing
  nodeRadius: number;
  // Camera
  fitOnLoad: boolean;
  fitPadding: number;
  fitMaxScale: number;
  fitDelayMs: number;
  zoomMin: number;
  zoomMax: number;
  // Labels
  nodeLabelMaxLength: number;
  nodeLabelOffset: number;
  // Perf
  nodeThreshold: number;
}

export const jsonGraphDefaults: JsonGraphParams = {
  documentId: "default",
  freezeLayout: false,
  layerVisibility: {},
  linkDistance: 120,
  chargeStrength: -300,
  collideRadius: 30,
  collideStrength: 0.9,
  velocityDecay: 0.85,
  alphaDecay: 0.05,
  alphaMin: 0.01,
  nodeRadius: 14,
  fitOnLoad: true,
  fitPadding: 100,
  fitMaxScale: 1.5,
  fitDelayMs: 1500,
  zoomMin: 0.1,
  zoomMax: 8,
  nodeLabelMaxLength: 20,
  nodeLabelOffset: 28,
  nodeThreshold: 500,
};

export default function JsonGraphPanel(
  props: IDockviewPanelProps<JsonGraphParams>,
) {
  const params: JsonGraphParams = {
    ...jsonGraphDefaults,
    ...(props.params ?? {}),
  };

  const updateParam = <K extends keyof JsonGraphParams>(
    key: K,
    value: JsonGraphParams[K],
  ) => {
    props.api.updateParameters({ ...params, [key]: value });
  };

  const [activeDocId, setActiveDocId] = useState(params.documentId);
  const [connected, setConnected] = useState(areGraphsConnected());

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

  // Perf gate BEFORE the transform: counts come from the shared cached
  // stats, so a blocked viewer never builds the graph arrays. bypassPerf
  // is session-only — persisted, it baked huge renders into every launch.
  const [bypassPerf, setBypassPerf] = useState(false);
  const stats = doc === undefined ? null : getDocStats(doc);
  const isGraph = stats?.isGraph ?? false;
  const nodeCount = stats?.graphNodeCount ?? 0;
  const perfBlocked = nodeCount > params.nodeThreshold && !bypassPerf;

  const graph = useMemo<DetectedGraph | null>(() => {
    if (doc === undefined || perfBlocked) return null;
    // Cached per document version — shared with the other graph viewers.
    return getDetectedGraph(doc);
  }, [doc, perfBlocked]);

  // Keep layerVisibility synced with detected layers.
  useEffect(() => {
    const next = buildLayerVisibility(graph, params.layerVisibility);
    if (JSON.stringify(next) !== JSON.stringify(params.layerVisibility)) {
      updateParam("layerVisibility", next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(containerRef);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const linkSelectionRef = useRef<d3.Selection<
    SVGLineElement,
    SimLink,
    SVGGElement,
    unknown
  > | null>(null);
  const linkLabelSelectionRef = useRef<d3.Selection<
    SVGTextElement,
    SimLink,
    SVGGElement,
    unknown
  > | null>(null);
  const resetRef = useRef<() => void>(() => {});

  const destroyGraph = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
    if (svgRef.current) {
      svgRef.current.remove();
      svgRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !graph) return;
    if (size.width === 0 || size.height === 0) return;
    if (perfBlocked) return;

    destroyGraph();

    const container = containerRef.current;
    const { width, height } = size;

    const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = graph.links.map((l) => ({ ...l }));
    simNodesRef.current = nodes;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height);
    svgRef.current = svg.node();

    const g = svg.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([params.zoomMin, params.zoomMax])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    const fitToBounds = () => {
      const bounds = g.node()?.getBBox();
      if (!bounds || !svgRef.current) return;
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const scale = Math.min(
        width / (bounds.width + params.fitPadding),
        height / (bounds.height + params.fitPadding),
        params.fitMaxScale,
      );
      svg
        .transition()
        .duration(500)
        .call(
          zoom.transform as never,
          d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-cx, -cy),
        );
    };
    resetRef.current = fitToBounds;

    svg
      .append("defs")
      .append("marker")
      .attr("id", "json-graph-arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "rgba(0, 229, 255, 0.4)");

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(params.linkDistance),
      )
      .force("charge", d3.forceManyBody().strength(params.chargeStrength))
      .force(
        "collide",
        d3
          .forceCollide<SimNode>()
          .radius(params.collideRadius)
          .strength(params.collideStrength)
          .iterations(1),
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .velocityDecay(params.velocityDecay)
      .alphaDecay(params.alphaDecay)
      .alphaMin(params.alphaMin);

    simulationRef.current = simulation;

    const link = g
      .selectAll<SVGLineElement, SimLink>(".json-graph-link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", "json-graph-link")
      .attr("marker-end", (d) =>
        (d as SimLink & { directed?: boolean }).directed === false
          ? null
          : "url(#json-graph-arrowhead)",
      )
      .attr("stroke", (d) => (d.layer ? colorForLayer(d.layer) : ""))
      .style("display", (d) =>
        d.layer && params.layerVisibility[d.layer] === false ? "none" : null,
      );
    linkSelectionRef.current = link;

    const linkLabel = g
      .selectAll<SVGTextElement, SimLink>(".json-graph-link-label")
      .data(links.filter((l) => l.label))
      .enter()
      .append("text")
      .attr("class", "json-graph-link-label")
      .text((d) => d.label || "")
      .style("display", (d) =>
        d.layer && params.layerVisibility[d.layer] === false ? "none" : null,
      );
    linkLabelSelectionRef.current = linkLabel;

    const node = g
      .selectAll<SVGGElement, SimNode>(".json-graph-node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "json-graph-node")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on("mouseover", (_event, d) => {
        if (areGraphsConnected()) {
          broadcastNodeSelection(activeDocId, d.id, props.api.id, d.label || d.id);
        }
      })
      .on("mouseout", () => {
        if (areGraphsConnected()) {
          broadcastNodeSelection(activeDocId, null, props.api.id);
        }
      })
      .on("click", (_event, d) => {
        if (areGraphsConnected()) {
          broadcastNodeFocus(activeDocId, d.id, props.api.id);
        }
      });

    node
      .append("circle")
      .attr("r", params.nodeRadius)
      .attr("class", "json-graph-node-circle");

    node
      .append("text")
      .attr("class", "json-graph-node-label")
      .attr("dy", params.nodeLabelOffset)
      .attr("text-anchor", "middle")
      .text((d) => {
        const label = d.label || d.id;
        return label.length > params.nodeLabelMaxLength
          ? label.slice(0, params.nodeLabelMaxLength - 2) + "..."
          : label;
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);

      linkLabel
        .attr(
          "x",
          (d) =>
            ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2,
        )
        .attr(
          "y",
          (d) =>
            ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2,
        );

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    if (params.fitOnLoad) {
      setTimeout(fitToBounds, params.fitDelayMs);
    }

    if (params.freezeLayout) {
      simulation.stop();
      for (const n of nodes) {
        n.fx = n.x ?? null;
        n.fy = n.y ?? null;
      }
    }

    const unsubSelection = onNodeSelectionBroadcast((event) => {
      if (!areGraphsConnected() || event.sourcePanelId === props.api.id || event.documentId !== activeDocId) {
        return;
      }
      node.classed("selected", (d) => d.id === event.nodeId);
    });

    const unsubFocus = onNodeFocusBroadcast((event) => {
      if (!areGraphsConnected() || event.sourcePanelId === props.api.id || event.documentId !== activeDocId) {
        return;
      }
      const target = nodes.find((n) => n.id === event.nodeId);
      if (target && target.x !== undefined && target.y !== undefined) {
        svg
          .transition()
          .duration(500)
          .call(
            zoom.transform,
            d3.zoomIdentity
              .translate(width / 2, height / 2)
              .scale(1.2)
              .translate(-target.x, -target.y)
          );
      }
    });

    return () => {
      unsubSelection();
      unsubFocus();
      destroyGraph();
    };
    // freezeLayout intentionally omitted — separate effect toggles without rebuild
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, destroyGraph, size, perfBlocked]);

  // Toggle freeze without rebuilding.
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    if (params.freezeLayout) {
      sim.stop();
      for (const n of simNodesRef.current) {
        n.fx = n.x ?? null;
        n.fy = n.y ?? null;
      }
    } else {
      for (const n of simNodesRef.current) {
        n.fx = null;
        n.fy = null;
      }
      sim.alpha(0.3).restart();
    }
  }, [params.freezeLayout]);

  // Apply layer visibility without rebuilding.
  useEffect(() => {
    const link = linkSelectionRef.current;
    const label = linkLabelSelectionRef.current;
    const visible = (l: SimLink) =>
      !l.layer || params.layerVisibility[l.layer] !== false;
    if (link) link.style("display", (d) => (visible(d) ? null : "none"));
    if (label) label.style("display", (d) => (visible(d) ? null : "none"));
  }, [params.layerVisibility]);

  return (
    <>
      <div className="panel-header json-graph-header">
        <span>json-graph</span>
        <div className="json-graph-controls">
          <label title="Freeze the physics simulation">
            <input
              type="checkbox"
              checked={params.freezeLayout}
              onChange={(e) => updateParam("freezeLayout", e.target.checked)}
            />
            freeze
          </label>
          <button
            onClick={() => resetRef.current()}
            title="Fit graph to view"
            className="json-graph-reset-btn"
          >
            ⤢
          </button>
        </div>
      </div>
      <div className="panel-body json-graph-body">
        {!isGraph && (
          <div className="json-graph-empty">
            {doc === undefined
              ? "Waiting for JSON…"
              : "No graph structure detected in this JSON."}
          </div>
        )}
        {isGraph && perfBlocked && (
          <div className="json-graph-perf-warning">
            <p>
              <strong>{nodeCount.toLocaleString()}</strong> nodes detected
              (threshold {params.nodeThreshold.toLocaleString()}).
            </p>
            <button onClick={() => setBypassPerf(true)}>
              Render anyway
            </button>
          </div>
        )}
        {isGraph && !perfBlocked && (
          <div className="json-graph-canvas" ref={containerRef} />
        )}
      </div>
    </>
  );
}
