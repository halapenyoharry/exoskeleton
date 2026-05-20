import { useEffect, useMemo, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import * as d3 from "d3";
import { getJson, onJsonChange, type JsonValue } from "../../data/json-bus";
import {
  jsonToHierarchy,
  countHierarchyNodes,
  type HierarchyNode,
} from "../../data/json-utils/jsonToHierarchy";
import "./JsonTreePanel.css";

export type JsonTreeLayout = "cluster" | "tidy";
export type JsonTreeDirection = "LR" | "RL" | "TB" | "BT";

export interface JsonTreeParams {
  /** json-bus channel to read from. */
  documentId: string;
  /** Tree layout algorithm. */
  layout: JsonTreeLayout;
  /** Reading direction. */
  direction: JsonTreeDirection;
  /** Density along the perpendicular axis (was `dx` in the original viewer). */
  spacingX: number;
  /** Spread between depth levels (was `dy`). */
  spacingY: number;
  /** Label font size in px. */
  fontSize: number;
  /** Color for leaf nodes. */
  nodeColor: string;
  /** Color for internal nodes and links. */
  linkColor: string;
  /** Show [N] prefix on array items. */
  showArrayIndices: boolean;
  /** Separate primitive values from their keys into child nodes. */
  explodePrimitives: boolean;
  /** Bypass the perf-warning gate. */
  bypassPerf: boolean;
  /** Node-count above which the perf warning fires. */
  nodeThreshold: number;
}

export const jsonTreeDefaults: JsonTreeParams = {
  documentId: "default",
  layout: "cluster",
  direction: "LR",
  spacingX: 14,
  spacingY: 200,
  fontSize: 11,
  nodeColor: "#00e5ff",
  linkColor: "#555555",
  showArrayIndices: true,
  explodePrimitives: false,
  bypassPerf: false,
  nodeThreshold: 10000,
};

const EMPTY_TREE: HierarchyNode = { name: "Waiting for JSON…" };

export default function JsonTreePanel(
  props: IDockviewPanelProps<JsonTreeParams>,
) {
  const params: JsonTreeParams = {
    ...jsonTreeDefaults,
    ...(props.params ?? {}),
  };

  const updateParam = <K extends keyof JsonTreeParams>(
    key: K,
    value: JsonTreeParams[K],
  ) => {
    props.api.updateParameters({ ...params, [key]: value });
  };

  // Subscribe to json-bus.
  const [doc, setDoc] = useState<JsonValue | undefined>(() =>
    getJson(params.documentId),
  );
  useEffect(
    () => onJsonChange(params.documentId, setDoc),
    [params.documentId],
  );

  // Container + resize observer.
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

  // Hierarchy derivation (cheap; recompute on every change).
  const rootData = useMemo<HierarchyNode>(() => {
    if (doc === undefined) return EMPTY_TREE;
    try {
      return jsonToHierarchy(
        doc,
        params.explodePrimitives,
        "root",
        params.showArrayIndices,
      );
    } catch {
      return { name: "Invalid JSON" };
    }
  }, [doc, params.explodePrimitives, params.showArrayIndices]);

  const nodeCount = useMemo(() => countHierarchyNodes(rootData), [rootData]);
  const perfBlocked =
    nodeCount > params.nodeThreshold && !params.bypassPerf;

  // D3 rendering.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!containerRef.current) return;
    if (size.width === 0 || size.height === 0) return;
    if (perfBlocked) return;

    if (svgRef.current) {
      svgRef.current.remove();
      svgRef.current = null;
    }

    const container = containerRef.current;
    const { width, height } = size;
    const {
      layout,
      direction,
      spacingX,
      spacingY,
      fontSize,
      nodeColor,
      linkColor,
    } = params;

    const root = d3.hierarchy<HierarchyNode>(rootData, (d) => d.children);
    const layoutEngine =
      layout === "cluster"
        ? d3.cluster<HierarchyNode>()
        : d3.tree<HierarchyNode>();
    layoutEngine.nodeSize([spacingX, spacingY])(root);

    let x0 = Infinity;
    let x1 = -x0;
    root.each((d) => {
      if ((d.x ?? 0) > x1) x1 = d.x ?? 0;
      if ((d.x ?? 0) < x0) x0 = d.x ?? 0;
    });

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("max-width", "100%")
      .style("height", "auto")
      .style("font-family", "sans-serif")
      .style("font-size", `${fontSize}px`);

    svgRef.current = svg.node();

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    const xMult = direction === "RL" ? -1 : 1;
    const yMult = direction === "BT" ? -1 : 1;
    const isVertical = direction === "TB" || direction === "BT";

    g.append("g")
      .attr("fill", "none")
      .attr("stroke", linkColor)
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links() as d3.HierarchyPointLink<HierarchyNode>[])
      .join("path")
      .attr(
        "d",
        isVertical
          ? d3
              .linkVertical<
                d3.HierarchyLink<HierarchyNode>,
                d3.HierarchyPointNode<HierarchyNode>
              >()
              .x((d) => (d.x ?? 0) * xMult)
              .y((d) => (d.y ?? 0) * yMult)
          : d3
              .linkHorizontal<
                d3.HierarchyLink<HierarchyNode>,
                d3.HierarchyPointNode<HierarchyNode>
              >()
              .x((d) => (d.y ?? 0) * xMult)
              .y((d) => (d.x ?? 0) * yMult),
      );

    const node = g
      .append("g")
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 3)
      .selectAll("g")
      .data(root.descendants() as d3.HierarchyPointNode<HierarchyNode>[])
      .join("g")
      .attr(
        "transform",
        (d) =>
          `translate(${
            isVertical ? (d.x ?? 0) * xMult : (d.y ?? 0) * xMult
          },${isVertical ? (d.y ?? 0) * yMult : (d.x ?? 0) * yMult})`,
      );

    const drag = d3
      .drag<SVGGElement, d3.HierarchyPointNode<HierarchyNode>>()
      .on("drag", function (event) {
        const selection = d3.select(this);
        const transform = selection.attr("transform");
        const match = /translate\(([^,]+),([^)]+)\)/.exec(transform);
        if (match) {
          const cx = parseFloat(match[1]) + event.dx;
          const cy = parseFloat(match[2]) + event.dy;
          selection.attr("transform", `translate(${cx},${cy})`);
        }
      });
    node.call(drag as unknown as Parameters<typeof node.call>[0]);

    node
      .append("circle")
      .attr("fill", (d) => (d.children ? linkColor : nodeColor))
      .attr("r", 3.5);

    node
      .append("text")
      .attr("dy", isVertical ? "1.25em" : "0.31em")
      .attr("x", (d) =>
        isVertical
          ? 0
          : d.children
            ? direction === "RL"
              ? 6
              : -6
            : direction === "RL"
              ? -6
              : 6,
      )
      .attr("text-anchor", (d) =>
        isVertical
          ? "middle"
          : d.children
            ? direction === "RL"
              ? "start"
              : "end"
            : direction === "RL"
              ? "end"
              : "start",
      )
      .text((d) => d.data.name)
      .style("font-size", `${fontSize}px`)
      .attr("fill", "#DCE5E7")
      .clone(true)
      .lower()
      .attr("stroke", "#080c22")
      .attr("stroke-width", 3);

    const defaultTransform = d3.zoomIdentity
      .translate(
        isVertical
          ? width / 2
          : direction === "RL"
            ? width - spacingY
            : spacingY,
        isVertical
          ? direction === "BT"
            ? height - spacingY
            : spacingY
          : height / 2 - (x0 + x1) / 2,
      )
      .scale(1);
    svg.call(zoom.transform as never, defaultTransform);

    resetRef.current = () => {
      svg
        .transition()
        .duration(500)
        .call(zoom.transform as never, defaultTransform);
    };

    return () => {
      if (svgRef.current) {
        svgRef.current.remove();
        svgRef.current = null;
      }
    };
  }, [rootData, params, size, perfBlocked]);

  return (
    <>
      <div className="panel-header json-tree-header">
        <span>json-tree</span>
        <div className="json-tree-controls">
          <select
            value={params.layout}
            onChange={(e) =>
              updateParam("layout", e.target.value as JsonTreeLayout)
            }
            title="Layout algorithm"
          >
            <option value="cluster">cluster</option>
            <option value="tidy">tidy</option>
          </select>
          <select
            value={params.direction}
            onChange={(e) =>
              updateParam("direction", e.target.value as JsonTreeDirection)
            }
            title="Orientation"
          >
            <option value="LR">L → R</option>
            <option value="RL">R → L</option>
            <option value="TB">T ↓ B</option>
            <option value="BT">B ↑ T</option>
          </select>
          <label title="Toggle [N] prefix on array items">
            <input
              type="checkbox"
              checked={params.showArrayIndices}
              onChange={(e) =>
                updateParam("showArrayIndices", e.target.checked)
              }
            />
            [N]
          </label>
          <label title="Separate primitive values into child nodes">
            <input
              type="checkbox"
              checked={params.explodePrimitives}
              onChange={(e) =>
                updateParam("explodePrimitives", e.target.checked)
              }
            />
            explode
          </label>
          <button
            className="json-tree-reset-btn"
            onClick={() => resetRef.current()}
            title="Reset view"
          >
            ⤢
          </button>
        </div>
      </div>
      <div className="panel-body json-tree-body" ref={containerRef}>
        {perfBlocked && (
          <div className="json-tree-perf-warning">
            <p>
              <strong>{nodeCount.toLocaleString()}</strong> tree nodes detected
              (threshold {params.nodeThreshold.toLocaleString()}).
            </p>
            <p>
              Rendering may be slow. Click to proceed anyway, or reduce the JSON
              size.
            </p>
            <button onClick={() => updateParam("bypassPerf", true)}>
              Render anyway
            </button>
          </div>
        )}
      </div>
    </>
  );
}
