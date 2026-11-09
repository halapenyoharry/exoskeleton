import { useEffect, useMemo, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { Graph, type GraphConfig } from "@cosmos.gl/graph";
import { onPanelMenu } from "../../panel-menu";
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
import type { DetectedGraph } from "../../data/json-utils/graphDetect";
import { useJsonDoc } from "../../data/useJsonDoc";
import { getDocStats, getDetectedGraph } from "../../data/json-utils/docStats";
import { useElementSize } from "../../useElementSize";
import { toCosmos, type CosmosGraphData } from "./toCosmos";
import "./JsonCosmosPanel.css";

export interface JsonCosmosParams {
  documentId: string;
}

export const jsonCosmosDefaults: JsonCosmosParams = {
  documentId: "default",
};

const PANEL_BACKGROUND = "#0a0e26";
const HOVER_RING_COLOR = "#9fb3ff";
const FOCUS_RING_COLOR = "#00e5ff";
const INITIAL_FIT_DELAY_MS = 800;
const MAX_TOOLTIP_ATTRS = 12;
const MAX_TOOLTIP_VALUE_LEN = 80;

interface TooltipState {
  x: number;
  y: number;
  label: string;
  kindOrType: string;
  attrs?: Record<string, unknown>;
}

function formatAttrs(
  attrs: Record<string, unknown> | undefined,
): [string, string][] {
  if (!attrs) return [];
  return Object.entries(attrs)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .slice(0, MAX_TOOLTIP_ATTRS)
    .map(([k, v]) => {
      const val = typeof v === "object" ? JSON.stringify(v) : String(v);
      const truncated =
        val.length > MAX_TOOLTIP_VALUE_LEN
          ? val.slice(0, MAX_TOOLTIP_VALUE_LEN - 3) + "..."
          : val;
      return [k, truncated];
    });
}

export default function JsonCosmosPanel(
  props: IDockviewPanelProps<JsonCosmosParams>,
) {
  const params: JsonCosmosParams = {
    ...jsonCosmosDefaults,
    ...(props.params ?? {}),
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

  const doc = useJsonDoc(props.api, activeDocId);
  const stats = doc === undefined ? null : getDocStats(doc);
  const isGraph = stats?.isGraph ?? false;

  const detectedGraph = useMemo<DetectedGraph | null>(() => {
    if (doc === undefined || !isGraph) return null;
    return getDetectedGraph(doc);
  }, [doc, isGraph]);

  const cosmosData = useMemo<CosmosGraphData | null>(() => {
    if (!detectedGraph) return null;
    return toCosmos(detectedGraph);
  }, [detectedGraph]);

  const [visible, setVisible] = useState(() => props.api.isVisible);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    setVisible(props.api.isVisible);
    const sub = props.api.onDidVisibilityChange((e) => {
      setVisible(e.isVisible);
    });
    return () => sub.dispose();
  }, [props.api]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(containerRef);

  // Latch graph mount once the container has been measured while visible so
  // Dockview detaching inactive tabs (size -> 0x0) pauses instead of churning WebGL.
  const [canMountGraph, setCanMountGraph] = useState(false);
  useEffect(() => {
    if (!isGraph) {
      setCanMountGraph(false);
    } else if (visible && size.width > 0 && size.height > 0) {
      setCanMountGraph(true);
    }
  }, [isGraph, visible, size.width, size.height]);

  const graphRef = useRef<Graph | null>(null);
  const isInitialUploadRef = useRef(true);
  const userPausedRef = useRef(false);
  const wasRunningBeforeHideRef = useRef(false);
  const reheatOnShowRef = useRef(false);
  const fitTimerRef = useRef<number | undefined>(undefined);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const latestRef = useRef({
    detectedGraph,
    cosmosData,
    activeDocId,
    panelId: props.api.id,
    width: size.width,
    height: size.height,
  });
  latestRef.current = {
    detectedGraph,
    cosmosData,
    activeDocId,
    panelId: props.api.id,
    width: size.width,
    height: size.height,
  };

  useEffect(() => {
    setTooltip(null);
  }, [size.width, size.height]);

  // Create one cosmos.gl Graph while a graph document is mounted; destroy on
  // non-graph state or unmount so the WebGL2 context is released.
  useEffect(() => {
    if (!canMountGraph || !containerRef.current) return;

    isInitialUploadRef.current = true;
    userPausedRef.current = false;
    wasRunningBeforeHideRef.current = false;
    reheatOnShowRef.current = false;

    const config: GraphConfig = {
      backgroundColor: PANEL_BACKGROUND,
      showFPSMonitor: false,
      attribution: "",
      fitViewOnInit: true,
      fitViewDelay: INITIAL_FIT_DELAY_MS,
      renderHoveredPointRing: true,
      hoveredPointRingColor: HOVER_RING_COLOR,
      focusedPointRingColor: FOCUS_RING_COLOR,
      onPointMouseOver: (index, pointPosition, event) => {
        const {
          detectedGraph: currentGraph,
          activeDocId: docId,
          panelId,
          width,
          height,
        } = latestRef.current;
        const node = currentGraph?.nodes[index];
        if (!node) return;

        let rawX: number;
        let rawY: number;
        if (
          event &&
          "clientX" in event &&
          typeof event.clientX === "number" &&
          containerRef.current
        ) {
          const rect = containerRef.current.getBoundingClientRect();
          rawX = event.clientX - rect.left;
          rawY = event.clientY - rect.top;
        } else {
          const [sx, sy] =
            graphRef.current?.spaceToScreenPosition(pointPosition) ?? [0, 0];
          rawX = sx;
          rawY = sy;
        }

        const x =
          width > 0
            ? Math.max(8, Math.min(rawX + 12, Math.max(8, width - 260)))
            : rawX + 12;
        const y =
          height > 0
            ? Math.max(8, Math.min(rawY + 12, Math.max(8, height - 140)))
            : rawY + 12;

        const label = node.label || node.id;
        const kindOrType =
          node.type && node.kind && node.kind !== node.type
            ? `${node.type} · ${node.kind}`
            : (node.type ?? node.kind ?? "");

        setTooltip({
          x,
          y,
          label,
          kindOrType,
          attrs: node.attrs,
        });

        if (areGraphsConnected()) {
          broadcastNodeSelection(docId, node.id, panelId, label);
        }
      },
      onPointMouseOut: () => {
        const { activeDocId: docId, panelId } = latestRef.current;
        setTooltip(null);
        if (areGraphsConnected()) {
          broadcastNodeSelection(docId, null, panelId);
        }
      },
      onPointClick: (index) => {
        const {
          detectedGraph: currentGraph,
          activeDocId: docId,
          panelId,
        } = latestRef.current;
        const node = currentGraph?.nodes[index];
        if (!node) return;
        if (areGraphsConnected()) {
          broadcastNodeFocus(docId, node.id, panelId);
        }
      },
      onZoomStart: () => setTooltip(null),
      onDragStart: () => setTooltip(null),
    };

    const graph = new Graph(containerRef.current, config);
    graphRef.current = graph;

    return () => {
      if (fitTimerRef.current !== undefined) {
        window.clearTimeout(fitTimerRef.current);
        fitTimerRef.current = undefined;
      }
      graph.destroy();
      graphRef.current = null;
    };
  }, [canMountGraph]);

  // Upload/rebuild graph buffers whenever the detected graph changes.
  useEffect(() => {
    const graph = graphRef.current;
    if (!canMountGraph || !graph || !cosmosData) return;

    if (fitTimerRef.current !== undefined) {
      window.clearTimeout(fitTimerRef.current);
      fitTimerRef.current = undefined;
    }

    setTooltip(null);
    graph.setConfigPartial({ focusedPointIndex: undefined });
    graph.setPointPositions(cosmosData.positions);
    graph.setPointColors(cosmosData.pointColors);
    graph.setPointSizes(cosmosData.pointSizes);
    graph.setLinks(cosmosData.links);
    graph.setLinkColors(cosmosData.linkColors);

    if (isInitialUploadRef.current) {
      isInitialUploadRef.current = false;
      graph.render();
      if (!visibleRef.current) {
        wasRunningBeforeHideRef.current = true;
        graph.pause();
        graph.setConfigPartial({ enableRenderLoop: false });
      }
      return;
    }

    graph.render(1, 0);
    if (!visibleRef.current) {
      graph.pause();
      if (!userPausedRef.current) {
        reheatOnShowRef.current = true;
      }
      return;
    }

    if (userPausedRef.current) {
      graph.pause();
    } else {
      graph.start(1);
      fitTimerRef.current = window.setTimeout(() => {
        fitTimerRef.current = undefined;
        if (visibleRef.current) {
          graphRef.current?.fitView();
        }
      }, INITIAL_FIT_DELAY_MS);
    }
  }, [canMountGraph, cosmosData]);

  // GPU hygiene: stop simulation and RAF render loop while hidden; resume on show.
  useEffect(() => {
    const graph = graphRef.current;
    if (!canMountGraph || !graph) return;

    if (!visible) {
      setTooltip(null);
      if (fitTimerRef.current !== undefined) {
        window.clearTimeout(fitTimerRef.current);
        fitTimerRef.current = undefined;
      }
      wasRunningBeforeHideRef.current = graph.isSimulationRunning;
      graph.pause();
      graph.setConfigPartial({ enableRenderLoop: false });
      return;
    }

    graph.setConfigPartial({ enableRenderLoop: true });
    if (reheatOnShowRef.current && !userPausedRef.current) {
      reheatOnShowRef.current = false;
      graph.start(1);
      fitTimerRef.current = window.setTimeout(() => {
        fitTimerRef.current = undefined;
        if (visibleRef.current) {
          graphRef.current?.fitView();
        }
      }, INITIAL_FIT_DELAY_MS);
    } else if (wasRunningBeforeHideRef.current && !userPausedRef.current) {
      wasRunningBeforeHideRef.current = false;
      graph.unpause();
    }
  }, [canMountGraph, visible]);

  // Incoming selection / focus broadcasts from sibling panels for the same document.
  useEffect(() => {
    const unsubSelection = onNodeSelectionBroadcast((event) => {
      if (
        !areGraphsConnected() ||
        event.sourcePanelId === props.api.id ||
        event.documentId !== activeDocId
      ) {
        return;
      }
      const graph = graphRef.current;
      if (!graph) return;
      const idx = event.nodeId
        ? latestRef.current.cosmosData?.indexById.get(event.nodeId)
        : undefined;
      graph.setConfigPartial({ focusedPointIndex: idx });
    });

    const unsubFocus = onNodeFocusBroadcast((event) => {
      if (
        !areGraphsConnected() ||
        event.sourcePanelId === props.api.id ||
        event.documentId !== activeDocId
      ) {
        return;
      }
      const graph = graphRef.current;
      if (!graph) return;
      const idx = latestRef.current.cosmosData?.indexById.get(event.nodeId);
      if (idx === undefined) return;
      graph.setConfigPartial({ focusedPointIndex: idx });
      if (visibleRef.current) {
        graph.zoomToPointByIndex(idx, 700, 3, false);
      }
    });

    return () => {
      unsubSelection();
      unsubFocus();
    };
  }, [activeDocId, props.api.id]);

  // Header actions: "fit" fits the view; "pause" toggles the simulation.
  const menuRef = useRef<(id: string) => void>(() => {});
  menuRef.current = (id) => {
    const graph = graphRef.current;
    if (!graph) return;
    if (id === "fit") {
      graph.fitView();
    } else if (id === "pause") {
      if (graph.isSimulationRunning) {
        userPausedRef.current = true;
        graph.pause();
      } else {
        userPausedRef.current = false;
        if (graph.progress >= 1) {
          graph.start(0.5);
        } else {
          graph.unpause();
        }
      }
    }
  };
  useEffect(
    () => onPanelMenu(props.api.id, (id) => menuRef.current(id)),
    [props.api.id],
  );

  const pointCount = cosmosData?.ids.length ?? 0;
  const linkCount = cosmosData ? cosmosData.links.length / 2 : 0;
  const droppedLinks = cosmosData?.droppedLinks ?? 0;

  return (
    <div className="panel-body json-cosmos-body">
      {!isGraph && (
        <div className="json-cosmos-empty">
          {doc === undefined
            ? "Waiting for JSON…"
            : "No graph structure detected in this JSON."}
        </div>
      )}
      {isGraph && <div className="json-cosmos-canvas" ref={containerRef} />}
      {isGraph && cosmosData && (
        <div className="json-cosmos-counts">
          {pointCount.toLocaleString()} points · {linkCount.toLocaleString()}{" "}
          links
          {droppedLinks > 0
            ? ` · ${droppedLinks.toLocaleString()} links dropped`
            : ""}
        </div>
      )}
      {tooltip && isGraph && (
        <div
          className="json-cosmos-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <strong className="json-cosmos-tooltip-title">{tooltip.label}</strong>
          {tooltip.kindOrType && (
            <div className="json-cosmos-tooltip-kind">{tooltip.kindOrType}</div>
          )}
          {formatAttrs(tooltip.attrs).map(([k, v]) => (
            <div key={k} className="json-cosmos-tooltip-row">
              <span className="json-cosmos-tooltip-key">{k}</span>: {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
