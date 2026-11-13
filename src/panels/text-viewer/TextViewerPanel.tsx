import { useEffect, useState, useMemo, useRef } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { useJsonDoc } from "../../data/useJsonDoc";
import {
  buildNodeBlocks,
  shouldFollowNodeBroadcast,
  shouldScrollOnBroadcast,
  type NodeBroadcastChannel,
} from "./nodeBlocks";
import ReactMarkdown from "react-markdown";
import {
  broadcastNodeSelection,
  broadcastNodeFocus,
  onNodeSelectionBroadcast,
  onNodeFocusBroadcast,
  getActiveDocumentId,
  areGraphsConnected,
  onActiveDocumentIdChange,
  onGraphsConnectionChange,
} from "../../osc/channels";
import "./TextViewerPanel.css";

export interface TextViewerParams {
  documentId: string;
  scrollOnHover: boolean;
}

export const textViewerDefaults: TextViewerParams = {
  documentId: "default",
  scrollOnHover: true,
};

export default function TextViewerPanel(props: IDockviewPanelProps<TextViewerParams>) {
  const params: TextViewerParams = {
    ...textViewerDefaults,
    ...(props.params ?? {}),
  };
  const paramDocId = params.documentId;
  const [documentId, setDocumentId] = useState(paramDocId);
  const [connected, setConnected] = useState(areGraphsConnected());

  // Reflect the default in the pane when the panel was created without scrollOnHover in params.
  useEffect(() => {
    if (props.params?.scrollOnHover === undefined) {
      props.api.updateParameters({ scrollOnHover: textViewerDefaults.scrollOnHover });
    }
  }, [props.api, props.params?.scrollOnHover]);

  useEffect(() => onGraphsConnectionChange(setConnected), []);

  useEffect(() => {
    if (!connected) {
      setDocumentId(paramDocId);
      return;
    }
    setDocumentId(getActiveDocumentId());
    return onActiveDocumentIdChange((id) => setDocumentId(id));
  }, [connected, paramDocId]);

  const jsonDoc = useJsonDoc(props.api, documentId);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Listen to cross-panel sync events
  useEffect(() => {
    const handleNodeEvent = (channel: NodeBroadcastChannel, nodeId: string | null) => {
      if (!areGraphsConnected() || getActiveDocumentId() !== documentId) return;
      if (!shouldFollowNodeBroadcast(channel, params.scrollOnHover)) return;
      setSelectedNodeId(nodeId);
      
      if (shouldScrollOnBroadcast(channel, nodeId, params.scrollOnHover) && nodeId) {
        const el = nodeRefs.current.get(nodeId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    };

    const unsubSelect = onNodeSelectionBroadcast((e) => {
      if (e.sourcePanelId === props.api.id) return;
      handleNodeEvent("selection", e.nodeId);
    });
    const unsubFocus = onNodeFocusBroadcast((e) => {
      if (e.sourcePanelId === props.api.id) return;
      handleNodeEvent("focus", e.nodeId);
    });

    return () => {
      unsubSelect();
      unsubFocus();
    };
  }, [documentId, props.api.id, params.scrollOnHover]);

  const handleNodeClick = (nodeId: string, label: string) => {
    setSelectedNodeId(nodeId);
    if (!areGraphsConnected() || getActiveDocumentId() !== documentId) return;
    broadcastNodeSelection(documentId, nodeId, props.api.id, label);
    broadcastNodeFocus(documentId, nodeId, props.api.id);
  };

  // Prepare all nodes text blocks in sequence
  const nodeBlocks = useMemo(() => buildNodeBlocks(jsonDoc), [jsonDoc]);

  return (
    <div className="text-viewer-container">
      <div className="text-viewer-body">
        {nodeBlocks.length === 0 ? (
          <div className="text-viewer-empty">No nodes found in graph.</div>
        ) : (
          <div className="text-viewer-flow">
            {nodeBlocks.map(block => {
              const isSelected = selectedNodeId === block.id;
              let className = "text-viewer-block";
              if (isSelected) className += " selected";

              const blockStyle: React.CSSProperties = isSelected && block.color 
                ? { borderColor: block.color as string, boxShadow: `0 0 10px ${block.color}40` } 
                : {};
              const titleStyle: React.CSSProperties = block.color ? { color: block.color as string } : {};

              return (
                <div 
                  key={block.id}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(block.id, el);
                    else nodeRefs.current.delete(block.id);
                  }}
                  className={className}
                  style={blockStyle}
                  onClick={() => handleNodeClick(block.id, String(block.title))}
                >
                  <h3 className="text-viewer-block-title" style={titleStyle}>{String(block.title)}</h3>
                  {block.content && (
                    <div className="text-viewer-block-content">
                      <ReactMarkdown>{block.content}</ReactMarkdown>
                    </div>
                  )}
                  <div className="text-viewer-block-attrs">
                    <span className="text-viewer-pill">id: {block.id}</span>
                    {Object.entries(block.allAttrs).map(([k, v]) => {
                      if (['text', 'description', 'content', 'detail', 'theme', 'narrative_arc'].includes(k) && block.content) return null;
                      return (
                        <span key={k} className="text-viewer-pill">{k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
