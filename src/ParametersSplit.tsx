import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import {
  LayoutPriority,
  Orientation,
  PaneviewReact,
  SplitviewReact,
  themeGithubDark,
  type IPaneviewPanelProps,
  type ISplitviewPanelProps,
  type PaneviewReadyEvent,
  type SplitviewReadyEvent,
} from "dockview-react";
import "./ParametersSplit.css";

// The one layout every panel-with-controls uses: a vertical Dockview
// Splitview, row 1 a Paneview holding a single collapsible section of
// controls, row 2 the panel's content taking everything else.
//
//   ┌ section header (Dockview pane header, click to fold) ┐
//   │ controls (wrap; the row grows to fit them)           │
//   ├──────────── sash (drag up past min → snaps away) ─────┤
//   │ content                                              │
//   └──────────────────────────────────────────────────────┘
//
// All chrome — sash, header, colors, sizes — comes from the Dockview theme
// class, the same one the dock uses, so adjusting the theme adjusts every
// panel at once. This file owns no visual styling beyond cell sizing.
//
// dockview-react renders nested components through React portals, so the
// context below crosses the Splitview/Paneview boundary intact and the
// panel keeps all its state; the cells are thin.

const PANE_HEADER = 24;
/** Initial guess before the controls are measured. */
const INITIAL_BODY = 40;

interface Ctx {
  title: string;
  controls: ReactNode;
  content: ReactNode;
}

const ParametersCtx = createContext<Ctx>({ title: "", controls: null, content: null });

function SectionCell(_props: IPaneviewPanelProps) {
  const { controls } = useContext(ParametersCtx);
  return <div className="parameters-split-section">{controls}</div>;
}

function ControlsCell(props: ISplitviewPanelProps) {
  const { title } = useContext(ParametersCtx);
  const paneApiRef = useRef<PaneviewReadyEvent["api"] | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Size the controls row to its content: pane header + measured height of
  // the controls (0 when folded). Measured, not constant, so wrapping on a
  // narrow panel grows the row instead of clipping it.
  const fit = useCallback(() => {
    const pane = paneApiRef.current;
    const host = hostRef.current;
    if (!pane || !host) return;
    const section = host.querySelector<HTMLElement>(".parameters-split-section");
    const bodyH = section ? section.scrollHeight : INITIAL_BODY;
    const total = pane.panels.reduce(
      (sum, p) => sum + PANE_HEADER + (p.api.isExpanded ? bodyH : 0),
      0,
    );
    props.api.setSize({ size: total });
  }, [props.api]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(host);
    const section = host.querySelector(".parameters-split-section");
    if (section) ro.observe(section);
    return () => ro.disconnect();
  }, [fit]);

  const onReady = (e: PaneviewReadyEvent) => {
    paneApiRef.current = e.api;
    const panel = e.api.addPanel({
      id: "parameters",
      component: "section",
      title,
      headerSize: PANE_HEADER,
      minimumBodySize: 0,
      isExpanded: true,
    });
    panel.api.onDidExpansionChange(() => fit());
    // The section mounts through a portal on the next tick; measure then.
    requestAnimationFrame(() => fit());
  };

  return (
    <div className="parameters-split-controls-cell" ref={hostRef}>
      <PaneviewReact
        className={themeGithubDark.className}
        components={{ section: SectionCell }}
        onReady={onReady}
      />
    </div>
  );
}

function ContentCell(_props: ISplitviewPanelProps) {
  const { content } = useContext(ParametersCtx);
  return <div className="parameters-split-content-cell">{content}</div>;
}

const components = { controls: ControlsCell, content: ContentCell };

export interface ParametersSplitProps {
  /** Pane header text. Graph viewers use "graph-parameters". */
  title: string;
  controls: ReactNode;
  children: ReactNode;
}

export function ParametersSplit({ title, controls, children }: ParametersSplitProps) {
  const onReady = (e: SplitviewReadyEvent) => {
    e.api.addPanel({
      id: "controls",
      component: "controls",
      minimumSize: PANE_HEADER,
      snap: true,
      size: PANE_HEADER + INITIAL_BODY,
    });
    e.api.addPanel({
      id: "content",
      component: "content",
      priority: LayoutPriority.High,
    });
  };

  return (
    <ParametersCtx.Provider value={{ title, controls, content: children }}>
      <div className="parameters-split-root">
        <SplitviewReact
          className={themeGithubDark.className}
          orientation={Orientation.VERTICAL}
          components={components}
          onReady={onReady}
        />
      </div>
    </ParametersCtx.Provider>
  );
}
