# AGENTS-FAQ

Running log of recurring questions agents hit when refactoring panels into exoskeleton, or when wiring new behaviour into existing panels.

Each entry is shaped like a test case: a concrete situation, the framing trap to avoid, the decision, and the reasoning behind rejected alternatives. If you're an agent reading this for the first time, skim the question headings. If your situation matches one, the reasoning is here — don't re-derive it. If your situation doesn't match an existing entry but feels recurring, add a new entry when you've figured it out.

Newest at the bottom.

---

## Q: How should a panel feed structured data to other panels?

**Date:** 2026-05-19

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
