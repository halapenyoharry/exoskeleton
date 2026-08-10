import { useEffect, useState, useMemo, useRef } from "react";
import type { IDockviewPanelProps } from "dockview";
import { useJsonDoc } from "../../data/useJsonDoc";
import { getDetectedGraph } from "../../data/json-utils/docStats";
import ReactMarkdown from "react-markdown";
import {
  broadcastNodeSelection,
  broadcastNodeFocus,
  onNodeSelectionBroadcast,
  onNodeFocusBroadcast,
  getActiveDocumentId,
  areGraphsConnected,
} from "../../osc/channels";
import "./TextViewerPanel.css";

export interface TextViewerParams {
  documentId: string;
}

export default function TextViewerPanel(props: IDockviewPanelProps<TextViewerParams>) {
  const documentId = props.params?.documentId ?? "default";
  const jsonDoc = useJsonDoc(props.api, documentId);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const graph = useMemo(() => {
    if (!jsonDoc) return null;
    return getDetectedGraph(jsonDoc);
  }, [jsonDoc]);

  // Listen to cross-panel sync events
  useEffect(() => {
    const handleNodeEvent = (nodeId: string | null) => {
      if (!areGraphsConnected() || getActiveDocumentId() !== documentId) return;
      setSelectedNodeId(nodeId);
      
      if (nodeId) {
        const el = nodeRefs.current.get(nodeId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    };

    const unsubSelect = onNodeSelectionBroadcast((e) => {
      if (e.sourcePanelId === props.api.id) return;
      handleNodeEvent(e.nodeId);
    });
    const unsubFocus = onNodeFocusBroadcast((e) => {
      if (e.sourcePanelId === props.api.id) return;
      handleNodeEvent(e.nodeId);
    });

    return () => {
      unsubSelect();
      unsubFocus();
    };
  }, [documentId, props.api.id]);

  const handleNodeClick = (nodeId: string, label: string) => {
    setSelectedNodeId(nodeId);
    if (!areGraphsConnected() || getActiveDocumentId() !== documentId) return;
    broadcastNodeSelection(documentId, nodeId, props.api.id, label);
    broadcastNodeFocus(documentId, nodeId, props.api.id);
  };

  // Prepare all nodes text blocks in sequence
  const nodeBlocks = useMemo(() => {
    if (!graph) return [];
    
    // The natural array order acts as the sequence
    return graph.nodes.map(node => {
      const attrs = node.attrs || {};
      const text = attrs.text || attrs.description || attrs.content || attrs.detail || attrs.theme || attrs.narrative_arc;
      
      return {
        id: node.id,
        title: node.label || node.id,
        content: text ? (typeof text === "string" ? text : JSON.stringify(text)) : null,
        allAttrs: attrs
      };
    });
  }, [graph]);

  return (
    <div className="text-viewer-container">
      <div className="text-viewer-header">
        <span>node-text-flow</span>
      </div>
      <div className="text-viewer-body">
        {nodeBlocks.length === 0 ? (
          <div className="text-viewer-empty">No nodes found in graph.</div>
        ) : (
          <div className="text-viewer-flow">
            {nodeBlocks.map(block => {
              const isSelected = selectedNodeId === block.id;
              let className = "text-viewer-block";
              if (isSelected) className += " selected";

              return (
                <div 
                  key={block.id}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(block.id, el);
                    else nodeRefs.current.delete(block.id);
                  }}
                  className={className}
                  onClick={() => handleNodeClick(block.id, block.title)}
                >
                  <h3 className="text-viewer-block-title">{block.title}</h3>
                  {block.content && (
                    <div className="text-viewer-block-content">
                      <ReactMarkdown>{block.content}</ReactMarkdown>
                    </div>
                  )}
                  {!block.content && (
                     <div className="text-viewer-block-attrs">
                       {Object.entries(block.allAttrs).slice(0, 3).map(([k, v]) => (
                         <span key={k} className="text-viewer-pill">{k}: {String(v)}</span>
                       ))}
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
