import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import * as d3 from "d3";
import {
  areGraphsConnected,
  broadcastNodeFocus,
  broadcastNodeSelection,
  getActiveDocumentId,
  onActiveDocumentIdChange,
  onGraphsConnectionChange,
  onNodeFocusBroadcast,
  onNodeSelectionBroadcast,
} from "../../osc/channels";
import { useJsonDoc } from "../../data/useJsonDoc";
import { getDetectedGraph, getDocStats } from "../../data/json-utils/docStats";
import { useElementSize } from "../../useElementSize";
import {
  buildField,
  defaultRules,
  heaviest,
  mulberry32,
  step as stepWalker,
  traverse,
  type Field,
  type FieldRules,
  type WalkMode,
  type Walker,
} from "./field";
import { FieldWorld, defaultPhysics, initPhysics, type BodyView } from "./physics";
import "./JsonAttentionPanel.css";

/**
 * json-attention: the field with an attention token in it.
 *
 * Every other graph viewer in the suite draws the document. This one
 * draws what happens to the document when something moves through it.
 * Nodes are rigid bodies whose mass is earned from their connections;
 * a token of attention walks the edges, bent toward heavy nodes, and
 * every path it takes gets heavier. Park it on a node and the node
 * grows without the token going anywhere. The geometry you see at any
 * moment is the history of where attention has been.
 *
 * Synced by identity over the json-bus like the other graph panels:
 * hover broadcasts a selection, click broadcasts a focus, and an
 * incoming focus from another panel sends attention there.
 */

export interface JsonAttentionParams {
  documentId: string;
  mode: WalkMode;
  /** Milliseconds between hops in walk mode / ticks in dwell mode. */
  hopMs: number;
  gravityBias: number;
  traverseGain: number;
  dwellGain: number;
  jumpRate: number;
  showLabels: boolean;
  labelCount: number;
  fitOnLoad: boolean;
  nodeThreshold: number;
  seed: number;
}

export const jsonAttentionDefaults: JsonAttentionParams = {
  documentId: "default",
  mode: "walk",
  hopMs: 700,
  gravityBias: defaultRules.gravityBias,
  traverseGain: defaultRules.traverseGain,
  dwellGain: defaultRules.dwellGain,
  jumpRate: defaultRules.jumpRate,
  showLabels: true,
  labelCount: 12,
  fitOnLoad: true,
  nodeThreshold: 400,
  seed: 1,
};

const ACCENT = "#e879f9";
const ACCENT_DIM = "rgba(232, 121, 249, 0.35)";
const EDGE = "rgba(200, 210, 255, 0.22)";
const EDGE_HOT = "rgba(232, 121, 249, 0.55)";
const NODE_FILL = "#1a2246";
const NODE_STROKE = "rgba(200, 210, 255, 0.45)";
const SELECTED = "#ffffff";
const LABEL = "rgba(226, 232, 255, 0.85)";
const TOKEN = "#fef08a";

interface Token {
  x: number;
  y: number;
  targetId: string | null;
  trail: { x: number; y: number }[];
}

