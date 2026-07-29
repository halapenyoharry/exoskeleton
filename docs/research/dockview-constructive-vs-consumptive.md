# Dockview group APIs: constructive vs consumptive

**Status:** observation, 2026-05-13. Captured because it tripped us up briefly and the pattern is non-obvious from the docs.

## The asymmetry

Dockview has three APIs that put a group somewhere other than the normal docked grid. They split into two opposite design shapes:

| API | Shape | What you pass in | What you get back |
|---|---|---|---|
| `api.addEdgeGroup(position, options)` | **constructive** | nothing — just a position and config | a new empty group, ready to receive panels |
| `api.addFloatingGroup(item, options)` | **consumptive** | an *existing* panel or group | nothing — the item is relocated into a floating container |
| `api.addPopoutGroup(item, options)` | **consumptive** | an *existing* group | nothing — the group is relocated into a separate OS window |

The verbs are unified ("add"), but the semantics aren't:

- **Edge group**: *create the container first, then fill it.*
- **Floating / popout**: *create the content first, then detach it.*

## Why this matters

You read the docs for `addFloatingGroup` and see:

> `addFloatingGroup only accepts existing panels and groups.`

…and conclude *"oh, I can't make a floating panel from scratch."* That's the wrong takeaway. The correct one is: **make a panel first, then float it.** Two API calls, executed in sequence, give you a floating panel at startup.

```ts
// Floating panel at startup — two lines.
const panel = api.addPanel({
  id: "notes",
  component: "notes",
  title: "notes",
});
api.addFloatingGroup(panel, { x: 100, y: 100, width: 400, height: 300 });
```

The panel exists docked for roughly one frame, then is relocated into a floating container. The user sees only the final state.

## Why Dockview likely chose this design

The constructive vs consumptive split is consistent if you read the API as enforcing a separation between *content creation* and *content placement*:

- `addPanel` is the **one** way to create a panel. Its `position` option controls *where in the grid* the new panel goes (relative to other panels), but the panel always starts in the grid.
- `addFloatingGroup` / `addPopoutGroup` are **location modifiers** — they take content out of the grid and put it somewhere else. They don't create content.
- `addEdgeGroup` is special: edge groups *are* docked (they're part of the layout, just anchored), so creating an empty edge group makes sense in a way that creating an empty floating container doesn't (it'd be invisible).

Once you see the split, the call patterns make sense: edge groups need a *container* before you can fill them; floating/popout groups need *contents* before you can relocate them. The asymmetry isn't a bug.

## Implication for plans / agents installing panels

The `PanelManifest.defaultLayout` field today only specifies an in-grid `position` (direction + reference). To support library panels that *want to be floating by default*, the manifest would need an additional field — something like:

```ts
defaultLayout?:
  | { direction: ...; reference: string }      // docked
  | { floating: { x, y, width, height } }      // floating
  | { popout: { width, height } }              // OS-window popout
```

…and the install protocol would learn to: addPanel first, then `addFloatingGroup(panel, ...)` if floating is declared. Not needed today, but worth knowing when a panel asks to float.

## See also

- [Dockview 6.0 release notes](https://dockview.dev) — introduced edge groups. (Previously a local copy lived at `docs/dockview/whatsnew.md`; removed 2026-07-29 as an unattributed mirror of Dockview's own docs site — see `local/dockview/` if you kept a copy.)
- [src/HeaderActions.tsx](../../src/HeaderActions.tsx) — current popout button uses the consumptive pattern: `containerApi.addPopoutGroup(props.group)`.
- [src/App.tsx](../../src/App.tsx) — current Cmd+B handler uses the constructive pattern for edge groups: `api.addEdgeGroup(...)` then `api.addPanel({ ..., position: { referenceGroup: edge.id }})`.
