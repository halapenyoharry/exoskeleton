// Pane chrome v2 drawer. See docs/design/pane-chrome-blueprint.drawio
// (sections B, C, E, G) and docs/plan-2026-10-10.md "Pane chrome v2".
// Mounted by the host inside .panel-pad; renders nothing when closed.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { DockviewApi, DockviewPanelApi } from "dockview-react";
import { Segmented, SwatchPicker, Toggle } from "../components/toolbar/Toolbar";
import { emitPanelMenu } from "../panel-menu";
import { getOptions, onOptions } from "./runtime-options";
import type { RuntimeOption } from "./runtime-options";
import type { PaneCell, PaneStripItem } from "../panel-manifest";
import { getStrip } from "./strip-registry";
import { normalizeSpan, spanToPixels } from "./grid-math";
import pkg from "../../package.json";
import "./PaneDrawer.css";

export type DrawerOrientation = "horizontal" | "vertical";

export interface PaneDrawerProps {
  panelId: string;
  componentKey: string;
  api: DockviewPanelApi;
  containerApi: DockviewApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  /** Optional About-block content for the ⚙ tab (manifest description / docs link). */
  about?: { description?: string; docs?: string };
}

const SETTINGS_ID = "__settings";
const MIN_VERTICAL = 260;
const DEFAULT_VERTICAL = 300;
const MIN_HORIZONTAL_BODY = 72;
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
  if (opts.length === 0) return <span className="pd-dim" title={tip}>no {cell.label}s</span>;
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
    <select className="pd-select" aria-label={cell.label} title={tip} value={cur} onChange={(e) => onChange(e.target.value || null)}>
      {!opts.some((o) => o.value === cur) && <option value="">{"\u2014 pick \u2014"}</option>}
      {opts.map((o) => <option key={o.value} value={o.value} title={o.title}>{o.label}</option>)}
    </select>
  );
}

