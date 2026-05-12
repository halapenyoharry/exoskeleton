import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { IDockviewPanelProps } from "dockview";

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
}: {
  accent?: string;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className ? `panel-pad ${className}` : "panel-pad"}
      style={{ "--panel-accent": accent ?? "transparent", ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Registration helper: takes a pure panel component and produces a
 * wrapped version to put in the Dockview `components` map. The wrapper
 * forwards all props transparently, so anything Dockview hands the
 * panel still arrives intact.
 *
 *     const components = {
 *       editor:   exoPanel(EditorPanel,   "var(--accent-editor)"),
 *       terminal: exoPanel(TerminalPanel, "var(--accent-terminal)"),
 *       webview:  exoPanel(LanWebview,    "var(--accent-webview)"),
 *     };
 *
 * This is the host's responsibility — library panels stay agnostic
 * about positioning and accents. The same panel can be wrapped
 * differently by a different host (a Dockview app that isn't
 * Exoskeleton, for example) without library changes.
 */
export function exoPanel<P extends Record<string, any>>(
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
