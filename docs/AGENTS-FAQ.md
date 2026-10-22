# AGENTS-FAQ

Running log of recurring questions agents hit when refactoring panels into exoskeleton, or when wiring new behaviour into existing panels.

Each entry is shaped like a test case: a concrete situation, the framing trap to avoid, the decision, and the reasoning behind rejected alternatives. If you're an agent reading this for the first time, skim the question headings. If your situation matches one, the reasoning is here — don't re-derive it. If your situation doesn't match an existing entry but feels recurring, add a new entry when you've figured it out.

Newest at the bottom.

---

## Q: How should a panel feed structured data to other panels?

**Date:** 2026-05-19

> **Partly superseded 2026-08-02** — see the last entry in this file. The decision below (the JSON document gets its own holder) still stands and its reasoning is still correct. The *rule* it states — ephemeral-event vs snapshot-state — does not: it is not decidable for real channels, and following it put four coordination channels in json-bus that belonged on OSC. Read the bottom entry for the rule that replaced it.

**Test case:** An editor panel produces a JSON document. One or more visualizer panels render it. They share a window, not a process boundary. (Concrete instance: refactoring `json-visual-viewer` into exoskeleton.)

**Framing trap:** "Cross-panel data flow isn't standardized in exoskeleton — tempo-clock uses OSC, but JSON is too big for OSC messages."

**Why that framing misses:** The OSC bus defaults to in-process JS pub/sub (no serialization, no UDP, no Tauri round-trip) when `osc.bridge.enabled` is false. Wire-format size is irrelevant in-process — the bus dispatches object references, not bytes. The real distinction isn't OSC-vs-something-else, it's:

- **Ephemeral event stream** (OSC pattern): fire-and-forget, late subscribers miss prior events. Fits clock ticks, MIDI notes, knob turns.
- **Snapshot state with subscription** (JSON document pattern): a viewer opened *after* the editor must see the current value on first render, then react to subsequent edits.

These are different semantics. Both belong; conflating them creates bugs (e.g. a viewer mounted late would show a blank canvas under the OSC pattern).

**Decision:** Add a second primitive — [src/data/json-bus.ts](../src/data/json-bus.ts) — alongside the OSC bus. Same vanilla-TS, no-deps aesthetic. Three exports: `getJson(id)`, `setJson(id, value)`, `onJsonChange(id, handler)`. Keyed by document id so multiple documents can coexist. In-process only.

Canonical usage in a viewer panel:

```tsx
const [doc, setDoc] = useState<JsonValue | undefined>(() => getJson("default"));
useEffect(() => onJsonChange("default", setDoc), []);
```

**Rejected alternatives:**

- *Tauri events for in-process panels.* Pure ceremony. The OSC research doc rules this out by analogy: "two panels in the same Dockview don't need to traverse the OS kernel's UDP stack to communicate." Same applies to Tauri events.
- *Dockview panel params.* Params are panel-config (URL bar default, etc.), not cross-panel data. Persisting a large JSON document into params would bloat the state file and load eagerly on every startup. Also creates an implicit ordering dependency (editor must register before viewers can read its params) that fights Dockview's any-order model.
- *Zustand / state library dep.* A ~40-line vanilla-TS module matches exoskeleton's UNIX-pipe aesthetic better than a third-party state library. The OSC bus set the precedent.

**Open hazard:** When a panel opens in a Tauri popout window (`addPopoutGroup`), it's a new React tree with no shared JS heap. The first-cut json-bus does not reach it. Multi-window sync becomes a real problem then; Tauri events are the right answer for that case. Out of scope until popout state-sync is actually needed.

**See also:** [src/osc/index.ts](../src/osc/index.ts) (pattern source), [docs/research/osc-self-contained-by-default.md](research/osc-self-contained-by-default.md) (why in-process-by-default).

---

## Q: Where does this setting / value / data live?

**Date:** 2026-05-19

**Test case:** You're refactoring a panel and you have to put a value *somewhere*. It might be a theme color the user picked. It might be the current text of a JSON document being edited. It might be the panel's tab position. Each of these wants a different home, and the right home isn't obvious until you can name the layers.

**Framing trap:** Exoskeleton has one JSON file on disk and one side-grid panel called "settings," so it's natural to assume there's one kind of state and one place it goes. The README's side-grid section even calls it "where controls live" without disambiguating *which* controls. That framing collapses three distinct categories into one bucket and produces tangled designs.

