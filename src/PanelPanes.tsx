// The controls of a panel, as Dockview primitives. A panel *declares* its
// panes (manifest.panes: PanelPane[], registered in src/chrome/panes); the
// host renders them here:
//
//   Splitview (vertical) inside the panel
//   ├ top cell (snap: drag the sash past the minimum and it is gone;
//   │          a button in the group's header actions brings it back)
//   │  └ Paneview
//   │     ├ title pane (edge-group panels only; header, no body)
//   │     └ "Controls" pane (fold by its header)
//   │        └ nested Dockview, one locked group:
//   │           one tab per declared pane ("layout", "labels", "physics"…)
//   │           + a "Pane" tab (window / move / follow / accent / about);
//   │           tabs sharing a declared `tabGroup` sit under a Dockview
//   │           tab-group chip
//   └ content cell (LayoutPriority.High)
//
// Declared actions (PanelPane kind "action", e.g. fit) render in the
// group's header actions (HeaderActions.tsx). The active tab and the pane's
// folded state persist in the panel's params (`controlsTab`, `panesExpanded`).
//
// dockview-react renders nested components through React portals, so the
// context below crosses every boundary intact; all state stays in the
// panel's params.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  DockviewDefaultTab,
  DockviewReact,
  LayoutPriority,
  Orientation,
  PaneviewReact,
  SplitviewReact,
  themeGithubDark,
  type DockviewApi,
  type DockviewPanelApi,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
  type IPaneviewPanelProps,
  type ISplitviewPanelProps,
  type PaneviewReadyEvent,
  type SplitviewReadyEvent,
} from "dockview-react";
import { registerPanesVisibility, setPanesVisible } from "./panes-visibility";
import { PanelMenuButton } from "./PanelMenuButton";
import { Segmented, SwatchPicker, Toggle } from "./components/toolbar/Toolbar";
import { getOptions, onOptions, getText, onText, type RuntimeOption } from "./chrome/runtime-options";
import { emitPanelMenu } from "./panel-menu";
import type { PaneCell, PanelPane } from "./panel-manifest";
import pkg from "../package.json";
import "./PanelPanes.css";

const PANE_HEADER = 24;
const SETTINGS_ID = "__pane";
const TITLE_ID = "__title";
const CONTROLS_ID = "__controls";
/** Placeholder names; Harold's to set. */
const CONTROLS_TITLE = "Controls";
const SETTINGS_TITLE = "Pane";
const ACCENTS = ["#7ddff5", "#ffb454", "#7dffb0", "#ff7da8", "#b69cff"];

type Params = Record<string, unknown>;

function useParams(api: DockviewPanelApi): [Params, (patch: Params) => void] {
  const [params, setParams] = useState<Params>(() => (api.getParameters() ?? {}) as Params);
  useEffect(() => {
    setParams((api.getParameters() ?? {}) as Params);
    const sub = api.onDidParametersChange?.((p) => setParams({ ...(p as Params) }));
    return () => sub?.dispose();
  }, [api]);
  const write = useCallback(
    (patch: Params) => {
      api.updateParameters(patch);
      setParams((prev) => ({ ...prev, ...patch }));
    },
    [api],
  );
  return [params, write];
}

// ---------------------------------------------------------------- cells

function useCellOptions(panelId: string, cell: PaneCell): RuntimeOption[] {
  const key = cell.optionsFrom;
  const [rt, setRt] = useState<RuntimeOption[]>(() => (key ? getOptions(panelId, key) : []));
  useEffect(() => {
    if (!key) return;
    setRt(getOptions(panelId, key));
    return onOptions(panelId, key, setRt);
  }, [panelId, key]);
  if (key) return rt;
  return (cell.options ?? []).map((o) => ({ value: o.value, label: o.label ?? o.value }));
}

function SelectCell({ panelId, cell, value, onChange }: { panelId: string; cell: PaneCell; value: unknown; onChange: (v: unknown) => void }) {
  const opts = useCellOptions(panelId, cell);
  const tip = cell.tooltip ?? cell.label;
  if (opts.length === 0) return <span className="pp-dim" title={tip}>no {cell.label}s</span>;
  const cur = value == null ? "" : String(value);
  if (opts.length <= 4) {
    return (
      <Segmented<string>
        label={cell.label}
        title={tip}
        value={cur}
        onChange={(v) => onChange(v)}
        options={opts.map((o) => ({ value: o.value, label: o.label, title: o.title ?? o.label }))}
      />
    );
  }
  return (
    <select className="pp-select" aria-label={cell.label} title={tip} value={cur} onChange={(e) => onChange(e.target.value || null)}>
      {!opts.some((o) => o.value === cur) && <option value="">{"— pick —"}</option>}
      {opts.map((o) => <option key={o.value} value={o.value} title={o.title}>{o.label}</option>)}
    </select>
  );
}

