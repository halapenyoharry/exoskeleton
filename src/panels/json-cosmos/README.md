# json-cosmos

## What it is

A GPU force-graph viewer built on [`@cosmos.gl/graph`](https://github.com/cosmosgl/graph) 3.5.1 (the WebGL2 engine underneath Cosmograph). Both the many-body/link force simulation and the point/link drawing run on the GPU via `@luma.gl/*` 9.3.6, so graphs with tens of thousands of nodes stay interactive without a node-count gate. It reads graph-shaped JSON from the `json-bus` alongside `json-graph`, `json-cytoscape`, and `json-graph3d`, and participates in connected selection and focus broadcasts.

## Labels

cosmos.gl draws points and links on WebGL shaders without built-in text labels. Node labels, `type`/`kind`, and up to 12 attributes appear in the hover tooltip for now.

## Colors and sizes

The shared graph detector keeps only id, label, kind, attrs and the raw node, so `toCosmos.ts` reads those. A point's color is its own hex `color` (on the node, its attrs or the raw object); otherwise its category goes through the shared layer palette (`colorForLayer`), in this order: `attrs["i2t:kind"]`, `type`, `group`, then kind. This is the same order 3D-Inspect uses. Size is a positive `size` if the node has one, else 4 (2 for hyperedge and edge-as-node points).

## Known layout behavior

Points can pile up in a ring at the edge of cosmos.gl's simulation space (its default `spaceSize`) on large graphs. Sparse random graphs settle into an even disk; that is the data, not a stall: graphs with real groups separate within seconds (checked 2026-11-09 with 250 dense groups of 200 nodes on an M2 Max).

## cosmos.gl API used

The panel constructs one `new Graph(div, config)` with `backgroundColor`, `showFPSMonitor: false`, `attribution: ""`, `fitViewOnInit: true`, `fitViewDelay`, `renderHoveredPointRing`, `hoveredPointRingColor`, `focusedPointRingColor`, and the pointer/zoom/drag callbacks (`onPointMouseOver`, `onPointMouseOut`, `onPointClick`, `onZoomStart`, `onDragStart`). Graph buffers from `toCosmos.ts` upload through `setPointPositions`, `setPointColors`, `setPointSizes`, `setLinks`, `setLinkColors`, and `render`. Header actions and sibling broadcasts use `fitView`, `pause`, `unpause`, `start`, `isSimulationRunning`, `progress`, `spaceToScreenPosition`, `setConfigPartial` (`focusedPointIndex`, `enableRenderLoop`), and `zoomToPointByIndex`.

## Hide and destroy behavior

Dockview keeps inactive tabs mounted while hidden (`props.api.isVisible === false`). Subscribing to `props.api.onDidVisibilityChange`, the panel calls `graph.pause()` and `graph.setConfigPartial({ enableRenderLoop: false })` on hide so both the GPU simulation and the `requestAnimationFrame` render loop stop completely, and restores `enableRenderLoop: true` (plus `unpause()` or `start()` if the simulation was active) when shown again. A background tab that has never been shown delays creating `Graph` until first visible. When the document is not a graph or the panel unmounts, `graph.destroy()` runs to release the WebGL2 context and GPU buffers.

## Browser limits

Per cosmos.gl's README: iOS 15.4 broke the `EXT_float_blend` WebGL extension that cosmos.gl's GPU many-body force depends on, though cosmos.gl's README notes the latest iOS versions work again; Android devices that lack `OES_texture_float` do not work.

## License

`@cosmos.gl/graph` and `@luma.gl/*` are MIT-licensed. (Do not confuse `@cosmos.gl/graph` with the older `@cosmograph/cosmos` package, which uses a non-commercial license.)
