import { Component, type ComponentType, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { resolveComponentKey } from "./ColoredTab";
import { PanelPanes } from "./PanelPanes";
import "./chrome/panes";
import { getPanes } from "./chrome/panes-registry";
import "./chrome/header-actions";
import { getHeaderActions } from "./chrome/header-actions-registry";

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
 */
export function PanelRoot({
  accent,
  className,
  children,
  style,
  hasPanes,
  hasHeaderActions,
}: {
  accent?: string;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
  /** true when the panel declares panes (its inline toolbar is hidden by CSS). */
  hasPanes?: boolean;
  /** true when the panel declares header actions (its inline .panel-toolbar is hidden by CSS). */
  hasHeaderActions?: boolean;
}) {
  return (
    <div
      className={className ? `panel-pad ${className}` : "panel-pad"}
      data-has-panes={hasPanes ? "true" : undefined}
      data-has-header-actions={hasHeaderActions ? "true" : undefined}
      style={{ "--panel-accent": accent ?? "transparent", ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Registration helper: takes a pure panel component and produces a
 * wrapped version to put in the Dockview `components` map. The wrapper
 * forwards all props transparently, wraps the component in a
 * `PanelErrorBoundary`, and — when the panel declares panes — hosts it
 * inside a Splitview whose top cell is the Paneview of those panes.
 */
export function exoPanel<P extends Record<string, any>>(
  Component: ComponentType<IDockviewPanelProps<P>>,
  accent?: string,
) {
  return function Wrapped(props: IDockviewPanelProps<P>) {
    const title = props.api.title ?? props.api.id;
    const componentKey = resolveComponentKey(props.api.id) ?? props.api.id;
    const panes = getPanes(componentKey);
    const hasPanes = !!panes && panes.some((p) => p.kind === "pane");
    const hasHeaderActions = !!getHeaderActions(componentKey);
    const content = <Component {...props} />;
    return (
      <PanelErrorBoundary
        panelTitle={title}
        accent={accent}
        onClose={() => props.api.close()}
      >
        <PanelRoot accent={accent} hasPanes={hasPanes} hasHeaderActions={hasHeaderActions}>
          {hasPanes ? (
            <PanelPanes panelId={props.api.id} api={props.api} containerApi={props.containerApi} panes={panes!}>
              {content}
            </PanelPanes>
          ) : (
            content
          )}
        </PanelRoot>
      </PanelErrorBoundary>
    );
  };
}