function TextCell({ panelId, cell }: { panelId: string; cell: PaneCell }) {
  const key = cell.textFrom ?? cell.action ?? cell.label;
  const [text, setText] = useState(() => getText(panelId, key));
  useEffect(() => {
    setText(getText(panelId, key));
    return onText(panelId, key, setText);
  }, [panelId, key]);
  return (
    <button
      type="button"
      className="pp-text"
      data-action-item={cell.action ?? key}
      title={cell.tooltip ?? cell.label}
      onClick={() => emitPanelMenu(panelId, cell.action ?? key)}
    >
      {text || cell.label}
    </button>
  );
}

function MenuCell({ cell }: { cell: PaneCell }) {
  const ctx = useContext(PanelPanesCtx);
  if (!ctx) return null;
  return (
    <PanelMenuButton
      panelId={ctx.panelId}
      api={ctx.api}
      containerApi={ctx.containerApi}
      structural={!!ctx.titlePane}
      className={`pp-action${cell.tooltip ? "" : ""}`}
    />
  );
}

function CellView({ panelId, cell, value, onChange }: { panelId: string; cell: PaneCell; value: unknown; onChange: (v: unknown) => void }) {
  const tip = cell.tooltip ?? cell.label;
  const numeric = typeof value === "number";
  const coerce = (s: string) => (numeric ? Number(s) : s);
  switch (cell.type) {
    case "menu":
      return <MenuCell cell={cell} />;
    case "action":
      return (
        <button
          type="button"
          className="pp-action"
          data-action-item={cell.action ?? cell.label}
          aria-label={cell.label}
          title={cell.tooltip ?? cell.label}
          onClick={() => emitPanelMenu(panelId, cell.action ?? cell.label)}
        >
          {cell.icon ?? cell.label}
        </button>
      );
    case "text":
      return <TextCell panelId={panelId} cell={cell} />;
    case "segmented":
      return (
        <Segmented<string>
          label={cell.label}
          title={tip}
          value={String(value)}
          onChange={(v) => onChange(coerce(v))}
          options={(cell.options ?? []).map((o) => ({ value: o.value, label: o.label ?? o.value, icon: o.icon, title: o.label ?? o.value }))}
        />
      );
    case "select":
      return <SelectCell panelId={panelId} cell={cell} value={value} onChange={onChange} />;
    case "toggle":
      return <Toggle label={cell.label} title={tip} checked={!!value} onChange={onChange} />;
    case "swatch":
      return (
        <SwatchPicker<string>
          label={cell.label}
          title={tip}
          value={String(value)}
          onChange={(v) => onChange(coerce(v))}
          options={(cell.options ?? []).map((o) => ({ value: o.value, color: o.color ?? o.value, title: o.label ?? o.value }))}
        />
      );
    case "stepper": {
      const step = cell.step ?? 1;
      const n = typeof value === "number" ? value : 0;
      const clamp = (x: number) => Math.min(cell.max ?? Infinity, Math.max(cell.min ?? -Infinity, x));
      return (
        <div className="pp-stepper" title={tip} role="group" aria-label={cell.label}>
          <button type="button" aria-label={`decrease ${cell.label}`} onClick={() => onChange(clamp(n - step))}>−</button>
          <output>{n}</output>
          <button type="button" aria-label={`increase ${cell.label}`} onClick={() => onChange(clamp(n + step))}>+</button>
        </div>
      );
    }
    case "dial":
      return (
        <input
          className="pp-dial"
          type="range"
          aria-label={cell.label}
          title={tip}
          min={cell.min ?? 0}
          max={cell.max ?? 1}
          step={cell.step ?? 0.01}
          value={typeof value === "number" ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
  }
}

function Cell({ panelId, cell, params, write }: { panelId: string; cell: PaneCell; params: Params; write: (p: Params) => void }) {
  const bare = cell.type === "action" || cell.type === "text" || cell.type === "menu";
  const param = cell.param ?? "";
  return (
    <div className={bare ? "pp-cell pp-cell--bare" : "pp-cell"}>
      {!bare && <span className="pp-cell-caption" title={cell.tooltip}>{cell.label}</span>}
      <CellView panelId={panelId} cell={cell} value={param ? params[param] : undefined} onChange={(v) => param && write({ [param]: v })} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pp-row">
      <span className="pp-row-label">{label}</span>
      {children}
    </div>
  );
}

/** The ⚙ "pane" section every panel gets: window, move, follow, accent, about. */
function PaneSettings({ api, containerApi, params, write, about }: { api: DockviewPanelApi; containerApi: DockviewApi; params: Params; write: (x: Params) => void; about?: { description?: string; docs?: string } }) {
  const [maxed, setMaxed] = useState(() => api.group.api.isMaximized());
  const others = containerApi.groups.filter((g) => g.id !== api.group.id);
  const accent = typeof params.accent === "string" ? params.accent : ACCENTS[0];
  return (
    <div className="pp-stack">
      <Row label="Window">
        <button type="button" className="pp-btn" onClick={() => {
          if (maxed) api.group.api.exitMaximized(); else api.group.api.maximize();
          setMaxed(!maxed);
        }}>{maxed ? "Restore" : "Maximize"}</button>
        <button type="button" className="pp-btn" onClick={() => containerApi.addPopoutGroup(api.group)}>Pop out</button>
      </Row>
      <Row label="Move to…">
        {others.length === 0 && <span className="pp-dim">no other groups</span>}
        {others.map((g, i) => (
          <button key={g.id} type="button" className="pp-btn" title={`Move into group ${g.id}`}
            onClick={() => api.moveTo({ group: g, position: "center" })}>
            {g.activePanel?.title ?? g.panels[0]?.title ?? `group ${i + 1}`}
          </button>
        ))}
      </Row>
      <Row label="Follow active document">
        <Toggle label="follow" title="Follow the active document in the editor" checked={params.followActive !== false} onChange={(v) => write({ followActive: v })} />
      </Row>
      <Row label="Accent">
        <SwatchPicker<string> label="Accent" value={accent} onChange={(v) => write({ accent: v })}
          options={ACCENTS.map((c) => ({ value: c, color: c, title: c }))} />
      </Row>
      <div className="pp-about">
        <div className="pp-about-title">About</div>
        {about?.description && <p>{about.description}</p>}
        {about?.docs && <p><a href={about.docs} target="_blank" rel="noreferrer">Docs</a></p>}
        <p className="pp-dim">Exoskeleton v{pkg.version}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- layout

interface Ctx {
  panelId: string;
  api: DockviewPanelApi;
  containerApi: DockviewApi;
  panes: PanelPane[];
  /** Header-only first pane carrying the panel's title (edge-group panels). */
  titlePane?: string;
  /** The "Pane" settings tab (window / move / follow / accent / about). */
  settingsPane: boolean;
  /** Edge-group panels: names only, Title Case, no glyphs. */
  plain: boolean;
  /** Stable object (a ref) shared by PanesCell (sizing) and the nested
   *  Dockview (which reports its api and active-tab changes into it). */
  bridge: { nestedApi: DockviewApi | null; onChange: () => void };
  params: Params;
  write: (p: Params) => void;
  about?: { description?: string; docs?: string };
  content: ReactNode;
}

const PanelPanesCtx = createContext<Ctx | null>(null);

/** One tab of the nested Dockview: the cells of one declared pane, or the
 *  "Pane" settings. Tagged so PanesCell can measure the active tab. */
function ControlsTab(props: IDockviewPanelProps<{ paneId: string }>) {
  const ctx = useContext(PanelPanesCtx);
  if (!ctx) return null;
  const { panelId, api, containerApi, panes, params, write, about } = ctx;
  const id = props.params.paneId;
  let inner: ReactNode = null;
  if (id === SETTINGS_ID) {
    inner = <PaneSettings api={api} containerApi={containerApi} params={params} write={write} about={about} />;
  } else {
    const pane = panes.find((p) => p.id === id);
    if (pane?.body) {
      inner = (
        <div className={pane.body.layout === "grid" ? "pp-grid" : "pp-stack"}>
          {pane.body.cells.map((c, i) => (
            <Cell key={c.param ?? c.action ?? c.textFrom ?? i} panelId={panelId} cell={c} params={params} write={write} />
          ))}
        </div>
      );
    }
  }
  return (
    <div className="pp-pane" data-controls-tab={id}>
      {inner}
    </div>
  );
}

const nestedComponents = { controls: ControlsTab };

/** The nested tabs are not closable. */
function ControlsTabHeader(props: IDockviewPanelHeaderProps) {
  return <DockviewDefaultTab {...props} hideClose />;
}

/** Body of the "Controls" pane: the nested Dockview. */
function ControlsPane(_props: IPaneviewPanelProps<{ paneId: string }>) {
  const ctx = useContext(PanelPanesCtx);
  if (!ctx) return null;
  const onReady = (e: DockviewReadyEvent) => {
    const { panes, api: panelApi, settingsPane } = ctx;
    const sets = panes.filter((p) => p.kind === "pane");
    const titleCase = (t: string) => t.replace(/(^|[\s-])([a-z])/g, (_m, pre: string, c: string) => pre + c.toUpperCase());
    for (const p of sets) {
      e.api.addPanel({ id: p.id, component: "controls", title: ctx.plain ? titleCase(p.label) : p.label, params: { paneId: p.id } });
    }
    if (settingsPane) {
      e.api.addPanel({ id: SETTINGS_ID, component: "controls", title: SETTINGS_TITLE, params: { paneId: SETTINGS_ID } });
    }
    // Tab groups: tabs sharing a declared label sit under one chip.
    const group = e.api.groups[0];
    if (group) {
      const byLabel = new Map<string, string[]>();
      for (const p of sets) if (p.tabGroup) byLabel.set(p.tabGroup, [...(byLabel.get(p.tabGroup) ?? []), p.id]);
      for (const [label, ids] of byLabel) {
        const tg = e.api.createTabGroup({ groupId: group.id, label });
        for (const id of ids) e.api.addPanelToTabGroup({ groupId: group.id, tabGroupId: tg.id, panelId: id });
      }
    }
    const remembered = panelApi.getParameters().controlsTab as string | undefined;
    const first = remembered && e.api.getPanel(remembered) ? remembered : sets[0]?.id ?? SETTINGS_ID;
    e.api.getPanel(first)?.api.setActive();
    e.api.onDidActivePanelChange((ev) => {
      if (ev.panel) panelApi.updateParameters({ controlsTab: ev.panel.id });
      ctx.bridge.onChange();
    });
    ctx.bridge.nestedApi = e.api;
    ctx.bridge.onChange();
  };
  return (
    <div className="pp-controls">
      <DockviewReact
        theme={themeGithubDark}
        components={nestedComponents}
        defaultTabComponent={ControlsTabHeader}
        onReady={onReady}
        locked
        disableDnd
        disableFloatingGroups
        hideBorders
      />
    </div>
  );
}

function PanesCell(props: ISplitviewPanelProps) {
  const ctx = useContext(PanelPanesCtx);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const paneApiRef = useRef<PaneviewReadyEvent["api"] | null>(null);
  const NESTED_STRIP = 35; // the theme's --dv-tabs-and-actions-container-height

  // Size the top cell to what is showing: each pane header, plus (for the
  // Controls pane, when expanded) the nested tab strip and the active tab's
  // measured content. Measured, so wrapping grows the row.
  const fit = useCallback(() => {
    const pane = paneApiRef.current;
    const host = hostRef.current;
    if (!pane || !host) return;
    let total = 0;
    for (const p of pane.panels) {
      total += PANE_HEADER;
      if (p.id === CONTROLS_ID && p.api.isExpanded) {
        const active = ctx?.bridge.nestedApi?.activePanel?.id;
        const body = active ? host.querySelector<HTMLElement>(`[data-controls-tab="${active}"]`) : null;
        total += NESTED_STRIP + (body ? body.scrollHeight : 0);
      }
    }
    props.api.setSize({ size: total });
  }, [props.api, ctx]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(host);
    const mo = new MutationObserver(() => {
      host.querySelectorAll("[data-controls-tab]").forEach((el) => ro.observe(el));
      fit();
    });
    mo.observe(host, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [fit]);

  // The nested Dockview reports into this cell through the bridge.
  useEffect(() => {
    if (!ctx) return;
    ctx.bridge.onChange = () => requestAnimationFrame(() => fit());
    if (ctx.bridge.nestedApi) requestAnimationFrame(() => fit());
  }, [ctx, fit]);

  const onReady = (e: PaneviewReadyEvent) => {
    paneApiRef.current = e.api;
    if (!ctx) return;
    const expanded = (ctx.params.panesExpanded as Record<string, boolean> | undefined) ?? {};
    if (ctx.titlePane) {
      e.api.addPanel({
        id: TITLE_ID,
        component: "pane",
        title: ctx.titlePane,
        headerSize: PANE_HEADER,
        minimumBodySize: 0,
        maximumBodySize: 0,
        isExpanded: false,
        headerComponent: "title",
        params: { paneId: TITLE_ID },
      });
    }
    // Default: folded in the grid, open in the left edge group (the title
    // pane marks edge panels). A remembered state always wins.
    const defaultOpen = !!ctx.titlePane;
    const controls = e.api.addPanel({
      id: CONTROLS_ID,
      component: "controls",
      title: CONTROLS_TITLE,
      headerSize: PANE_HEADER,
      minimumBodySize: 0,
      isExpanded: expanded[CONTROLS_ID] ?? defaultOpen,
      params: { paneId: CONTROLS_ID },
    });
    controls.api.onDidExpansionChange((ev) => {
      const cur = (ctx.api.getParameters().panesExpanded as Record<string, boolean> | undefined) ?? {};
      ctx.api.updateParameters({ panesExpanded: { ...cur, [CONTROLS_ID]: ev.isExpanded } });
      fit();
    });
    requestAnimationFrame(() => fit());
  };

  return (
    <div className="pp-panes-cell" ref={hostRef}>
      <PaneviewReact
        className={themeGithubDark.className}
        components={{ pane: EmptyPane, controls: ControlsPane }}
        headerComponents={{ title: TitleHeader }}
        onReady={onReady}
      />
    </div>
  );
}

function EmptyPane(_props: IPaneviewPanelProps) {
  return null;
}

/** Header of the title pane: renders the live title from context (a pane's
 *  own title is fixed at creation; json-edit's changes with the document). */
function TitleHeader(_props: IPaneviewPanelProps) {
  const ctx = useContext(PanelPanesCtx);
  return <div className="pp-title">{ctx?.titlePane}</div>;
}

function ContentCell(_props: ISplitviewPanelProps) {
  const ctx = useContext(PanelPanesCtx);
  return <div className="pp-content-cell">{ctx?.content}</div>;
}

const components = { panes: PanesCell, content: ContentCell };

export interface PanelPanesProps {
  panelId: string;
  api: DockviewPanelApi;
  containerApi: DockviewApi;
  panes: PanelPane[];
  titlePane?: string;
  /** Default true. */
  settingsPane?: boolean;
  about?: { description?: string; docs?: string };
  children: ReactNode;
}

export function PanelPanes({ panelId, api, containerApi, panes, titlePane, settingsPane = true, about, children }: PanelPanesProps) {
  const [params, write] = useParams(api);
  const unregisterRef = useRef<(() => void) | null>(null);
  useEffect(() => () => unregisterRef.current?.(), []);
  const bridge = useRef<{ nestedApi: DockviewApi | null; onChange: () => void }>({ nestedApi: null, onChange: () => {} }).current;
  const onReady = (e: SplitviewReadyEvent) => {
    const top = e.api.addPanel({ id: "panes", component: "panes", minimumSize: PANE_HEADER, snap: true, size: PANE_HEADER * 2 + 35 + 60 });
    e.api.addPanel({ id: "content", component: "content", priority: LayoutPriority.High });
    // Snapped away → a restore button in the group's header actions.
    unregisterRef.current = registerPanesVisibility(panelId, {
      visible: top.api.isVisible,
      show: () => {
        top.api.setVisible(true);
        top.api.setSize({ size: PANE_HEADER * 2 + 35 + 60 });
      },
    });
    top.api.onDidVisibilityChange((ev) => setPanesVisible(panelId, ev.isVisible));
  };
  return (
    <PanelPanesCtx.Provider
      value={{
        panelId, api, containerApi, panes, titlePane, settingsPane, params, write, about, content: children,
        plain: !!titlePane,
        bridge,
      }}
    >
      <div className="pp-root">
        <SplitviewReact className={themeGithubDark.className} orientation={Orientation.VERTICAL} components={components} onReady={onReady} />
      </div>
    </PanelPanesCtx.Provider>
  );
}