function CellView({ panelId, cell, value, onChange }: { panelId: string; cell: PaneCell; value: unknown; onChange: (v: unknown) => void }) {
  const tip = cell.tooltip ?? cell.label;
  const numeric = typeof value === "number";
  const coerce = (s: string) => (numeric ? Number(s) : s);
  switch (cell.type) {
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
        <div className="pd-stepper" title={tip} role="group" aria-label={cell.label}>
          <button type="button" aria-label={`decrease ${cell.label}`} onClick={() => onChange(clamp(n - step))}>−</button>
          <output>{n}</output>
          <button type="button" aria-label={`increase ${cell.label}`} onClick={() => onChange(clamp(n + step))}>+</button>
        </div>
      );
    }
    case "dial":
      return (
        <input
          className="pd-dial"
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

function Cell({ panelId, cell, params, write, stack }: { panelId: string; cell: PaneCell; params: Params; write: (p: Params) => void; stack: boolean }) {
  // Cells size to their content; a declared row span is only a min-height.
  const minHeight = stack ? undefined : spanToPixels([1, normalizeSpan(cell.span, 99)[1]]).height;
  return (
    <div className="pd-cell" style={minHeight && minHeight > 52 ? { minHeight } : undefined}>
      <span className="pd-cell-caption" title={cell.tooltip}>{cell.label}</span>
      <CellView panelId={panelId} cell={cell} value={params[cell.param]} onChange={(v) => write({ [cell.param]: v })} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pd-row">
      <span className="pd-row-label">{label}</span>
      {children}
    </div>
  );
}

function SettingsBody({ p }: { p: PaneDrawerProps & { params: Params; write: (x: Params) => void } }) {
  const { api, containerApi, params, write, about } = p;
  const [maxed, setMaxed] = useState(() => api.group.api.isMaximized());
  const others = containerApi.groups.filter((g) => g.id !== api.group.id);
  const accent = typeof params.accent === "string" ? params.accent : ACCENTS[0];
  return (
    <div className="pd-stack">
      <Row label="Window">
        <button type="button" className="pd-btn" onClick={() => {
          if (maxed) api.group.api.exitMaximized(); else api.group.api.maximize();
          setMaxed(!maxed);
        }}>{maxed ? "Restore" : "Maximize"}</button>
        <button type="button" className="pd-btn" onClick={() => containerApi.addPopoutGroup(api.group)}>Pop out</button>
      </Row>
      <Row label="Move to…">
        {others.length === 0 && <span className="pd-dim">no other groups</span>}
        {others.map((g, i) => (
          <button key={g.id} type="button" className="pd-btn" title={`Move into group ${g.id}`}
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
      <div className="pd-about">
        <div className="pd-about-title">About</div>
        {about?.description && <p>{about.description}</p>}
        {about?.docs && <p><a href={about.docs} target="_blank" rel="noreferrer">Docs</a></p>}
        <p className="pd-dim">Exoskeleton v{pkg.version}</p>
      </div>
    </div>
  );
}

export function PaneDrawer(props: PaneDrawerProps) {
  const { panelId, componentKey, api, open, onOpenChange, pinned, onPinnedChange } = props;
  const [params, write] = useParams(api);
  const strip = useMemo<PaneStripItem[]>(() => getStrip(componentKey) ?? getStrip(panelId) ?? [], [componentKey, panelId]);
  const [active, setActive] = useState<string>(() => strip.find((s) => s.kind === "tab")?.id ?? SETTINGS_ID);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [stripW, setStripW] = useState(0);

  const orientation: DrawerOrientation = params.drawerOrientation === "vertical" ? "vertical" : "horizontal";
  const rawSize = typeof params.drawerSize === "number" ? params.drawerSize : undefined;
  // horizontal: max body height (undefined = fit content); vertical: drawer width.
  const size = orientation === "vertical" ? Math.max(MIN_VERTICAL, rawSize ?? DEFAULT_VERTICAL) : rawSize;

  // Restore pinned state from params once.
  useEffect(() => {
    if (typeof params.drawerPinned === "boolean" && params.drawerPinned !== pinned) onPinnedChange(params.drawerPinned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape / outside click close an unpinned drawer.
  useEffect(() => {
    if (!open || pinned) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || rootRef.current?.contains(t) || t.closest?.("[data-pane-chrome]")) return;
      onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, pinned, onOpenChange]);

  // Horizontal min-width = natural width of the strip row (measured with wrapping off).
  useEffect(() => {
    if (!open || !stripRef.current) return;
    const el = stripRef.current;
    const measure = () => {
      const prev = el.style.flexWrap;
      el.style.flexWrap = "nowrap";
      const w = Array.from(el.children).reduce((n, c) => n + (c as HTMLElement).offsetWidth + 4, 12);
      el.style.flexWrap = prev;
      setStripW(Math.ceil(w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, strip]);

  const onResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const start = orientation === "horizontal" ? e.clientY : e.clientX;
    const base = orientation === "vertical"
      ? size ?? DEFAULT_VERTICAL
      : rawSize ?? bodyRef.current?.offsetHeight ?? 150;
    const move = (ev: PointerEvent) => {
      const d = (orientation === "horizontal" ? ev.clientY : ev.clientX) - start;
      const lo = orientation === "vertical" ? MIN_VERTICAL : MIN_HORIZONTAL_BODY;
      write({ drawerSize: Math.round(Math.min(900, Math.max(lo, base + d))) });
    };
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  if (!open) return null;

  const tabs = strip.filter((s) => s.kind === "tab");
  const current = active === SETTINGS_ID ? undefined : tabs.find((t) => t.id === active) ?? tabs[0];
  const showSettings = active === SETTINGS_ID || !current;

  const pickItem = (item: PaneStripItem) => {
    if (item.kind === "tab") setActive(item.id);
    else emitPanelMenu(panelId, item.id);
  };

  return (
    <div
      ref={rootRef}
      className={`pane-drawer pane-drawer--${orientation}`}
      style={{ ...(size === undefined ? {} : { ["--pd-size" as string]: `${size}px` }), ["--pd-strip-w" as string]: `${stripW}px` }}
      data-pane-drawer
      role="region"
      aria-label="Pane controls"
    >
      <div className="pd-strip" role="tablist" ref={stripRef}>
        {strip.map((item) => item.kind === "tab" ? (
          <button key={item.id} type="button" className="pd-tab" role="tab"
            aria-selected={item.id === current?.id && !showSettings}
            title={item.tooltip ?? item.label} onClick={() => pickItem(item)}>
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ) : (
          <button key={item.id} type="button" className="pd-pos--action"
            title={item.tooltip ?? item.label} onClick={() => pickItem(item)}>
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" className="pd-tab" role="tab" aria-selected={showSettings} title="Pane settings" onClick={() => setActive(SETTINGS_ID)}>
          <span aria-hidden="true">⚙</span>
          <span>pane</span>
        </button>
        <span className="pd-spacer" />
        <button type="button" className="pd-pos--host" title={orientation === "horizontal" ? "Dock drawer to the left" : "Span drawer across the top"}
          onClick={() => write({ drawerOrientation: orientation === "horizontal" ? "vertical" : "horizontal", drawerSize: undefined })}>
          <span className="pd-pos-icon" aria-hidden="true">⇅</span>
        </button>
        <button type="button" className="pd-pin" aria-pressed={pinned} title={pinned ? "Unpin: close on Escape or outside click" : "Pin: keep the drawer open"}
          onClick={() => { write({ drawerPinned: !pinned }); onPinnedChange(!pinned); }}>
          📌
        </button>
      </div>
      <div className="pd-body" ref={bodyRef}>
        {showSettings ? (
          <SettingsBody p={{ ...props, params, write }} />
        ) : current?.body ? (
          <div className={current.body.layout === "grid" ? "pd-grid" : "pd-stack"}>
            {current.body.cells.map((c) => (
              <Cell key={c.param} panelId={panelId} cell={c} params={params} write={write} stack={current.body!.layout === "stack"} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="pd-resize" onPointerDown={onResizeDown} role="separator" aria-label="Resize drawer" aria-orientation={orientation === "horizontal" ? "horizontal" : "vertical"} />
    </div>
  );
}
