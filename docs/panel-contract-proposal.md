# Panel Contract Proposal — Host-Owned Wrapping

**Status:** accepted, implemented 2026-05-12
**Scope:** Exoskeleton + the panel library at `~/Projects/exoskeleton-componant-library`
**Origin:** discussion 2026-05-12 about whether the two repos should remain separate, and what their shared contract should actually be

**Implementation notes (post-acceptance):**

- `PanelRoot` and `exoPanel` live in [`src/PanelRoot.tsx`](../src/PanelRoot.tsx) (not `src/panel/` — flat under src/ for symmetry with `panel-manifest.ts`).
- Q1 (className support on `PanelRoot`) accepted up-front rather than deferred — cheap, prevents downstream churn.
- Library-side migration done in the same pass: `~/Projects/exoskeleton-componant-library/panels/TopoViewerPanel.{tsx,css}` updated; the library README's "Anatomy" section rewritten.
- Library panels keep their *internal* accent var (e.g. `--accent-topoviewer` declared in the library's `:root`) for self-sufficiency. The *stripe* accent flows through `--panel-accent` from `exoPanel`. Two layers, one for portability, one for the stripe.

## Summary

Today, every Exoskeleton panel hand-writes `className="panel-pad panel-pad--<role>"` on its root element, and the host CSS defines a `.panel-pad--<role>` rule per role to paint the accent stripe. This convention is a string coupling between the panel and the host. It also extends across the repo boundary: the library's `TopoViewerPanel.css` defines `.panel-pad--topoviewer` to participate in the same convention.

This proposal replaces that convention with a single component owned by Exoskeleton: `PanelRoot`, plus a higher-order helper `exoPanel(Component, accent)` used in the `App.tsx` manifest. Panels become pure React components with no `.panel-pad` knowledge; Exoskeleton wraps each panel at registration time, supplying its accent as a CSS-variable prop. Net result: ~50 lines of code change, the cross-repo CSS coupling is eliminated, and library panels become portable to any Dockview app (not only Exoskeleton-derived ones).

## 1. The contract today

Reading the current code in [src/panels/](../src/panels/) and [exoskeleton-componant-library/panels/](../../exoskeleton-componant-library/panels/), the "Exoskeleton panel contract" is made of four obligations on the panel author:

| Obligation | How it's expressed | Where it lives |
| --- | --- | --- |
| Fill the Dockview content container without escaping it | `className="panel-pad"` on the root div | host CSS at [src/App.css:45-58](../src/App.css#L45-L58) |
| Paint the accent stripe in this panel's color | `className="panel-pad panel-pad--<role>"` + a per-role rule | host CSS at [src/App.css:86-88](../src/App.css#L86-L88), one rule per panel |
| Receive Dockview's props bag | `IDockviewPanelProps<P>` from `dockview` | TypeScript-enforced *if* the panel imports the type, *not enforced* if the panel takes no props |
| Persist via panel params | `props.params` / `props.api.updateParameters({...})` | Dockview API; documented in [src/panels/LanWebview.tsx:11-24](../src/panels/LanWebview.tsx#L11-L24) but used by only one panel today |

Of these, the first two are 95% of what panel authors actually have to remember. The third and fourth are sufficiently documented by Dockview itself and by Exoskeleton's existing README.

## 2. Problem

Two problems with the current expression of the first two obligations:

**Problem A — string coupling.** The class name `panel-pad` and the variant pattern `panel-pad--<role>` are strings the panel author must type correctly. A typo silently produces an unaccented panel. The host CSS file has no way to know which panel role names exist; it just hosts a fixed list of rules for the roles that happened to be hardcoded when the file was written.

**Problem B — cross-repo CSS drift.** The library's [`TopoViewerPanel.css:5`](../../exoskeleton-componant-library/panels/TopoViewerPanel.css#L5) defines `.panel-pad--topoviewer { --panel-accent: var(--accent-topoviewer); }`. This rule only works if (a) the host page already defines the `--accent-topoviewer` CSS variable and (b) the host already includes the `.panel-pad` base rule. The library's CSS quietly depends on host CSS variables that are not declared in the library. There is no compile-time signal of that dependency.

The two problems combine into a *drift surface*: each new panel adds a string in two places (the panel's JSX, the host's CSS), and the library carries its own variant rule that has to coordinate with the host's variable declarations across a repo boundary.

## 3. Proposal

Move the host concerns into a single host-owned wrapper. Panels stop knowing about `.panel-pad`. Exoskeleton wraps each panel when it registers the panel in the `components` map.

### 3.1 Two new exports

A new file `src/panel/PanelRoot.tsx` exports:

```tsx
import type { IDockviewPanelProps } from "dockview";
import type { ComponentType, CSSProperties, ReactNode } from "react";

export function PanelRoot({
  accent,
  children,
  style,
}: {
  accent?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="panel-pad"
      style={{ "--panel-accent": accent ?? "transparent", ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function exoPanel<P>(
  Component: ComponentType<IDockviewPanelProps<P>>,
  accent?: string,
) {
  return function Wrapped(props: IDockviewPanelProps<P>) {
    return (
      <PanelRoot accent={accent}>
        <Component {...props} />
      </PanelRoot>
    );
  };
}
```

`PanelRoot` is the host wrapper. It still uses the existing `.panel-pad` CSS rule (positioning recipe — unchanged), but the per-role accent now arrives as an inline CSS variable on the element rather than via a variant class. The variable name `--panel-accent` is the same one [`App.css:60-69`](../src/App.css#L60-L69) already reads for the `::before` stripe pseudo-element, so the visual outcome is identical.

`exoPanel(Component, accent)` is the registration helper. It produces a wrapped component to put in the Dockview `components` map. The wrapped component forwards Dockview's full props bag to the inner component unchanged, so anything Dockview hands a panel today still arrives intact.

### 3.2 The manifest becomes

```tsx
import { exoPanel } from "./panel/PanelRoot";

const components = {
  editor:    exoPanel(EditorPanel,    "var(--accent-editor)"),
  terminal:  exoPanel(TerminalPanel,  "var(--accent-terminal)"),
  webview:   exoPanel(LanWebview,     "var(--accent-webview)"),
};
```

The role-to-accent mapping moves into `App.tsx`, beside the existing role-to-component mapping. This is consistent with how [`ColoredTab.tsx:13-18`](../src/ColoredTab.tsx#L13-L18) already owns role-to-color mapping for the tab chrome.

### 3.3 What each existing panel changes to

Each of [`EditorPanel.tsx`](../src/panels/EditorPanel.tsx), [`TerminalPanel.tsx`](../src/panels/TerminalPanel.tsx), [`LanWebview.tsx`](../src/panels/LanWebview.tsx) drops the outer `<div className="panel-pad panel-pad--xxx">` wrapper. The panel's return value becomes its inner content directly (the `panel-header`, `panel-toolbar`, body — all of which already exist as inner elements). `PanelRoot` supplies the outer div now.

Example before/after for `EditorPanel`:

```tsx
// Before — EditorPanel.tsx:43-65
return (
  <div className="panel-pad panel-pad--editor">
    <div className="panel-header">editor</div>
    <div className="panel-toolbar"> ... </div>
    <textarea ... />
  </div>
);

// After
return (
  <>
    <div className="panel-header">editor</div>
    <div className="panel-toolbar"> ... </div>
    <textarea ... />
  </>
);
```

The fragment is necessary because the panel now returns multiple sibling elements; `PanelRoot` supplies the single root div.

### 3.4 CSS cleanup

Three rules in [`App.css:86-88`](../src/App.css#L86-L88) become unreachable and should be deleted:

```css
.panel-pad--editor   { --panel-accent: var(--accent-editor); }
.panel-pad--terminal { --panel-accent: var(--accent-terminal); }
.panel-pad--webview  { --panel-accent: var(--accent-webview); }
```

The `.panel-pad` base rule and the `.panel-pad::before` accent-stripe rule stay — they're still doing real work, called by `PanelRoot`. The `--<role>` variants are obsolete because the accent now arrives as an inline style.

## 4. Library-side implications

The cross-repo coupling resolves cleanly.

**Before:** the library's `TopoViewerPanel.tsx:98` writes `<div className="panel-pad panel-pad--topoviewer">`. The library's `TopoViewerPanel.css:5` writes `.panel-pad--topoviewer { --panel-accent: var(--accent-topoviewer); }`. This requires the consuming Exoskeleton fork to (a) ship the `.panel-pad` base rule, (b) declare a `--accent-topoviewer` CSS variable. Both dependencies are silent — nothing in the library's TypeScript references them.

**After:** the library panel drops the outer wrapper and the `.panel-pad--topoviewer` CSS rule entirely. It becomes a pure React component returning its inner content. The consuming Exoskeleton fork imports the panel and writes:

```tsx
import TopoViewerPanel from "./panels/topoviewer/TopoViewerPanel";
const components = {
  topo: exoPanel(TopoViewerPanel, "var(--accent-topoviewer)"),
};
```

The library's TopoViewer panel now imports nothing from Exoskeleton and depends on no Exoskeleton-defined CSS variable. It is portable to any Dockview-based application that supplies its own `exoPanel`-equivalent wrapper.

This is the property that justifies keeping the two repos separate. Before this change, the library was effectively a satellite of Exoskeleton — its panels would not function in another Dockview app without copying Exoskeleton's CSS scaffolding. After this change, the library can be cleanly forked or rebadged for other Dockview hosts.

## 5. Tradeoffs

**Adds:** one new file (~25 lines), one HOC call per panel registration in `App.tsx`, the requirement that panel returns be wrapped in a fragment when they have multiple siblings.

**Removes:** ~9 lines of CSS variant rules across two repos, the convention "your panel must use class `.panel-pad panel-pad--<your-role>`", and the silent host-CSS dependencies in the library.

**Type-checked surface gained:** the `exoPanel(Component, accent)` signature accepts only `ComponentType<IDockviewPanelProps<P>>`. Panels that don't take props (TypeScript-wise) will still type-check because `IDockviewPanelProps<P>` is just the props bag they choose to ignore — the wrapping is transparent. A panel that *does* take typed params gains type inference through the HOC.

**Type-checked surface not gained:** there is no enforced "ExoskeletonPanel" branded type. A panel could still be registered without going through `exoPanel()` and would render without the accent stripe but with no error. This is acceptable because the failure mode (missing accent) is purely visual and immediately observable. Adding a branded type to reject "raw" registration is possible but adds machinery for a class of bug that doesn't currently exist.

## 6. What this is not

This proposal does **not**:

- Introduce a shared npm package between Exoskeleton and the library. Both repos remain independent and import nothing from each other. (Library panels remain pure React components; Exoskeleton supplies the wrapper locally.)
- Change Dockview's panel API, the persistence layer, the schema/state split, or the side-grid contract.
- Add a typed `ExoskeletonPanel<P>` alias. The plain `IDockviewPanelProps<P>` from `dockview` is sufficient.
- Add params or persistence to any panel that doesn't already use it. That's separate feature work.
- Finish the in-transition `panels/` → `topoviewer/` folder reorganization documented in the library README. Independent refactor.

## 7. Verification

If implemented:

- `npm run tauri dev` in Exoskeleton should render the editor, terminal, and webview panels with their accent stripes visually identical to before. Stripe color, position (3px at the top of `.panel-pad`), and width are unchanged.
- `props.api` and `props.params` continue to reach the inner component. The HOC spreads `{...props}`, so anything Dockview hands the panel still arrives. `LanWebview`'s URL persistence (the only current consumer of `props.params`) is a good regression target.
- Grep both repos for `panel-pad--` — should return zero matches after migration. (The base `.panel-pad` rule stays; only the variant suffixes are gone.)
- No new dependencies in either repo's `package.json`.

## 8. Open questions

**Q1. Should `PanelRoot` accept a `className` prop?** Today, a panel author who wants a per-panel class for further styling (e.g. `tv-canvas-wrap` in TopoViewer) writes it on an inner div. With `PanelRoot` as the outer element, there's no way to add a class to the outermost div. The fix is one prop: `<PanelRoot className="topoviewer-root">`. Cheap to add when first needed; not added preemptively here.

**Q2. Should the library declare an `accent` prop on its panels for self-hosting?** Currently the consumer decides the accent. An alternative is for each library panel to *suggest* a default accent that the consumer can override:

```tsx
TopoViewerPanel.defaultAccent = "#a78bfa";
// consumer: exoPanel(TopoViewerPanel, TopoViewerPanel.defaultAccent);
```

This couples the library back to design decisions that should probably stay with the consumer. Recommended: don't add. Consumers always supply the accent.

**Q3. Should `exoPanel` live in the library instead of Exoskeleton?** No. `exoPanel` is the *host's* registration helper. If two different consumers want different wrapping behavior (different positioning rules, different chrome), they each ship their own `exoPanel`. Putting it in the library would re-establish the coupling we're removing.

**Q4. Does this work for popout windows?** Today's popout panels render in a separate React tree inside a separate Tauri WebviewWindow. As long as `App.tsx`'s `components` map is also used in the popout's mount, the wrapping applies there too. The popout's host CSS must include `.panel-pad` and `.panel-pad::before`. Need to verify the popout import path picks up the same `App.css` — likely yes, but not checked.

## 9. Decision required

This document captures the proposal as discussed. Before implementing:

1. Confirm the proposal addresses the actual pain (the cross-repo CSS drift is the thing worth removing, not just a tidy thought).
2. Confirm scope: Exoskeleton-side change only, or include the library migration in the same pass.
3. Confirm Q1–Q4 above, especially Q1 — adding `className` support to `PanelRoot` is cheap if decided up front.

Implementation effort: ~1 hour, 50 lines of code change across both repos, ~9 lines of CSS deletion, ~30 lines of README revision.