**The three layers (name them, then act):**

1. **Workspace layout** — what panels currently exist, where they're docked, what each panel currently holds (open file path, webview URL, etc.). This is *exoskeleton's* job, not the built-on-top app's. Lives in `AppState.layout` (a `SerializedDockview` from `api.toJSON()`). Persisted via [src/persistence/](../src/persistence/) to the on-disk JSON file. Survives close+reopen. The user changes it by dragging tabs, opening files, typing URLs — all observed by Dockview's `onDidLayoutChange` and panel `updateParameters` calls. **Conventional access pattern:** never write to this directly from inside a panel; mutate state via Dockview's API (`updateParameters`, `addPanel`, etc.) and the host will persist it.

2. **App-level user preferences** — values that configure the *built-on-top app's* behavior independent of any specific panel. Theme color, default tempo, autosave interval, units (Hz vs ms), what-have-you. Today: the `AppState.preferences` block, currently empty (see [src/persistence/storage.ts:21-25](../src/persistence/storage.ts#L21-L25)). The raw-JSON `SettingsPanel` is the only UI; a friendlier UI is the work item. **Conventional access pattern:** read from `AppState.preferences` at startup and on changes; write via the same persistence layer that handles layout. Same on-disk file today, separated by key. (How and whether to give app-level preferences their own file is an open design question — see [docs/SESSIONS.md](SESSIONS.md) for the eventual decision.)

3. **Cross-panel runtime data** — values that flow between panels at runtime and don't survive a relaunch. Clock ticks, knob positions, the current JSON document being edited and visualized, MIDI notes, transport state. Not persisted; ephemeral by design. Two primitives, picked by semantic shape:
   - **OSC bus** ([src/osc/index.ts](../src/osc/index.ts)) for ephemeral events (fire-and-forget; late subscribers miss prior events).
   - **json-bus** ([src/data/json-bus.ts](../src/data/json-bus.ts)) for snapshot state (late subscribers can call `getJson(id)` for current value, then `onJsonChange(id, handler)` for updates).

**Decision rule:** "Will it survive a relaunch?" If no → layer 3 (OSC or json-bus). If yes → "is it specifically about which panels exist and where they're docked?" If yes → layer 1 (Dockview state). Otherwise → layer 2 (preferences). When in doubt, name the layer out loud before picking the storage; the question usually answers itself once named.

**Anti-patterns to avoid:**

