# Generic Patch Bay (Directed Graph) Architecture

This repository contains the logic and implementation for a generic patch bay interface. The system maps a set of "Source" data to a set of "Target" parameters and outputs the structural relationships as a JSON array.

## 1. Data Architecture

The system relies on strict separation between the entities (the nodes) and their relationships (the edges).

### Input JSON 1: Sources (`sources.json`)

This defines the data originating on the left side of the graph.

```
[
  { "id": "src_01", "label": "Source Data A", "value": 100 },
  { "id": "src_02", "label": "Source Data B", "value": 200 }
]
```

### Input JSON 2: Targets (`targets.json`)

This defines the destination parameters on the right side of the graph.

```
[
  { "id": "tgt_01", "label": "Parameter X" },
  { "id": "tgt_02", "label": "Parameter Y" }
]
```

### Output JSON: The Graph State

The interface strictly manages the *connections* between the inputs. The output is an array of edges. It does not duplicate the source or target data; it only records their unique IDs.

```
{
  "edges": [
    { "id": "edge_src_01_tgt_01", "source_id": "src_01", "target_id": "tgt_01" }
  ]
}
```

## 2. Geometric Interface Logic

To render physical lines between HTML elements, the interface utilizes an SVG (Scalable Vector Graphics) layer positioned directly on top of the HTML nodes.

1. **State:** The interface tracks an array of `edges`.

2. **Interaction:** The user clicks a Source Port (initiating a connection) and then clicks a Target Port (completing the connection).

3. **Calculation:** The code calculates the exact X and Y coordinates of the selected Source Port and Target Port relative to the parent container.

4. **Rendering:** It draws an SVG `<line>` between those specific coordinates.

## 3. React Implementation

This component implements a click-to-connect routing system. It accepts the two JSON arrays as props and renders the physical graph and the real-time JSON output.

```
import React, { useState, useRef, useEffect } from 'react';

// Default generic data if none is provided
const defaultSources = [
  { id: 's1', label: 'Raw Source 1' },
  { id: 's2', label: 'Raw Source 2' },
  { id: 's3', label: 'Raw Source 3' }
];

const defaultTargets = [
  { id: 't1', label: 'Target Parameter A' },
  { id: 't2', label: 'Target Parameter B' },
  { id: 't3', label: 'Target Parameter C' }
];

export default function GenericPatchBay({ sources = defaultSources, targets = defaultTargets }) {
  const [edges, setEdges] = useState([]);
  const [activeSource, setActiveSource] = useState(null);
  const [portCoords, setPortCoords] = useState({});
  const containerRef = useRef(null);

  // Calculate X/Y coordinates of all ports to draw SVG lines accurately
  const updateCoordinates = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newCoords = {};

    // Select all elements marked as ports
    const portElements = containerRef.current.querySelectorAll('.graph-port');
    portElements.forEach(port => {
      const rect = port.getBoundingClientRect();
      // Calculate exact center of the port relative to the container
      newCoords[port.dataset.nodeId] = {
        x: rect.left - containerRect.left + (rect.width / 2),
        y: rect.top - containerRect.top + (rect.height / 2)
      };
    });

    setPortCoords(newCoords);
  };

  // Recalculate coordinates on mount and window resize
  useEffect(() => {
    updateCoordinates();
    window.addEventListener('resize', updateCoordinates);
    return () => window.removeEventListener('resize', updateCoordinates);
  }, [sources, targets]);

  const handleSourceClick = (sourceId) => {
    setActiveSource(sourceId);
  };

  const handleTargetClick = (targetId) => {
    if (!activeSource) return; // Must select source first

    // Prevent duplicate exact connections
    const edgeExists = edges.some(e => e.source_id === activeSource && e.target_id === targetId);

    if (!edgeExists) {
      const newEdge = {
        id: `edge_${activeSource}_${targetId}`,
        source_id: activeSource,
        target_id: targetId
      };
      setEdges([...edges, newEdge]);
    }

    setActiveSource(null); // Reset active source after connection
  };

  const removeEdge = (edgeId) => {
    setEdges(edges.filter(e => e.id !== edgeId));
  };

  return (
    <div style={{ fontFamily: 'monospace', padding: '20px', maxWidth: '800px' }}>

      {/* GRAPH AREA */}
      <div 
        ref={containerRef} 
        style={{ 
          position: 'relative', 
          display: 'flex', 
          justifyContent: 'space-between',
          border: '1px solid #ccc',
          padding: '40px',
          minHeight: '300px',
          backgroundColor: '#f9f9f9'
        }}
      >
        {/* SVG Layer for rendering lines */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {edges.map(edge => {
            const start = portCoords[edge.source_id];
            const end = portCoords[edge.target_id];
            if (!start || !end) return null;

            return (
              <line 
                key={edge.id}
                x1={start.x} y1={start.y} 
                x2={end.x} y2={end.y} 
                stroke="#333" 
                strokeWidth="2"
              />
            );
          })}
        </svg>

        {/* Sources Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 1 }}>
          {sources.map(src => (
            <div key={src.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ padding: '10px', border: '1px solid #999', backgroundColor: '#fff' }}>
                {src.label}
              </div>
              <div 
                className="graph-port"
                data-node-id={src.id}
                onClick={() => handleSourceClick(src.id)}
                style={{
                  width: '15px', height: '15px', borderRadius: '50%',
                  backgroundColor: activeSource === src.id ? '#007acc' : '#666',
                  cursor: 'pointer', marginLeft: '-8px'
                }}
              />
            </div>
          ))}
        </div>

        {/* Targets Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 1 }}>
          {targets.map(tgt => (
            <div key={tgt.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div 
                className="graph-port"
                data-node-id={tgt.id}
                onClick={() => handleTargetClick(tgt.id)}
                style={{
                  width: '15px', height: '15px', borderRadius: '50%',
                  backgroundColor: '#666',
                  cursor: activeSource ? 'crosshair' : 'default', marginRight: '-8px'
                }}
              />
              <div style={{ padding: '10px', border: '1px solid #999', backgroundColor: '#fff' }}>
                {tgt.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* JSON OUTPUT AREA */}
      <div style={{ marginTop: '20px' }}>
        <h3>Resulting JSON State</h3>
        <button onClick={() => setEdges([])} style={{ marginBottom: '10px' }}>Clear All Edges</button>
        <pre style={{ backgroundColor: '#222', color: '#0f0', padding: '15px', overflowX: 'auto' }}>
          {JSON.stringify({ edges }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
```
