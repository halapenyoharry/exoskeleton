import { useState, useRef, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { parseHypergraph } from "../topoviewer/parse";
import { createRenderer, type Renderer } from "../topoviewer/renderer";
import type { LayoutNode, Layer, Hypergraph } from "../topoviewer/types";
import "./TopoViewerPanel.css";

export default function TopoViewerPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);

  const [path, setPath] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [showLayers, setShowLayers] = useState(true);
  const [showDetail, setShowDetail] = useState(true);

  // Initialize renderer on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    const renderer = createRenderer(canvas, width, height);
    rendererRef.current = renderer;

    renderer.onNodeSelect((node) => {
      setSelectedNode(node);
    });

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        renderer.resize(w, h);
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      renderer.destroy();
    };
  }, []);

  // Open file
  const openFile = useCallback(async () => {
    const picked = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Hypergraph JSON", extensions: ["json"] }],
    });
    if (!picked || typeof picked !== "string") return;

    try {
      const content = await readTextFile(picked);
      const raw = JSON.parse(content) as Hypergraph;
      const parsed = parseHypergraph(raw);

      setPath(picked);
      setNodeCount(parsed.nodes.length);
      setEdgeCount(parsed.links.length);
      setLayers(parsed.layers);
      setSelectedNode(null);

      rendererRef.current?.setData(parsed.nodes, parsed.links, parsed.layers);
    } catch (err) {
      console.error("[topoviewer] failed to parse:", err);
    }
  }, []);

  // Toggle layer visibility
  const toggleLayer = useCallback((predicate: string) => {
    setLayers(prev => {
      const next = prev.map(l =>
        l.predicate === predicate ? { ...l, visible: !l.visible } : l
      );
      rendererRef.current?.setLayers(next);
      return next;
    });
  }, []);

  // Toggle all layers
  const toggleAllLayers = useCallback((visible: boolean) => {
    setLayers(prev => {
      const next = prev.map(l => ({ ...l, visible }));
      rendererRef.current?.setLayers(next);
      return next;
    });
  }, []);

  return (
    <div className="panel-pad panel-pad--topoviewer">
      <div className="panel-header">topoviewer</div>
      <div className="panel-toolbar">
        <button onClick={openFile}>open</button>
        <button onClick={() => setShowLayers(s => !s)}>
          layers {showLayers ? "▾" : "▸"}
        </button>
        <button onClick={() => setShowDetail(s => !s)}>
          detail {showDetail ? "▾" : "▸"}
        </button>
        <span style={{ flex: 1, color: "#4a6a78", fontSize: 11 }}>
          {path ? path.split("/").pop() : "no file"}{" "}
          {nodeCount > 0 && <span className="tv-stat">{nodeCount}n {edgeCount}e</span>}
        </span>
      </div>

      <div className="tv-main">
        {/* Layer sidebar */}
        {showLayers && layers.length > 0 && (
          <div className="tv-sidebar tv-sidebar--layers">
            <div className="tv-sidebar-header">
              <span>layers</span>
              <div className="tv-sidebar-actions">
                <button onClick={() => toggleAllLayers(true)} title="show all">all</button>
                <button onClick={() => toggleAllLayers(false)} title="hide all">none</button>
              </div>
            </div>
            {layers.map(l => (
              <label key={l.predicate} className="tv-layer-row">
                <input
                  type="checkbox"
                  checked={l.visible}
                  onChange={() => toggleLayer(l.predicate)}
                />
                <span className="tv-layer-swatch" style={{ background: l.color }} />
                <span className="tv-layer-name">{l.predicate}</span>
                <span className="tv-layer-count">{l.count}</span>
              </label>
            ))}
          </div>
        )}

        {/* Canvas */}
        <div className="tv-canvas-wrap" ref={containerRef}>
          <canvas ref={canvasRef} />
          {!path && (
            <div className="tv-empty" onClick={openFile}>
              <div className="tv-empty-icon">◎</div>
              <div>open a .hypergraph.topothink.json</div>
            </div>
          )}
        </div>

        {/* Detail sidebar */}
        {showDetail && selectedNode && (
          <div className="tv-sidebar tv-sidebar--detail">
            <div className="tv-sidebar-header">
              <span>{selectedNode.label}</span>
              <button onClick={() => setSelectedNode(null)}>✕</button>
            </div>
            <div className="tv-detail-type" style={{ color: selectedNode.color }}>
              {selectedNode.type}
            </div>
            <div className="tv-detail-meta">
              degree: {selectedNode.degree}
            </div>
            <div className="tv-detail-attrs">
              {Object.entries(selectedNode.attrs)
                .filter(([k]) => k !== "label" && k !== "instagraph:color")
                .map(([k, v]) => (
                  <div key={k} className="tv-attr-row">
                    <span className="tv-attr-key">{k}</span>
                    <span className="tv-attr-val">{String(v)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
