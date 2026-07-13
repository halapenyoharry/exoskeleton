import { useEffect, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import {
  areGraphsConnected,
  setGraphsConnected,
  onGraphsConnectionChange,
  getActiveDocumentId,
  onActiveDocumentIdChange,
  getJson,
  onJsonChange,
  getSelectedNode,
  onNodeSelectionBroadcast,
} from "../data/json-bus";
import { getDocStats } from "../data/json-utils/docStats";
import "./StatusBarPanel.css";

export default function StatusBarPanel(props: IDockviewPanelProps) {
  const [connected, setConnected] = useState(areGraphsConnected());
  const [selectedNode, setSelectedNode] = useState(getSelectedNode());
  const [activeDocId, setActiveDocId] = useState(getActiveDocumentId());
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  // 1. Connection toggle subscription
  useEffect(() => {
    return onGraphsConnectionChange(setConnected);
  }, []);

  // 2. Selection broadcast subscription
  useEffect(() => {
    return onNodeSelectionBroadcast((event) => {
      setSelectedNode({ nodeId: event.nodeId, label: event.label });
    });
  }, []);

  // 3. Stats and active document ID subscription
  useEffect(() => {
    const updateStats = (id: string) => {
      const doc = getJson(id);
      if (doc) {
        // Cached per document version (docStats WeakMap) — a cache read
        // on every call after the first, instead of the full detectGraph
        // array build this used to run per debounced keystroke.
        const s = getDocStats(doc);
        if (s.isGraph) {
          setStats({ nodes: s.graphNodeCount, edges: s.graphLinkCount });
          return;
        }
      }
      setStats({ nodes: 0, edges: 0 });
    };

    updateStats(activeDocId);

    const unsubActive = onActiveDocumentIdChange((id) => {
      setActiveDocId(id);
      updateStats(id);
    });

    const unsubJson = onJsonChange(activeDocId, () => {
      updateStats(activeDocId);
    });

    return () => {
      unsubActive();
      unsubJson();
    };
  }, [activeDocId]);

  const toggleConnection = () => {
    setGraphsConnected(!connected);
  };

  const handleClose = () => {
    if (props.api) {
      props.api.close();
    }
  };

  return (
    <div className="status-bar-container">
      <div className="status-bar-left">
        <button
          className={`status-bar-link-btn ${connected ? "connected" : "decoupled"}`}
          onClick={toggleConnection}
          title={connected ? "Click to decouple views" : "Click to coordinate views"}
        >
          <span className="status-indicator-dot" />
          {connected ? "COORDINATED LINK ACTIVE" : "LINK DECOUPLED"}
        </button>
        <span className="status-doc-badge" title="Active Editor Target">
          DOC: {activeDocId}
        </span>
      </div>

      <div className="status-bar-center">
        <div className="status-selection">
          <span className="status-selection-label">Selected Node:</span>
          <span className="status-selection-value">
            {selectedNode.nodeId ? (selectedNode.label || selectedNode.nodeId) : "No Selection"}
          </span>
        </div>
      </div>

      <div className="status-bar-right">
        <div className="status-stats">
          <span>Nodes:</span>
          <span className="status-stats-val">{stats.nodes}</span>
          <span className="status-stats-divider">|</span>
          <span>Edges:</span>
          <span className="status-stats-val">{stats.edges}</span>
        </div>
        <button
          className="status-bar-close-btn"
          onClick={handleClose}
          title="Minimize Status Bar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
