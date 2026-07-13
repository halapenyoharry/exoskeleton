import { useEffect, useMemo, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import * as d3 from "d3";
import { useJsonDoc } from "../../data/useJsonDoc";
import { getDocStats } from "../../data/json-utils/docStats";
import { useElementSize } from "../../useElementSize";
import { jsonToHierarchy } from "../../data/json-utils/jsonToHierarchy";
import "./JsonMassPanel.css";

/**
 * json-mass: circle-packing weighted by *mass* (line count, image weight,
 * etc.) instead of leaf count. Designed for project-mass-scanner output
 * but degrades gracefully to count-weighting on arbitrary JSON.
 */

export interface MassNode {
  name: string;
  mass?: number;
  substrate?: "text" | "image" | string;
  children?: MassNode[];
}

type PackNode = d3.HierarchyCircularNode<MassNode>;

export interface JsonMassParams {
  documentId: string;
  padding: number;
  leafFontSize: number;
  textSubstrateColor: string;
  imageSubstrateColor: string;
  internalGradientStart: string;
  internalGradientEnd: string;
  defaultLeafMass: number;
  panZoomMin: number;
  panZoomMax: number;
  nodeThreshold: number;
}

export const jsonMassDefaults: JsonMassParams = {
  documentId: "default",
  padding: 3,
  leafFontSize: 16,
  textSubstrateColor: "#0f1447",
  imageSubstrateColor: "#ff6b9d",
  internalGradientStart: "#0f1447",
  internalGradientEnd: "#00e5ff",
  defaultLeafMass: 1,
  panZoomMin: 0.25,
  panZoomMax: 12,
  nodeThreshold: 5000,
};

const EMPTY: MassNode = { name: "Waiting for JSON…", children: [] };

function extractTree(parsed: unknown): MassNode {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "tree" in parsed &&
    typeof (parsed as Record<string, unknown>).tree === "object"
  ) {
    return (parsed as { tree: MassNode }).tree;
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "name" in parsed
  ) {
    return parsed as MassNode;
  }
  return jsonToHierarchy(parsed, false, "root", true) as MassNode;
}


function splitIntoLines(words: string[], n: number): string[] {
  if (n <= 1) return [words.join(" ")];
  if (words.length <= n) return words.slice();
  const totalChars = words.reduce((s, w) => s + w.length, 0);
  const target = totalChars / n;
  const lines: string[][] = Array.from({ length: n }, () => [] as string[]);
  let currentLine = 0;
  let currentChars = 0;
  for (const w of words) {
    if (
      currentChars > 0 &&
      currentChars + w.length / 2 >= target &&
      currentLine < n - 1
    ) {
      currentLine++;
      currentChars = 0;
    }
    lines[currentLine].push(w);
    currentChars += w.length;
  }
  return lines.map((l) => l.join(" ")).filter((l) => l.length > 0);
}

function renderLines<TDatum>(
  textSel: d3.Selection<SVGTextElement, TDatum, null, undefined>,
  lines: string[],
): void {
  textSel.selectAll("tspan").remove();
  const n = lines.length;
  const firstDy = n > 1 ? `${-(n - 1) * 0.55}em` : "0";
  lines.forEach((line, i) => {
    textSel
      .append("tspan")
      .attr("x", 0)
      .attr("dy", i === 0 ? firstDy : "1.1em")
      .text(line);
  });
}

function fitWrappedLeafText<TDatum>(
  textSel: d3.Selection<SVGTextElement, TDatum, null, undefined>,
  text: string,
  r: number,
): void {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    textSel.text("");
    return;
  }
  const node = textSel.node() as SVGTextElement;
  const maxDiag = r * 1.85;
  const maxLines = Math.min(words.length, 6);
  let bestScale = 0;
  let bestLines: string[] = [text];
  for (let n = 1; n <= maxLines; n++) {
    const lines = splitIntoLines(words, n);
    renderLines(textSel, lines);
    const bbox = node.getBBox();
    const diag = Math.hypot(bbox.width, bbox.height);
    const scale = diag > 0 ? maxDiag / diag : 0;
    if (scale > bestScale) {
      bestScale = scale;
      bestLines = lines;
    }
  }
  renderLines(textSel, bestLines);
  textSel.attr("transform", `scale(${bestScale})`);
}

