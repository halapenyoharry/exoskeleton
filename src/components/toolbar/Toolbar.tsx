// Small, reusable toolbar primitives for panel headers.
//
// Design brief (Harold, 2026-10-10 review of the 3D-Inspect toolbar):
// one tap per choice, no dropdowns; show colors as swatches rather than
// words; captions above groups instead of "key: value" text; plain-word
// tooltips on every control; the whole strip wraps instead of running off
// the edge. Targets are >= 32px tall (>= 36px under a coarse pointer).
//
// Pure presentational — no panel knows about these beyond the props.

import type { ReactNode } from "react";
import "./toolbar.css";

export interface SegmentedOption<V extends string | number> {
  value: V;
  label: string;
  /** Optional glyph shown before the label (string or any inline node). */
  icon?: ReactNode;
  /** Plain-words tooltip for this one choice. */
  title: string;
}

export interface SegmentedProps<V extends string | number> {
  options: ReadonlyArray<SegmentedOption<V>>;
  value: V;
  onChange: (value: V) => void;
  /** Accessible name for the group (also used as the caption when `caption` is unset). */
  label?: string;
  /** Tooltip for the whole group. Falls back to `label`. */
  title?: string;
  disabled?: boolean;
  className?: string;
}

/** A labeled button group: exactly one option is active (aria-pressed). */
export function Segmented<V extends string | number>({
  options,
  value,
  onChange,
  label,
  title,
  disabled,
  className,
}: SegmentedProps<V>) {
  return (
    <div
      className={["xo-segmented", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={label}
      title={title ?? label}
      data-disabled={disabled ? "" : undefined}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            className="xo-segmented-btn"
            aria-pressed={active}
            title={opt.title}
            disabled={disabled}
            onClick={() => {
              if (!active) onChange(opt.value);
            }}
          >
            {opt.icon !== undefined && <span className="xo-segmented-icon" aria-hidden="true">{opt.icon}</span>}
            <span className="xo-segmented-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Plain-words tooltip: what turning this on does. */
  title: string;
  disabled?: boolean;
  className?: string;
}

/** A pill toggle — a real button with aria-pressed, not a bare checkbox. */
export function Toggle({ label, checked, onChange, title, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      className={["xo-toggle", className].filter(Boolean).join(" ")}
      aria-pressed={checked}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="xo-toggle-dot" aria-hidden="true" />
      <span className="xo-toggle-label">{label}</span>
    </button>
  );
}

export interface SwatchOption<V extends string | number> {
  value: V;
  /** Any CSS color. */
  color: string;
  /** Plain-words tooltip for this swatch. */
  title: string;
}

export interface SwatchPickerProps<V extends string | number> {
  options: ReadonlyArray<SwatchOption<V>>;
  value: V;
  onChange: (value: V) => void;
  label?: string;
  title?: string;
  disabled?: boolean;
  className?: string;
}

/** Small colored circles; the selected one is ringed. */
export function SwatchPicker<V extends string | number>({
  options,
  value,
  onChange,
  label,
  title,
  disabled,
  className,
}: SwatchPickerProps<V>) {
  return (
    <div
      className={["xo-swatches", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={label}
      title={title ?? label}
      data-disabled={disabled ? "" : undefined}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            className="xo-swatch"
            aria-pressed={active}
            aria-label={opt.title}
            title={opt.title}
            disabled={disabled}
            onClick={() => {
              if (!active) onChange(opt.value);
            }}
          >
            <span className="xo-swatch-dot" style={{ background: opt.color }} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export interface ToolbarGroupProps {
  /** Tiny uppercase caption drawn above the controls. */
  label: string;
  /** Tooltip for the caption; say what the group controls. */
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Caption-above-controls container. Groups sit side by side and wrap. */
export function ToolbarGroup({ label, title, children, className }: ToolbarGroupProps) {
  return (
    <div className={["xo-toolbar-group", className].filter(Boolean).join(" ")} role="group" aria-label={label}>
      <span className="xo-toolbar-caption" title={title}>
        {label}
      </span>
      <div className="xo-toolbar-group-controls">{children}</div>
    </div>
  );
}

export interface ToolbarProps {
  children: ReactNode;
  className?: string;
  /** Accessible name for the toolbar. */
  label?: string;
}

/** Wrapping flex strip. Never overflows horizontally. */
export function Toolbar({ children, className, label }: ToolbarProps) {
  return (
    <div className={["xo-toolbar", className].filter(Boolean).join(" ")} role="toolbar" aria-label={label}>
      {children}
    </div>
  );
}