- *Putting runtime data in Dockview panel params.* Params are layer 1 (panel-config that persists with layout). Stuffing a 5MB editor document there bloats the state file and loads it eagerly on startup. Use layer 3 (json-bus).
- *Putting app preferences in Dockview panel params.* "The user's theme" isn't a property of a specific panel; if the user closes the panel that held the theme, they shouldn't lose their theme. Use layer 2.
- *Putting workspace layout in preferences.* Dockview already serializes layout via `toJSON()`; reinventing that as preference keys discards Dockview's structural guarantees.
- *Conflating "settings UI" with "where settings live."* The side-grid SettingsPanel is *one possible UI* for editing layers 1 and 2 (it's literally the raw state file). It's not the storage layer. Future control panels can edit the same data via friendlier UIs without changing what's on disk.

**Open hazard:** Layer 2 is the least developed. The `Preferences` interface is empty; the SettingsPanel is raw JSON. Built-on-top apps that need user preferences today have nowhere structured to put them. A single-file-on-disk pattern dedicated to layer-2 preferences (separate from the workspace state file) is a candidate to resolve this — open for discussion.

**See also:** [README.md](../README.md) (the schema/state split, currently covers layer 1 only), [src/persistence/storage.ts](../src/persistence/storage.ts) (the `AppState` shape), [src/osc/index.ts](../src/osc/index.ts), [src/data/json-bus.ts](../src/data/json-bus.ts).

## Q: My panel consumes json-bus documents. What must it do to stay usable on large documents?

*(Added 2026-07-13 after the 30k-JSON-node freeze: seven viewers + the status bar each re-walked the document synchronously on every debounced keystroke, gates only stopped the final draw, and a persisted "Render anyway" baked a 150k-element SVG build into every launch.)*

Four conventions, all with existing implementations to reuse:

1. **Never count or transform the document yourself — read the shared cache.** [src/data/json-utils/docStats.ts](../src/data/json-utils/docStats.ts) exposes `getDocStats(doc)` (hierarchy node count, graph node/link counts) and `getDetectedGraph(doc)` (the full `DetectedGraph`). Both are WeakMap-cached per document *value*, so the O(N) pass happens once per edit across the whole app and self-invalidates when json-edit publishes a new parse. The status bar and all seven viewers already work this way.

2. **Gate the transform, not just the render.** Compute `perfBlocked` from `getDocStats` *before* your `useMemo` transform, and return your empty model when blocked. A gate that only skips the draw still pays the full O(N) transform + allocation on every change. Template: any viewer, e.g. [JsonCirclesPanel.tsx](../src/panels/json-circles/JsonCirclesPanel.tsx).

3. **"Render anyway" (`bypassPerf`) is session-only `useState`, never a persisted param.** Persisted, one click bakes the huge render into the saved layout and the gate never protects again (this is what froze json-tree on every launch). `nodeThreshold` stays a persisted param; the bypass does not.

4. **Subscribe via `useJsonDoc(props.api, documentId)`** ([src/data/useJsonDoc.ts](../src/data/useJsonDoc.ts)), not raw `getJson`/`onJsonChange`. Dockview keeps inactive tab panels mounted, and the bus fan-out is synchronous — raw subscriptions mean every hidden viewer re-renders (and re-transforms) on every edit. The hook buffers while `api.isVisible` is false and flushes on `onDidVisibilityChange`.

Corollary for anything that rebuilds a scene from a measured size: use [src/useElementSize.ts](../src/useElementSize.ts) (debounced ResizeObserver) and put *destructured primitives* in the rebuild effect's deps, never the whole `params` object (its identity changes every render, so any sibling re-render rebuilds your scene).

**Scale expectations by renderer:** SVG/DOM viewers (tree, circles, mass, graph) are element-bound — thresholds in the hundreds-to-thousands are correct, don't raise them. Canvas (cytoscape) mid-thousands. WebGL (`json-graph3d`) is the designated big-graph surface: threshold 50k, and above ~5k nodes it auto-degrades cosmetics (1px GL lines, no curvature/arrows/particles, shorter cooldown) instead of blocking.

---

## Q: I'm adding a new cross-panel channel. Does it go on OSC, or in json-bus?

**Date:** 2026-08-02

**Supersedes:** the 2026-05-19 entry above ("How should a panel feed structured data to other panels?"). That entry's *decision* still stands — the JSON document has its own holder — but its *rule* does not. It drew the line at ephemeral-event vs snapshot-state, and that line put selection, focus, the active-document id and the graphs-connected flag on the wrong side of it. See [issue #4](https://github.com/halapenyoharry/exoskeleton/issues/4) for the full archaeology.

**Test case:** You have a value one panel produces and others consume. Hover selection, camera focus, which document is active, a toggle, a playhead position, whatever comes next. Two modules look like they could hold it and both have a subscription API.

**Framing trap:** "Is this an event or is this state?" It sounds like the right question. It is not decidable — hover selection is fire-and-forget *and* the status bar needs its current value on mount. Every future channel will have the same double character, and answering by feel is what produced a document primitive quietly carrying four coordination channels.

**The rule — two parts, both required:**

> **If it fits in an OSC arg and is cheap to send, send it as OSC.**
> **If something needs to know the last value, retain the address.**

Part one is mechanically checkable: does it typecheck as `OscArg` ([src/osc/types.ts](../src/osc/types.ts))? int, float, string, blob, time, bool, array, midi, color, nil, inf. There is deliberately no arbitrary-object case.

Part two of part one — *cheap* — is what stops the rule collapsing. A parsed document technically "fits" as `{type:"string", value: JSON.stringify(doc)}`. That is not cheap: it reintroduces serialization on every keystroke, the exact cost in-process dispatch avoids by passing an object reference. State both halves or the rule gets misapplied by the next person who reads only the first.

Retention is then a *separate* question with a separate answer — see below — not a property that decides which module you use.

**Decision:** One bus. `sendOsc`/`subscribeOsc` carry everything that passes the rule; [src/data/json-bus.ts](../src/data/json-bus.ts) holds the one payload that doesn't. Typed facades live in [src/osc/channels/](../src/osc/channels/) so panels keep structs and the positional-arg layout stays in one tested module ([codecs.ts](../src/osc/channels/codecs.ts)).

**Why not a retain flag on the message (MQTT-style):** the OSC wire has no broker to honor it. A "retained" message would work in-process and silently vanish across the UDP bridge — divergent semantics either side of a boundary, which is the worst kind of bug to chase. The retainer is a local cache instead ([src/osc/retainer.ts](../src/osc/retainer.ts)), so `sendOsc` and the bridge are untouched and any process that wants memory keeps its own.

**Three constraints that are not obvious, and are already implemented:**

1. **The retainer is privileged, not an ordinary subscriber.** It updates inside `dispatchLocal` *before* the subscriber loop. If it registered via `subscribeOsc`, dispatch order would decide whether a handler re-reading `getLast()` sees the new value or the previous one.
2. **Retention is opt-in per address pattern, declared at module init.** [src/osc/retained.ts](../src/osc/retained.ts) is the one registration site. A `retain()` call inside a consumer's effect only caches values sent *after* that consumer mounts — strictly worse than the module-level variable it replaced. And a retainer that cached everything would also cache `/exoskeleton/clock/tick` at 24 PPQ.
3. **Bridged channels can feed themselves.** In-process, `sourcePanelId` echo suppression is enough because there is one dispatcher. Over the bridge, any loopback config turns hover-highlight into an unbounded loop. [src/osc/local-sources.ts](../src/osc/local-sources.ts) drops inbound-from-bridge messages whose `sourcePanelId` belongs to a panel in this process. Genuine external senders carry an unknown id (decoded as `"external"`), match no local panel, and dispatch normally.

**Retention decisions so far, and the reasoning shape to copy:**

| Address | Retained | Why |
| --- | --- | --- |
| `/json/{doc}/select` | yes | the status bar renders current selection on mount |
| `/json/{doc}/focus` | **no** | focus is a verb; a panel opened an hour later must not fly its camera |
| `/json/active` | yes | a panel mounting later needs the current document |
| `/json/graphs/connected` | yes | the status bar renders the toggle state on mount |
| `/exoskeleton/clock/*` | **no** | 24 PPQ of churn; a retained tick means nothing |
| `/exoskeleton/piano/*` | **no** | a retained note-on is a stuck note |

Ask "would a panel mounting right now be wrong to not know this?" — not "is this important."

**Rejected alternatives:**

- *Rewriting the graph panels to raw address strings.* The hot paths in the three graph panels have no automated coverage (the test runner is `node --test` over `src/**/*.test.ts` — no `.tsx`, no DOM). Typed facades meant the migration was an import-line change in six panels, and put the logic where tests can reach it. Same wire behaviour, a fraction of the regression surface.
- *Widening `OscArg` with an object case.* It stops being OSC, and that arg would silently fail to cross the bridge — the failure would surface as "works for me, broken for the person with a controller."
- *Leaving it alone because nothing is broken.* Nothing was. But json-bus channels are unreachable from outside the heap **permanently**, and OSC channels are not: the Rust side already emits globally ([src-tauri/src/osc.rs](../src-tauri/src/osc.rs)), so inbound UDP reaches every webview including Tauri popouts. Multi-window sync is a small local-fanout change away for anything on OSC, and impossible for anything not.

**Open hazard:** the retainer is per-heap, so a popout window still starts with no retained state even though it now receives live traffic. Multi-window state-sync remains its own problem; the difference is that it is now solvable.

**See also:** [src/osc/index.ts](../src/osc/index.ts), [src/osc/channels/index.ts](../src/osc/channels/index.ts), [src/data/json-bus.ts](../src/data/json-bus.ts), [docs/research/osc-self-contained-by-default.md](research/osc-self-contained-by-default.md), [issue #4](https://github.com/halapenyoharry/exoskeleton/issues/4).
 
---
 
## Q: What is the status of ~/Projects/exoskeleton-component-library/?
 
**Date:** 2026-09-30
 
**Test case:** An agent or developer considers looking up, editing, installing, or modifying panels in `~/Projects/exoskeleton-component-library/`.
 
**Framing trap:** "There is an exoskeleton repository and an exoskeleton-component-library repository; maybe new or reusable panels belong in the component library."
 
**Decision:** `~/Projects/exoskeleton-component-library/` was **abandoned**. All panel development, refactoring, and integration happens directly inside `exoskeleton` at `src/panels/`. Do not open, edit, or install from the component library. The single source of truth is `/Users/harold/Projects/exoskeleton`.