function circlePathTopClockwise(r: number): string {
  return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${r} ${r} 0 0 1 0 ${-r}`;
}

export default function JsonMassPanel(
  props: IDockviewPanelProps<JsonMassParams>,
) {
  const params: JsonMassParams = {
    ...jsonMassDefaults,
    ...(props.params ?? {}),
  };


  // Visibility-aware doc subscription; debounced resize (see the hooks).
  const doc = useJsonDoc(props.api, params.documentId);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(containerRef);

  // Perf gate BEFORE the transform (cached stats read); bypass is
  // session-only so it never persists into the saved layout.
  const [bypassPerf, setBypassPerf] = useState(false);
  const nodeCount = doc === undefined ? 0 : getDocStats(doc).hierarchyNodeCount;
  const perfBlocked = nodeCount > params.nodeThreshold && !bypassPerf;

  const rootData = useMemo<MassNode>(() => {
    if (doc === undefined || perfBlocked) return EMPTY;
    try {
      return extractTree(doc);
    } catch {
      return { name: "Invalid JSON", children: [] };
    }
  }, [doc, perfBlocked]);

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

    const { width, height } = size;
    const diameter = Math.min(width, height);
    const container = containerRef.current;

    const hierarchy = d3
      .hierarchy<MassNode>(rootData, (d) => d.children)
      .sum((d) => {
        if (d.children && d.children.length > 0) return 0;
        return d.mass && d.mass > 0 ? d.mass : params.defaultLeafMass;
      })
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const pack = d3
      .pack<MassNode>()
      .size([diameter, diameter])
      .padding(params.padding);

    const root = pack(hierarchy);
    const maxDepth = d3.max(root.descendants(), (d) => d.depth) ?? 1;

    function substrateFill(
      substrate: string | undefined,
      depth: number,
    ): string {
      if (substrate === "text") return params.textSubstrateColor;
      if (substrate === "image") return params.imageSubstrateColor;
      const t = Math.min(depth / Math.max(maxDepth, 1), 1);
      const interp = d3.interpolateHcl(
        params.internalGradientStart,
        params.internalGradientEnd,
      );
      return interp(t);
    }

    const svg = d3
      .select(container)
      .append("svg")
      .attr(
        "viewBox",
        `-${diameter / 2} -${diameter / 2} ${diameter} ${diameter}`,
      )
      .attr("width", width)
      .attr("height", height)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("class", "json-mass-svg");

    svgRef.current = svg.node();

    let focus: PackNode = root;
    let view: [number, number, number] = [root.x, root.y, root.r * 2];

    const panZoomGroup = svg.append("g").attr("class", "json-mass-pan-zoom");

    const node = panZoomGroup
      .append("g")
      .selectAll<SVGCircleElement, PackNode>("circle")
      .data(root.descendants().slice(1))
      .join("circle")
      .attr("class", "json-mass-node")
      .attr("fill", (d) => substrateFill(d.data.substrate, d.depth))
      .attr("stroke", (d) =>
        d.children ? "rgba(0, 229, 255, 0.18)" : "rgba(0, 229, 255, 0.35)",
      )
      .attr("stroke-width", 0.6)
      .attr("pointer-events", (d) => (!d.children ? "none" : null))
      .on("mouseover", function () {
        d3.select(this).attr("stroke", "#00e5ff").attr("stroke-width", 2);
      })
      .on("mouseout", function () {
        const d = d3.select<SVGCircleElement, PackNode>(this).datum();
        d3.select(this)
          .attr(
            "stroke",
            d.children
              ? "rgba(0, 229, 255, 0.18)"
              : "rgba(0, 229, 255, 0.35)",
          )
          .attr("stroke-width", 0.6);
      })
      .on("click", (event: MouseEvent, d) => {
        if (focus !== d) {
          zoom(d);
          event.stopPropagation();
        }
      });

    node.append("title").text((d) => {
      const mass = d.value ?? 0;
      const substrate =
        d.data.substrate ?? (d.children ? "container" : "unknown");
      return `${d.data.name}\nmass: ${mass.toLocaleString()}\nsubstrate: ${substrate}`;
    });

    const label = panZoomGroup
      .append("g")
      .attr("class", "json-mass-labels")
      .attr("pointer-events", "none")
      .selectAll<SVGGElement, PackNode>("g.json-mass-label")
      .data(root.descendants())
      .join("g")
      .attr("class", "json-mass-label")
      .style("opacity", (d) => (d.parent === root ? 1 : 0))
      .style("display", (d) => (d.parent === root ? null : "none"));

    label.each(function (d, i) {
      const g = d3.select<SVGGElement, PackNode>(this);
      const isLeaf = !d.children || d.children.length === 0;

      if (isLeaf) {
        const textEl = g
          .append("text")
          .attr("class", "leaf-text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .style("font-size", `${params.leafFontSize}px`);
        fitWrappedLeafText(textEl, d.data.name, d.r);
      } else {
        const pathId = `mcp-${i}`;
        const pathR = d.r * 0.92;
        g.append("path")
          .attr("id", pathId)
          .attr("d", circlePathTopClockwise(pathR))
          .attr("fill", "none")
          .attr("stroke", "none");
        const fontSize = Math.max(d.r * 0.16, 3);
        g.append("text")
          .attr("class", "container-text")
          .style("font-size", `${fontSize}px`)
          .append("textPath")
          .attr("href", `#${pathId}`)
          .attr("startOffset", "0")
          .style("text-anchor", "start")
          .text(d.data.name);
      }
    });

    let isZoomDrag = false;
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([params.panZoomMin, params.panZoomMax])
      .on("start", () => {
        isZoomDrag = false;
      })
      .on("zoom", (event) => {
        if (event.sourceEvent) isZoomDrag = true;
        panZoomGroup.attr("transform", event.transform.toString());
      });

    svg.call(zoomBehavior).on("dblclick.zoom", null);

    svg.on("click", () => {
      if (isZoomDrag) return;
      if (focus !== root) zoom(root);
    });

    resetRef.current = () => {
      svg
        .transition()
        .duration(500)
        .call(zoomBehavior.transform as never, d3.zoomIdentity);
      if (focus !== root) zoom(root);
    };

    zoomTo(view);

    function zoomTo(v: [number, number, number]) {
      const k = diameter / v[2];
      view = v;
      label.attr(
        "transform",
        (d) =>
          `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k}) scale(${k})`,
      );
      node.attr(
        "transform",
        (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`,
      );
      node.attr("r", (d) => d.r * k);
    }

    function zoom(d: PackNode) {
      focus = d;
      const transition = svg
        .transition()
        .duration(750)
        .tween("zoom", () => {
          const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
          return (t) => zoomTo(i(t) as [number, number, number]);
        });

      label
        .filter(function (d) {
          return (
            d.parent === focus ||
            (this as SVGGElement).style.display !== "none"
          );
        })
        // See json-circles for the rationale on this cast.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .transition(transition as any)
        .style("opacity", (d) => (d.parent === focus ? 1 : 0))
        .on("start", function (d) {
          if (d.parent === focus)
            (this as SVGGElement).style.display = "";
        })
        .on("end", function (d) {
          if (d.parent !== focus)
            (this as SVGGElement).style.display = "none";
        });
    }

    return () => {
      if (svgRef.current) {
        svgRef.current.remove();
        svgRef.current = null;
      }
    };
    // Destructured primitives, not the identity-unstable `params` object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rootData,
    size,
    perfBlocked,
    params.padding,
    params.leafFontSize,
    params.textSubstrateColor,
    params.imageSubstrateColor,
    params.internalGradientStart,
    params.internalGradientEnd,
    params.defaultLeafMass,
    params.panZoomMin,
    params.panZoomMax,
  ]);

  return (
    <>
      <div className="panel-header json-mass-header">
        <span>json-mass</span>
        <button
          onClick={() => resetRef.current()}
          title="Reset view"
          className="json-mass-reset-btn"
        >
          ⤢
        </button>
      </div>
      <div className="panel-body json-mass-body" ref={containerRef}>
        {perfBlocked && (
          <div className="json-mass-perf-warning">
            <p>
              <strong>{nodeCount.toLocaleString()}</strong> tree nodes detected
              (threshold {params.nodeThreshold.toLocaleString()}).
            </p>
            <button onClick={() => setBypassPerf(true)}>
              Render anyway
            </button>
          </div>
        )}
      </div>
    </>
  );
}
