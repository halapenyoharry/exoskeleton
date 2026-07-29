# Cross-panel graph synchronization

Exoskeleton runs several graph layouts of the same JSON document at once —
the 2D d3 force graph, the Cytoscape/fcose layout, and the Three.js 3D force
graph — and keeps them synchronized by **identity rather than position**.
This document is the technical contract and the reasoning behind it.

## Why identity, not position

Graph drawing aesthetics — minimize edge crossings, preserve symmetry, keep
clusters tight, respect edge-length uniformity — are mutually unsatisfiable.
Any single embedding is a decision about what to destroy, made by a solver,
usually invisibly, and usually once. Most graph software picks one layout and
commits.

The same problem is already acknowledged in dimensionality reduction, where
running multiple seeds and perplexity or `n_neighbors` settings is standard
practice precisely because no single projection can be trusted on its own.
Neighborhood structure in a t-SNE or UMAP embedding is partly a fact about the
data and partly a fact about the run. The accepted response there isn't to
find *the* correct projection — it's to look at several and treat features
that survive as more credible than features that don't. Exoskeleton applies
that same discipline to graph layout, in the interface rather than a batch
script.

Existing multi-view and coordinated-view systems generally add views for
**task diversity**: an overview beside a detail pane, one attribute per panel,
several abstraction levels for several users, connected by brushing-and-
linking. The premise there is that the analyst already knows what they're
looking for and needs different instruments trained on it.

Exoskeleton starts from a different premise: the correct structure of a body
of information isn't known in advance. Running incompatible layouts side by
side makes their *disagreement* available as evidence. A node with three
different neighborhoods across three embeddings is a finding about the
ambiguity of its position, not a rendering artifact to be smoothed away — and
that's only legible if each layout keeps its own embedding fully intact.
Nothing is warped into a shared coordinate frame, projected onto a reference
layout, or Procrustes-aligned. The views are independent estimates kept in
correspondence by name, which is the condition under which their disagreement
is interpretable at all. Align them and the signal you were trying to read is
exactly what gets destroyed.

## The contract

Synchronization is identity-only. Two event kinds cross panel boundaries:

| Event | Trigger | Payload | Effect |
| --- | --- | --- | --- |
| selection | hover a node | `documentId`, `nodeId \| null`, `sourcePanelId`, `label?` | highlight in every peer; status bar shows the label |
| focus | click / tap a node | `documentId`, `nodeId`, `sourcePanelId` | each peer animates its own camera to that node |

No coordinates, no camera state, no layout parameters cross the boundary.
`sourcePanelId` suppresses echo back to the originator. `documentId` scopes
the event, so multiple documents can be open with independent viewer sets. A
global connected/decoupled flag (`setGraphsConnected` in
[src/data/json-bus.ts](../src/data/json-bus.ts)) lets a panel be pulled out of
sync entirely.

Adding a new layout engine means subscribing to these two events and
resolving a node id in your own space. No existing panel changes, and no view
is the master.

### Transit, not teleport

Cameras animate rather than cut: a ~500ms zoom transition in the 2D d3 panel
([JsonGraphPanel.tsx](../src/panels/json-graph/JsonGraphPanel.tsx)), a
~1000ms camera interpolation in the 3D force panel
([JsonGraph3DPanel.tsx](../src/panels/json-graph3d/JsonGraph3DPanel.tsx)), and
a tweened pan/zoom in the Cytoscape panel
([JsonCytoscapePanel.tsx](../src/panels/json-cytoscape/JsonCytoscapePanel.tsx)).

This is load-bearing, not decorative. Continuous transit preserves the
viewer's model of the layout, so each panel becomes something learned across
many selections rather than re-encountered on every click. Cut instead of
animating and three layouts produce three unrelated pictures with no way to
hold them as one thing.

## About the two buses

Exoskeleton has two in-process buses, and the distinction is deliberate:

| | [`src/osc/`](../src/osc/) | [`src/data/json-bus.ts`](../src/data/json-bus.ts) |
| --- | --- | --- |
| Semantics | ephemeral events, OSC address-pattern matched | retained last-value, keyed by document id |
| Late subscriber | misses prior messages | reads current value on mount |
| Escape hatch | opt-in UDP bridge | in-process only |
| Carries today | tempo-clock, piano, scope | the JSON document; graph selection and focus |

Document state genuinely needs retention — a viewer that mounts after the
editor already holds content must see that content, which an event stream
can't provide. That's why json-bus exists, and why graph selection and focus
currently live there rather than on the OSC bus.

The OSC side is the architecturally unusual part: OSC is used as a **naming
and dispatch discipline rather than a wire protocol**. `sendOsc` dispatches
directly to matching subscribers in the same heap; nothing is serialized
unless the bridge flag is set. The address grammar and type semantics do the
work, and UDP is an accessory. The consequence is that every panel on that bus
is externally addressable by construction — enable the bridge and tempo-clock
is drivable from TouchOSC or Sonic Pi with no adapter written, because the
addresses the app speaks to itself in *are* the public surface. The usual
pattern is the inverse: a bespoke internal emitter plus an OSC export layer
bolted on later, covering only what someone remembered to expose, drifting as
internals change. Here it can't drift, because there's only one surface.

The closest prior art is SuperCollider, where `sclang` and `scsynth` speak OSC
over loopback — but that's two processes with OSC as actual IPC. One process,
one heap, OSC as pure convention with transport optional, is a different
thing.

An identity-keyed event also carries no commitment to being displayed. Any
subscriber can consume graph structure — a renderer, a sound engine, a
physical simulation. The dataflow-patcher tradition established that anything
can drive anything; pointing that same bus at a semantic graph rather than
raw audio/MIDI is the specific move here.

## Claim status

Selection and focus are event-shaped — ephemeral, fire-and-forget, carrying
`sourcePanelId` purely to suppress echo — so architecturally they *could*
move to the OSC bus (`/json/{doc}/select`, `/json/{doc}/focus`) and become
externally drivable, the same way tempo-clock already is. **That move hasn't
happened yet.** Until it does, "any subscriber can drive selection" is a
property of the architecture, not of shipped behavior — the table below is
the honest line between the two.

| Claim | Status |
| --- | --- |
| Three layouts synced by identity, not position | **True** — 2D d3 force, Cytoscape/fcose, 3D force |
| Hover highlights peers; click flies peer cameras | **True** |
| Cameras animate rather than cut | **True** — 500ms / 1000ms / tweened |
| No positional data crosses panels | **True** |
| Panels can be decoupled from sync | **True** — global connected flag |
| Multiple documents with independent viewer sets | **True** — events scoped by `documentId` |
| Selection travels as an OSC message | **Not yet** — travels on json-bus |
| A synth or actuator can subscribe to selection today | **Not yet** — architecturally supported, not wired |
| OSC bus exists, in-process by default, opt-in UDP bridge | **True** — used by tempo-clock, piano, scope |
| Seven JSON viewers exist | **True**, but only the three graph panels (graph, cytoscape, graph3d) participate in identity sync |