export default function JsonAttentionPanel(
  props: IDockviewPanelProps<JsonAttentionParams>,
) {
  const params: JsonAttentionParams = {
    ...jsonAttentionDefaults,
    ...(props.params ?? {}),
  };

  const updateParam = <K extends keyof JsonAttentionParams>(
    key: K,
    value: JsonAttentionParams[K],
  ) => {
    props.api.updateParameters({ ...params, [key]: value });
  };

  // ─── document following (same contract as the other graph viewers) ───
  const [activeDocId, setActiveDocId] = useState(params.documentId);
  const [connected, setConnected] = useState(areGraphsConnected());
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

  const graph = useMemo(() => {
    if (doc === undefined || perfBlocked) return null;
    return getDetectedGraph(doc);
  }, [doc, perfBlocked]);

  // ─── physics engine (loaded once per page) ───
  const [rapier, setRapier] = useState<Awaited<ReturnType<typeof initPhysics>> | null>(null);
  const [physicsError, setPhysicsError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    initPhysics()
      .then((R) => alive && setRapier(R))
      .catch((e) => alive && setPhysicsError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  // ─── mutable simulation state (refs: the render loop reads them) ───
  const fieldRef = useRef<Field | null>(null);
  const worldRef = useRef<FieldWorld | null>(null);
  const walkerRef = useRef<Walker>({ at: null, mode: params.mode, from: null });
  const rulesRef = useRef<FieldRules>({ ...defaultRules });
  const rngRef = useRef(mulberry32(params.seed));
  const tokenRef = useRef<Token>({ x: 0, y: 0, targetId: null, trail: [] });
  const selectedRef = useRef<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const viewRef = useRef<BodyView[]>([]);
  const [generation, setGeneration] = useState(0);
  const [status, setStatus] = useState<{ at: string | null; mass: number; heaviest: string | null }>({
    at: null,
    mass: 0,
    heaviest: null,
  });
  const [hoverInfo, setHoverInfo] = useState<{
    label: string;
    mass: number;
    density: number;
    visits: number;
    dwelled: number;
  } | null>(null);

  rulesRef.current = {
    traverseGain: params.traverseGain,
    dwellGain: params.dwellGain,
    gravityBias: params.gravityBias,
    jumpRate: params.jumpRate,
    backtrackPenalty: defaultRules.backtrackPenalty,
  };
  walkerRef.current.mode = params.mode;

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const size = useElementSize(bodyRef);

  // ─── build / rebuild the world when the document or engine changes ───
  useEffect(() => {
    if (!rapier) return;
    const prevWorld = worldRef.current;
    const seedPositions = new Map<string, { x: number; y: number }>();
    if (prevWorld) {
      for (const v of prevWorld.view()) seedPositions.set(v.id, { x: v.x, y: v.y });
      prevWorld.dispose();
      worldRef.current = null;
    }
    if (!graph || graph.nodes.length === 0) {
      fieldRef.current = null;
      walkerRef.current.at = null;
      walkerRef.current.from = null;
      tokenRef.current.targetId = null;
      setGeneration((g) => g + 1);
      return;
    }
    const field = buildField(graph);
    fieldRef.current = field;
    worldRef.current = new FieldWorld(rapier, field, defaultPhysics, seedPositions);
    // Keep attention where it was if that node survived the edit.
    const w = walkerRef.current;
    if (w.at && !field.byId.has(w.at)) {
      w.at = null;
      w.from = null;
    }
    tokenRef.current.targetId = w.at;
    tokenRef.current.trail = [];
    setGeneration((g) => g + 1);
  }, [rapier, graph]);

  useEffect(() => () => worldRef.current?.dispose(), []);

  // ─── the walker clock ───
  useEffect(() => {
    const id = window.setInterval(() => {
      const field = fieldRef.current;
      if (!field || !props.api.isVisible) return;
      const w = walkerRef.current;
      if (w.mode === "paused") return;
      stepWalker(field, w, rulesRef.current, rngRef.current);
      tokenRef.current.targetId = w.at;
      const node = w.at ? field.byId.get(w.at) : undefined;
      const top = heaviest(field);
      setStatus({ at: node?.label ?? null, mass: node?.mass ?? 0, heaviest: top?.label ?? null });
    }, Math.max(60, params.hopMs));
    return () => window.clearInterval(id);
  }, [params.hopMs, props.api]);

  // ─── render loop ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let lastT = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const dpr = window.devicePixelRatio || 1;
      const W = size.width;
      const H = size.height;
      if (W === 0 || H === 0) return;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      if (!props.api.isVisible) return;

      const world = worldRef.current;
      const field = fieldRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!world || !field) return;

      world.step();
      const view = world.view(viewRef.current);
      const byId = new Map<string, BodyView>();
      for (const v of view) byId.set(v.id, v);

      // Token eases toward its target node; arrival leaves a trail point.
      const token = tokenRef.current;
      if (token.targetId) {
        const t = byId.get(token.targetId);
        if (t) {
          if (token.trail.length === 0 && token.x === 0 && token.y === 0) {
            token.x = t.x;
            token.y = t.y;
          }
          const k = 1 - Math.pow(0.001, dt);
          token.x += (t.x - token.x) * k;
          token.y += (t.y - token.y) * k;
          const last = token.trail[token.trail.length - 1];
          if (!last || Math.hypot(last.x - token.x, last.y - token.y) > 3) {
            token.trail.push({ x: token.x, y: token.y });
            if (token.trail.length > 80) token.trail.shift();
          }
        }
      }

      const tr = transformRef.current;
      ctx.save();
      ctx.translate(W / 2 + tr.x, H / 2 + tr.y);
      ctx.scale(tr.k, tr.k);

      const selected = selectedRef.current;
      const hovered = hoverRef.current;
      const at = walkerRef.current.at;

      // Edges. Width and opacity follow weight; the token's last edge is hot.
      ctx.lineCap = "round";
      for (const e of field.edges) {
        const a = byId.get(e.source);
        const b = byId.get(e.target);
        if (!a || !b) continue;
        const hot =
          (e.source === at && e.target === walkerRef.current.from) ||
          (e.target === at && e.source === walkerRef.current.from);
        const w = Math.min(6, 0.6 + Math.log2(e.weight) * 1.2);
        ctx.strokeStyle = hot ? EDGE_HOT : EDGE;
        ctx.globalAlpha = hot ? 1 : Math.min(1, 0.5 + e.weight * 0.08);
        ctx.lineWidth = w / tr.k;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Trail.
      if (token.trail.length > 1) {
        ctx.strokeStyle = TOKEN;
        ctx.lineWidth = 1.5 / tr.k;
        for (let i = 1; i < token.trail.length; i++) {
          ctx.globalAlpha = (i / token.trail.length) * 0.5;
          ctx.beginPath();
          ctx.moveTo(token.trail[i - 1].x, token.trail[i - 1].y);
          ctx.lineTo(token.trail[i].x, token.trail[i].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Nodes.
      for (const v of view) {
        const node = field.byId.get(v.id)!;
        const isAt = v.id === at;
        const isSel = v.id === selected;
        const isHov = v.id === hovered;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
        if (node.reified) {
          ctx.fillStyle = "rgba(26, 34, 70, 0.4)";
          ctx.fill();
          ctx.setLineDash([3 / tr.k, 3 / tr.k]);
          ctx.strokeStyle = NODE_STROKE;
          ctx.lineWidth = 1 / tr.k;
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          const warm = Math.min(1, node.dwelled / 40 + node.visits / 30);
          ctx.fillStyle = warm > 0 ? mix(NODE_FILL, ACCENT, warm * 0.6) : NODE_FILL;
          ctx.fill();
          ctx.strokeStyle = isSel || isHov ? SELECTED : isAt ? ACCENT : NODE_STROKE;
          ctx.lineWidth = (isSel || isAt ? 2 : 1) / tr.k;
          ctx.stroke();
        }
        if (isAt) {
          ctx.beginPath();
          ctx.arc(v.x, v.y, v.r + 5 / tr.k, 0, Math.PI * 2);
          ctx.strokeStyle = ACCENT_DIM;
          ctx.lineWidth = 3 / tr.k;
          ctx.stroke();
        }
      }

      // Token.
      if (token.targetId) {
        ctx.beginPath();
        ctx.arc(token.x, token.y, 4 / tr.k + 1, 0, Math.PI * 2);
        ctx.fillStyle = TOKEN;
        ctx.shadowColor = TOKEN;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Labels: heaviest N, plus hovered, selected and current.
      if (params.showLabels) {
        const sorted = [...field.nodes].sort((a, b) => b.mass - a.mass);
        const labelIds = new Set(sorted.slice(0, params.labelCount).map((n) => n.id));
        if (hovered) labelIds.add(hovered);
        if (selected) labelIds.add(selected);
        if (at) labelIds.add(at);
        ctx.fillStyle = LABEL;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (const id of labelIds) {
          const v = byId.get(id);
          const node = field.byId.get(id);
          if (!v || !node) continue;
          const fontPx = Math.max(10, Math.min(22, 9 + Math.sqrt(node.mass) * 1.6));
          ctx.font = `${fontPx / tr.k}px system-ui, sans-serif`;
          const text = node.label.length > 28 ? node.label.slice(0, 26) + "…" : node.label;
          ctx.fillText(text, v.x, v.y + v.r + 3 / tr.k);
        }
      }
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size.width, size.height, params.showLabels, params.labelCount, props.api, generation]);

  // ─── pan / zoom / hover / click / drag ───
  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const tr = transformRef.current;
      return {
        x: (sx - size.width / 2 - tr.x) / tr.k,
        y: (sy - size.height / 2 - tr.y) / tr.k,
      };
    },
    [size.width, size.height],
  );

  const parkAttentionOn = useCallback(
    (id: string) => {
      const field = fieldRef.current;
      if (!field || !field.byId.has(id)) return;
      const w = walkerRef.current;
      traverse(field, w, id, rulesRef.current);
      tokenRef.current.targetId = id;
      const node = field.byId.get(id)!;
      setStatus({ at: node.label, mass: node.mass, heaviest: heaviest(field)?.label ?? null });
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sel = d3.select(canvas);
    let dragId: string | null = null;
    let dragMoved = false;

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.15, 6])
      .filter((event) => {
        // Let node drags through; everything else pans/zooms.
        if (event.type === "mousedown" || event.type === "touchstart") {
          if (hoverRef.current) return false;
          const [sx, sy] = d3.pointer(event, canvas);
          const p = screenToWorld(sx, sy);
          return !worldRef.current?.hitTest(p.x, p.y);
        }
        return !event.ctrlKey || event.type === "wheel";
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform;
      });
    sel.call(zoom);

    const drag = d3
      .drag<HTMLCanvasElement, unknown>()
      .filter((event) => {
        if (hoverRef.current) return true;
        const [sx, sy] = d3.pointer(event, canvas);
        const p = screenToWorld(sx, sy);
        return !!worldRef.current?.hitTest(p.x, p.y);
      })
      .on("start", (event) => {
        // Prefer the node the cursor was last over: bodies move, and a
        // re-test at mousedown can miss what the person meant to grab.
        const p = screenToWorld(event.x, event.y);
        const id = hoverRef.current ?? worldRef.current?.hitTest(p.x, p.y) ?? null;
        dragId = id;
        dragMoved = false;
        if (id) worldRef.current?.beginDrag(id);
      })
      .on("drag", (event) => {
        if (!dragId) return;
        dragMoved = true;
        const p = screenToWorld(event.x, event.y);
        worldRef.current?.drag(dragId, p.x, p.y);
      })
      .on("end", () => {
        if (!dragId) return;
        worldRef.current?.endDrag(dragId);
        if (!dragMoved) {
          // A click: park attention here and tell the other panels.
          parkAttentionOn(dragId);
          if (areGraphsConnected()) broadcastNodeFocus(activeDocId, dragId, props.api.id);
        }
        dragId = null;
      });
    sel.call(drag);

    const onMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const p = screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
      const id = worldRef.current?.hitTest(p.x, p.y) ?? null;
      if (id === hoverRef.current) return;
      hoverRef.current = id;
      canvas.style.cursor = id ? "pointer" : "grab";
      const hn = id ? fieldRef.current?.byId.get(id) : undefined;
      setHoverInfo(
        hn
          ? { label: hn.label, mass: hn.mass, density: hn.density, visits: hn.visits, dwelled: hn.dwelled }
          : null,
      );
      if (areGraphsConnected()) {
        const label = id ? fieldRef.current?.byId.get(id)?.label : undefined;
        broadcastNodeSelection(activeDocId, id, props.api.id, label);
      }
    };
    const onLeave = () => {
      if (hoverRef.current === null) return;
      hoverRef.current = null;
      setHoverInfo(null);
      if (areGraphsConnected()) broadcastNodeSelection(activeDocId, null, props.api.id);
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      sel.on(".zoom", null);
      sel.on(".drag", null);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [screenToWorld, activeDocId, props.api.id, parkAttentionOn, generation]);

  // ─── incoming sync from other panels ───
  useEffect(() => {
    const unsubSel = onNodeSelectionBroadcast((event) => {
      if (!areGraphsConnected() || event.sourcePanelId === props.api.id || event.documentId !== activeDocId) return;
      selectedRef.current = event.nodeId;
    });
    const unsubFocus = onNodeFocusBroadcast((event) => {
      if (!areGraphsConnected() || event.sourcePanelId === props.api.id || event.documentId !== activeDocId) return;
      parkAttentionOn(event.nodeId);
      // Ease the camera there in this panel's own coordinates.
      const pos = worldRef.current?.positionOf(event.nodeId);
      const canvas = canvasRef.current;
      if (pos && canvas) {
        const k = Math.max(transformRef.current.k, 1.2);
        d3.select(canvas)
          .transition()
          .duration(500)
          .tween("attention-focus", () => {
            const from = transformRef.current;
            const to = d3.zoomIdentity.translate(-pos.x * k, -pos.y * k).scale(k);
            const ix = d3.interpolateNumber(from.x, to.x);
            const iy = d3.interpolateNumber(from.y, to.y);
            const ik = d3.interpolateNumber(from.k, to.k);
            return (t) => {
              transformRef.current = d3.zoomIdentity.translate(ix(t), iy(t)).scale(ik(t));
            };
          });
      }
    });
    return () => {
      unsubSel();
      unsubFocus();
    };
  }, [activeDocId, props.api.id, parkAttentionOn]);

  const fit = () => {
    const world = worldRef.current;
    if (!world || size.width === 0) return;
    const b = world.bounds();
    const bw = Math.max(1, b.maxX - b.minX);
    const bh = Math.max(1, b.maxY - b.minY);
    const k = Math.min(2, 0.9 * Math.min(size.width / bw, size.height / bh));
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    transformRef.current = d3.zoomIdentity.translate(-cx * k, -cy * k).scale(k);
    const canvas = canvasRef.current;
    if (canvas) d3.select(canvas).call(d3.zoom<HTMLCanvasElement, unknown>().transform, transformRef.current);
  };

  // Fit once the first frames have settled, like the other graph viewers.
  useEffect(() => {
    if (!params.fitOnLoad || !worldRef.current || size.width === 0) return;
    const t = window.setTimeout(fit, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, size.width, size.height]);

  const reset = () => {
    if (!graph || !rapier) return;
    const prev = worldRef.current;
    const seedPositions = new Map<string, { x: number; y: number }>();
    if (prev) {
      for (const v of prev.view()) seedPositions.set(v.id, { x: v.x, y: v.y });
      prev.dispose();
    }
    const field = buildField(graph);
    fieldRef.current = field;
    worldRef.current = new FieldWorld(rapier, field, defaultPhysics, seedPositions);
    walkerRef.current.at = null;
    walkerRef.current.from = null;
    tokenRef.current = { x: 0, y: 0, targetId: null, trail: [] };
    rngRef.current = mulberry32(params.seed);
    setStatus({ at: null, mass: 0, heaviest: heaviest(field)?.label ?? null });
    setGeneration((g) => g + 1);
  };

  const modeButton = (m: WalkMode, label: string) => (
    <button
      type="button"
      className={`json-attention-mode${params.mode === m ? " active" : ""}`}
      onClick={() => updateParam("mode", m)}
      title={
        m === "walk"
          ? "Attention moves along edges, bent toward heavy nodes. Every hop makes that edge heavier."
          : m === "dwell"
            ? "Attention stays where it is. Existing edges touching that node grow; nothing new is made."
            : "Freeze attention. Physics keeps running."
      }
    >
      {label}
    </button>
  );

  return (
    <div className="json-attention-root">
      <div className="json-attention-header">
        <div className="json-attention-controls">
          {modeButton("walk", "walk")}
          {modeButton("dwell", "dwell")}
          {modeButton("paused", "hold")}
          <label title="Time between hops">
            tempo
            <input
              type="range"
              min={100}
              max={2000}
              step={50}
              value={params.hopMs}
              onChange={(e) => updateParam("hopMs", Number(e.target.value))}
            />
          </label>
          <label title="How strongly mass bends the walk. 0 is a fair coin; 2 is a black hole.">
            gravity
            <input
              type="range"
              min={0}
              max={2.5}
              step={0.1}
              value={params.gravityBias}
              onChange={(e) => updateParam("gravityBias", Number(e.target.value))}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={params.showLabels}
              onChange={(e) => updateParam("showLabels", e.target.checked)}
            />
            labels
          </label>
          <button type="button" className="json-attention-btn" onClick={fit} title="Fit to view">
            fit
          </button>
          <button
            type="button"
            className="json-attention-btn"
            onClick={reset}
            title="Forget everything attention did. The document's own structure stays."
          >
            forget
          </button>
        </div>
        <div className="json-attention-status">
          {hoverInfo ? (
            <>
              <span className="json-attention-status-key">{hoverInfo.label}</span>{" "}
              <span className="json-attention-status-mass">
                m {hoverInfo.mass.toFixed(1)} · density {hoverInfo.density.toFixed(2)} · visits{" "}
                {hoverInfo.visits} · dwelled {hoverInfo.dwelled}
              </span>
            </>
          ) : status.at ? (
            <>
              <span className="json-attention-status-key">on</span> {status.at}{" "}
              <span className="json-attention-status-mass">m {status.mass.toFixed(1)}</span>
            </>
          ) : (
            <span className="json-attention-status-key">attention unplaced</span>
          )}
          {status.heaviest && (
            <>
              {"  ·  "}
              <span className="json-attention-status-key">heaviest</span> {status.heaviest}
            </>
          )}
        </div>
      </div>
      <div className="json-attention-body" ref={bodyRef}>
        <canvas ref={canvasRef} className="json-attention-canvas" />
        {physicsError && (
          <div className="json-attention-empty">physics engine failed to load: {physicsError}</div>
        )}
        {!physicsError && !rapier && <div className="json-attention-empty">loading physics…</div>}
        {rapier && doc === undefined && (
          <div className="json-attention-empty">waiting for a document on “{activeDocId}”</div>
        )}
        {rapier && doc !== undefined && !isGraph && (
          <div className="json-attention-empty">
            this document isn’t graph-shaped — needs nodes and links
          </div>
        )}
        {rapier && perfBlocked && (
          <div className="json-attention-empty">
            <div>
              {nodeCount} nodes — above the {params.nodeThreshold}-node gate (gravity is n²).
            </div>
            <button type="button" className="json-attention-btn" onClick={() => setBypassPerf(true)}>
              run it anyway
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Mix two hex colors. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}
