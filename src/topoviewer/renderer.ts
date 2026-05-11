// TopoViewer Canvas renderer — force-directed layout, semantic zoom, the node IS the node

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior, type D3ZoomEvent } from "d3-zoom";
import { select } from "d3-selection";
import type { LayoutNode, LayoutLink, Layer } from "./types";

export interface RendererState {
  nodes: LayoutNode[];
  links: LayoutLink[];
  layers: Layer[];
  hoveredNode: LayoutNode | null;
  selectedNode: LayoutNode | null;
  transform: { x: number; y: number; k: number };
  draggedNode: LayoutNode | null;
}

export interface Renderer {
  setData(nodes: LayoutNode[], links: LayoutLink[], layers: Layer[]): void;
  setLayers(layers: Layer[]): void;
  getState(): RendererState;
  onNodeSelect(cb: (node: LayoutNode | null) => void): void;
  resize(w: number, h: number): void;
  destroy(): void;
}

export function createRenderer(canvas: HTMLCanvasElement, width: number, height: number): Renderer {
  const ctx = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;

  let nodes: LayoutNode[] = [];
  let links: LayoutLink[] = [];
  let layers: Layer[] = [];
  let simulation: Simulation<LayoutNode, LayoutLink> | null = null;
  let transform = { x: 0, y: 0, k: 1 };
  let hoveredNode: LayoutNode | null = null;
  let selectedNode: LayoutNode | null = null;
  let draggedNode: LayoutNode | null = null;
  let selectCb: ((n: LayoutNode | null) => void) | null = null;
  let animFrame = 0;
  let zoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown>;

  function sizeCanvas(w: number, h: number) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    width = w;
    height = h;
  }

  sizeCanvas(width, height);

  // Zoom + pan via d3-zoom
  zoomBehavior = d3Zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.05, 8])
    .on("zoom", (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
      transform = { x: event.transform.x, y: event.transform.y, k: event.transform.k };
      draw();
    });

  select(canvas).call(zoomBehavior);

  // Mouse interaction
  function canvasToWorld(cx: number, cy: number): [number, number] {
    return [(cx - transform.x) / transform.k, (cy - transform.y) / transform.k];
  }

  function findNodeAt(cx: number, cy: number): LayoutNode | null {
    const [wx, wy] = canvasToWorld(cx, cy);
    // Search in reverse (top-drawn last)
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const r = nodeRadius(n);
      const dx = n.x - wx;
      const dy = n.y - wy;
      if (dx * dx + dy * dy < r * r) return n;
    }
    return null;
  }

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (draggedNode) {
      const [wx, wy] = canvasToWorld(cx, cy);
      draggedNode.fx = wx;
      draggedNode.fy = wy;
      simulation?.alpha(0.1).restart();
      return;
    }

    const found = findNodeAt(cx, cy);
    if (found !== hoveredNode) {
      hoveredNode = found;
      canvas.style.cursor = found ? "pointer" : "grab";
      draw();
    }
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const found = findNodeAt(cx, cy);
    if (found) {
      draggedNode = found;
      found.fx = found.x;
      found.fy = found.y;
      simulation?.alphaTarget(0.3).restart();
      // Prevent d3-zoom from capturing this drag
      e.stopPropagation();
    }
  });

  canvas.addEventListener("mouseup", () => {
    if (draggedNode) {
      simulation?.alphaTarget(0);
      draggedNode.fx = null;
      draggedNode.fy = null;
      draggedNode = null;
    }
  });

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const found = findNodeAt(cx, cy);
    selectedNode = found;
    selectCb?.(found);
    draw();
  });

  // Visible predicates
  function visiblePredicates(): Set<string> {
    return new Set(layers.filter(l => l.visible).map(l => l.predicate));
  }

  function visibleLinks(): LayoutLink[] {
    const vis = visiblePredicates();
    return links.filter(l => vis.has(l.predicate));
  }

  // Node sizing — based on degree, floor of 18
  function nodeRadius(n: LayoutNode): number {
    return Math.max(18, 8 + n.degree * 3);
  }

  // Measure text width at a given font size
  function textWidth(text: string, fontSize: number): number {
    ctx.font = `${fontSize}px "SF Mono", "Fira Code", monospace`;
    return ctx.measureText(text).width;
  }

  // Draw
  function draw() {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#0d1326";
    ctx.fillRect(0, 0, width, height);

    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const vis = visiblePredicates();
    const vLinks = links.filter(l => vis.has(l.predicate));

    // Draw edges
    for (const link of vLinks) {
      const s = link.source as LayoutNode;
      const t = link.target as LayoutNode;
      if (!s.x || !t.x) continue;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = link.color + "60"; // semi-transparent
      ctx.lineWidth = 1.2 / transform.k;
      ctx.stroke();

      // Arrow for directed edges
      if (link.directed) {
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;
        const r = nodeRadius(t);
        const ratio = (len - r) / len;
        const ax = s.x + dx * ratio;
        const ay = s.y + dy * ratio;
        const angle = Math.atan2(dy, dx);
        const aSize = Math.min(8 / transform.k, 12);

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          ax - aSize * Math.cos(angle - Math.PI / 7),
          ay - aSize * Math.sin(angle - Math.PI / 7)
        );
        ctx.lineTo(
          ax - aSize * Math.cos(angle + Math.PI / 7),
          ay - aSize * Math.sin(angle + Math.PI / 7)
        );
        ctx.closePath();
        ctx.fillStyle = link.color + "80";
        ctx.fill();
      }
    }

    // Semantic zoom threshold — below this k, show shapes not text
    const textThreshold = 0.35;
    const showText = transform.k >= textThreshold;

    // Draw nodes
    for (const node of nodes) {
      const r = nodeRadius(node);
      const isHovered = node === hoveredNode;
      const isSelected = node === selectedNode;

      if (showText) {
        // THE NODE IS THE NODE — text is the primary visual
        const fontSize = Math.max(10, Math.min(14, r * 0.8));
        ctx.font = `${isHovered || isSelected ? "bold " : ""}${fontSize}px "SF Mono", "Fira Code", "Consolas", monospace`;

        const label = node.label;
        const tw = ctx.measureText(label).width;
        const pad = 6;
        const boxW = tw + pad * 2;
        const boxH = fontSize + pad * 2;

        // Background pill
        const bgAlpha = isSelected ? "e0" : isHovered ? "c0" : "80";
        ctx.fillStyle = node.color + bgAlpha;
        ctx.beginPath();
        const cornerR = 4;
        ctx.roundRect(node.x - boxW / 2, node.y - boxH / 2, boxW, boxH, cornerR);
        ctx.fill();

        // Border on selected/hovered
        if (isSelected || isHovered) {
          ctx.strokeStyle = "#ffffff" + (isSelected ? "ff" : "80");
          ctx.lineWidth = 1.5 / transform.k;
          ctx.stroke();
        }

        // Text
        ctx.fillStyle = "#0d1326";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, node.x, node.y);
      } else {
        // Zoomed out — colored shape, no text
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 0.5, 0, Math.PI * 2);
        const bgAlpha = isSelected ? "ff" : isHovered ? "d0" : "90";
        ctx.fillStyle = node.color + bgAlpha;
        ctx.fill();

        if (isSelected || isHovered) {
          ctx.strokeStyle = "#ffffff80";
          ctx.lineWidth = 1 / transform.k;
          ctx.stroke();
        }
      }
    }

    // Hovered node tooltip (shows type + degree)
    if (hoveredNode && !showText) {
      const fontSize = 12 / transform.k;
      ctx.font = `${fontSize}px "SF Mono", monospace`;
      ctx.fillStyle = "#ffffffd0";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(hoveredNode.label, hoveredNode.x, hoveredNode.y - nodeRadius(hoveredNode) * 0.5 - 4 / transform.k);
    }

    ctx.restore();
  }

  function startSimulation() {
    simulation?.stop();

    const vLinks = visibleLinks();

    simulation = forceSimulation<LayoutNode>(nodes)
      .force("link", forceLink<LayoutNode, LayoutLink>(vLinks)
        .id(d => d.id)
        .distance(80)
        .strength(0.3))
      .force("charge", forceManyBody<LayoutNode>().strength(-200))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<LayoutNode>().radius(d => nodeRadius(d) + 4))
      .on("tick", draw);

    // Center the view
    transform = { x: width / 2, y: height / 2, k: 0.8 };
    select(canvas).call(zoomBehavior.transform, zoomIdentity.translate(width / 2, height / 2).scale(0.8));
  }

  return {
    setData(n, l, ly) {
      nodes = n;
      links = l;
      layers = ly;
      startSimulation();
    },

    setLayers(ly) {
      layers = ly;
      // Rebuild simulation with visible links
      if (simulation) {
        const vLinks = visibleLinks();
        simulation.force("link", forceLink<LayoutNode, LayoutLink>(vLinks)
          .id((d: LayoutNode) => d.id)
          .distance(80)
          .strength(0.3));
        simulation.alpha(0.3).restart();
      }
    },

    getState() {
      return { nodes, links, layers, hoveredNode, selectedNode, transform, draggedNode };
    },

    onNodeSelect(cb) {
      selectCb = cb;
    },

    resize(w, h) {
      sizeCanvas(w, h);
      draw();
    },

    destroy() {
      simulation?.stop();
      cancelAnimationFrame(animFrame);
    },
  };
}
