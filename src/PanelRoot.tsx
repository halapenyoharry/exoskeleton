import { Component, type ComponentType, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { resolveComponentKey } from "./ColoredTab";
import { initPaneChrome, setPaneOpen, setPanePinned, usePaneChrome } from "./pane-chrome-state";

import { PaneDrawer } from "./chrome/PaneDrawer";
import "./chrome/strips";
import { getStrip } from "./chrome/strip-registry";
import "./chrome/toolbars";
import { getToolbar } from "./chrome/toolbar-registry";
import { SlimToolbar } from "./chrome/SlimToolbar";
import type { ToolbarItem } from "./panel-manifest";

function PaneDrawerHost(props: IDockviewPanelProps<any>) {
  const id = props.api.id;
  initPaneChrome(id, (props.params as { drawerPinned?: boolean } | undefined)?.drawerPinned === true);
  const { open, pinned } = usePaneChrome(id);
  return (
    <PaneDrawer
      panelId={id}
      componentKey={resolveComponentKey(id) ?? id}
      api={props.api}
      containerApi={props.containerApi}
      open={open}
      onOpenChange={(o) => setPaneOpen(id, o)}
      pinned={pinned}
      onPinnedChange={(v) => setPanePinned(id, v, props.api)}
    />
  );
}

interface PanelErrorBoundaryProps {
  panelTitle: string;
  accent?: string;
  onClose?: () => void;
  children: ReactNode;
}

interface PanelErrorBoundaryState {
  error: Error | null;
}

/**
 * Per-panel error boundary. Isolates render/lifecycle exceptions to a single
 * panel tab, allowing the remaining workspace panels to stay interactive.
 */
export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  override state: PanelErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      `[exoskeleton] panel "${this.props.panelTitle}" crashed:`,
      error,
      errorInfo.componentStack,
    );
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      return (
        <PanelRoot accent={this.props.accent}>
          <div
            className="panel-error-fallback"
            style={
              {
                display: "flex",
                flexDirection: "column",
                height: "100%",
                boxSizing: "border-box",
                padding: "16px",
                backgroundColor: "#0d1326",
                color: "#c5e8ee",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "12px",
              } as CSSProperties
            }
          >
            <div style={{ color: "#ff5252", fontWeight: "bold", fontSize: "13px" }}>
              ⚠ Panel Error: {this.props.panelTitle}
            </div>
            <div style={{ flex: 1, overflow: "auto", margin: "12px 0", color: "#ff8a80" }}>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#1a237e",
                  color: "#18ffff",
                  border: "1px solid #00e5ff50",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
              {this.props.onClose && (
                <button
                  onClick={this.props.onClose}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#263238",
                    color: "#eceff1",
                    border: "1px solid #455a64",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Close panel
                </button>
              )}
            </div>
          </div>
        </PanelRoot>
      );
    }
    return this.props.children;
  }
}

/**
 * Host-owned wrapper that gives every panel its positioning recipe and
 * accent stripe. Panels are pure React content; the host wraps them at
 * registration time via `exoPanel`.
 *
 * The accent prop is set as an inline CSS variable `--panel-accent` on
 * the root element. App.css's `.panel-pad::before` reads that variable
 * to paint the 3px stripe at the top of the panel. Pass any valid CSS
 * color, typically a `var()` reference (e.g. `"var(--accent-editor)"`).
 *
 * The optional `className` is appended to the base `panel-pad` class —
 * useful when a panel needs its own root-level styling hook (e.g.
 * `.my-panel-root`) without recreating the positioning recipe.
 */
export function PanelRoot({
  accent,
  className,
  children,
  style,
  toolbarVisible,
  hasStrip,
  toolbar,
  panelId,
}: {
  accent?: string;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
  /** false hides the panel's toolbar row (.panel-header / .panel-toolbar). */
  toolbarVisible?: boolean;
  /** true when the panel has a registered drawer strip (inline toolbar hidden by CSS). */
  hasStrip?: boolean;
  /** Declared slim toolbar items; rendered as a dedicated row above the content. */
  toolbar?: ToolbarItem[];
  panelId?: string;
}) {
  return (
    <div
      className={className ? `panel-pad ${className}` : "panel-pad"}
      data-toolbar-visible={toolbarVisible === false ? "false" : undefined}
      data-has-strip={hasStrip ? "true" : undefined}
      data-has-toolbar={toolbar ? "true" : undefined}
      style={{ "--panel-accent": accent ?? "transparent", ...style } as CSSProperties}
    >
      {toolbar && panelId && <SlimToolbar panelId={panelId} items={toolbar} />}
      {children}
    </div>
  );
}

/**
 * Registration helper: takes a pure panel component and produces a
 * wrapped version to put in the Dockview `components` map. The wrapper
 * forwards all props transparently and wraps the component in a
 * `PanelErrorBoundary` so any throwing panel is isolated from the rest
 * of the grid.
 */
export function exoPanel<P extends Record<string, any>>(
  Component: ComponentType<IDockviewPanelProps<P>>,
  accent?: string,
) {
  return function Wrapped(props: IDockviewPanelProps<P>) {
    const title = props.api.title ?? props.api.id;
    const componentKey = resolveComponentKey(props.api.id) ?? props.api.id;
    const hasStrip = !!getStrip(componentKey);
    const toolbar = getToolbar(componentKey);
    return (
      <PanelErrorBoundary
        panelTitle={title}
        accent={accent}
        onClose={() => props.api.close()}
      >
        <PanelRoot
          accent={accent}
          hasStrip={hasStrip}
          toolbar={toolbar}
          panelId={props.api.id}
          toolbarVisible={
            (props.params as { toolbarVisible?: boolean } | undefined)?.toolbarVisible
          }
        >
          <Component {...props} />
          <PaneDrawerHost {...props} />
        </PanelRoot>
      </PanelErrorBoundary>
    );
  };
}
