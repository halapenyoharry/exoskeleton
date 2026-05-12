import type { ComponentType } from "react";
import type { IDockviewPanelProps } from "dockview";

/**
 * Standard OSC argument type tags. A panel declaring its OSC integration
 * lists args using these. Most panels will only need 'i', 'f', and 's'.
 *
 * - `f` 32-bit float
 * - `i` 32-bit signed int
 * - `s` UTF-8 string
 * - `T` true (no arg payload)
 * - `F` false (no arg payload)
 * - `b` blob (binary data)
 * - `h` 64-bit int
 * - `d` 64-bit double
 */
export type OscArgType = "f" | "i" | "s" | "T" | "F" | "b" | "h" | "d";

/** One OSC address the panel either emits or listens for. */
export interface OscAddressDecl {
  /** OSC path, e.g. `/exoskeleton/clock/beat`. Wildcards (`*`, `?`) are
   *  allowed in `listens` declarations only. */
  address: string;
  /** Argument types in positional order. Empty array means no payload. */
  args: OscArgType[];
  /** One-line description for generated docs. Optional. */
  description?: string;
}

/** A panel's OSC integration. Omit `osc` entirely from a manifest if the
 *  panel doesn't speak OSC — most panels won't. */
export interface PanelOscDecl {
  /** Addresses this panel sends out. */
  emits?: OscAddressDecl[];
  /** Addresses this panel listens for. Wildcards permitted. */
  listens?: OscAddressDecl[];
}

/** Where to position the panel in the default first-launch layout.
 *  Mirrors Dockview's `addPanel` position option. */
export interface PanelLayoutPosition {
  /** Direction relative to `reference`. `"within"` makes a tab inside the
   *  reference panel's group rather than splitting space. */
  direction: "right" | "below" | "left" | "above" | "within";
  /** id of the existing panel to position relative to. The first panel
   *  registered with no `defaultLayout` fills the empty grid; subsequent
   *  panels reference it (or each other) explicitly. */
  reference: string;
}

/** Rust / Tauri-side requirements. Omit `tauri` from a manifest if the
 *  panel needs nothing beyond what's already wired in `lib.rs`. */
export interface PanelTauriRequirements {
  /** Capability strings the panel needs granted in
   *  `src-tauri/capabilities/default.json`. Example:
   *  `["fs:allow-read-text-file", "dialog:allow-open"]`. */
  permissions?: string[];
  /** Names of `#[tauri::command]` functions the panel invokes. The
   *  installing agent verifies each is registered in `lib.rs` and
   *  warns (or scaffolds a stub) if not. */
  commands?: string[];
  /** Cargo crates the panel's Tauri side needs. Format matches
   *  `Cargo.toml` dependency syntax: `{ "git2": "0.20" }`. */
  cargoDependencies?: Record<string, string>;
}

/**
 * A library panel's complete integration contract. An agent installing
 * the panel into an exoskeleton fork reads a single `PanelManifest` and
 * has enough information to perform all wiring edits with no further
 * input. See the library README for the install protocol.
 *
 * Generic parameter `P` is the panel's persisted-params type — used both
 * as `IDockviewPanelProps<P>` for the component and as the type of
 * `paramsDefault`. Panels with no persisted state can omit it (defaults
 * to `unknown`).
 */
export interface PanelManifest<P extends Record<string, any> = Record<string, any>> {
  // ─── identity ────────────────────────────────────────────────

  /** Stable id used as the Dockview component key. Convention:
   *  lowercase, hyphenated, matches the panel's folder name.
   *  Example: `"tempo-clock"`. */
  id: string;

  /** Title shown in the tab. Defaults to `id` if omitted. */
  title?: string;

  /** The React component itself. */
  component: ComponentType<IDockviewPanelProps<P>>;

  /** One-line summary for the library top-level README's components
   *  table. Should fit in a markdown table cell. */
  description: string;

  // ─── chrome ──────────────────────────────────────────────────

  /** Tab accent color (any CSS color). The installing agent registers
   *  this as `--accent-<id>` in App.css and adds an entry to the
   *  accents map in ColoredTab.tsx. */
  accent: string;

  /** Single-character glyph shown via the `::before` pseudo on the tab.
   *  Examples: `"◆"`, `"♩"`, `"⌬"`. The installing agent adds this to
   *  the glyphs map in ColoredTab.tsx. */
  glyph: string;

  // ─── layout ──────────────────────────────────────────────────

  /** Position in the default first-launch layout. Omit to keep this
   *  panel user-addable only (not shown on first launch). */
  defaultLayout?: PanelLayoutPosition;

  /** Initial params the agent passes to `addPanel` when this panel is
   *  created via the default layout or the `+` header action. */
  paramsDefault?: P;

  // ─── runtime contracts ───────────────────────────────────────

  /** OSC integration declaration. Omit if this panel doesn't speak OSC. */
  osc?: PanelOscDecl;

  /** Tauri-side requirements (permissions, commands, Cargo deps). */
  tauri?: PanelTauriRequirements;

  /** npm packages this panel needs added to the fork's `package.json`. */
  npmDependencies?: Record<string, string>;

  // ─── docs ────────────────────────────────────────────────────

  /** Path to the panel's README, relative to the manifest file.
   *  Default: `"./README.md"`. */
  docs?: string;
}
