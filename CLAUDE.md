# Exoskeleton — project context for Claude

## What this is

A Tauri 2 desktop workspace — structure you operate inside while you work. One window, three docked panels: a Markdown editor, a real-shell terminal, and a webview for LAN HTTP services (or any iframe-friendly site). macOS Apple Silicon + Pop!_OS.

The repo was originally named `hud` (heads-up display); renamed 2026-05-09 because *exoskeleton* better captures the posture — you wear it and operate from it, not just look at it.

## Stack at a glance

| Concern | Choice |
| --- | --- |
| Shell | Tauri 2 (Rust) |
| UI | React 19 + TypeScript |
| Layout | Dockview 6 |
| Terminal | `@xterm/xterm` + `tauri-plugin-pty` (via `tauri-pty`) |
| Editor | textarea (TODO: muya — see README caveats) |

Full stack details and caveats live in [README.md](README.md). Don't duplicate them here.

## How to run

```
npm install
npm run tauri dev
```

First Rust build is 5–15 min; subsequent runs are fast.

## Current shape

Sixteen panels via Dockview, registered in [src/App.tsx](src/App.tsx)'s `components` map; 14 are in the default-layout registry ([src/persistence/default-layout.ts](src/persistence/default-layout.ts)), while `settings` (Cmd+B, left edge group) and `status-bar` (bottom edge group) are added imperatively. The founding three:

- **editor** (cyan) — [src/panels/EditorPanel.tsx](src/panels/EditorPanel.tsx) — textarea + Tauri fs/dialog; persists its open file path in params
- **terminal** (amber) — [src/panels/TerminalPanel.tsx](src/panels/TerminalPanel.tsx) — xterm wired to a real PTY
- **webview** (mint) — [src/panels/LanWebview.tsx](src/panels/LanWebview.tsx) — iframe with URL bar, defaults to `https://dockview.dev` (the layout library's docs). Named `LanWebview` to label what it's *for* — LAN HTTP services and similar iframe-friendly surfaces. The panel id `webview` (and the mint color identity) are kept because they describe the panel's *role*, not its implementation.

The rest: `tempo-clock`, `piano`, `scope` (OSC instruments), and the JSON suite — `json-edit` (Monaco) feeding seven viewers (`json-tree`, `json-graph`, `json-cytoscape`, `json-graph3d`, `json-circles`, `json-mass`, `json-dyadic`) over the in-process json-bus. Every panel has a manifest declaring `capabilities` / `optionalCapabilities` / `companions` (see [docs/panel-capability-map.md](docs/panel-capability-map.md)).

## Where to look first

Read these in order at the start of a session:

1. **[docs/SESSIONS.md](docs/SESSIONS.md)** — bottom entry. Current state, last move, next move. This is the live handoff.
2. **[README.md](README.md)** — human-facing intro and labeled caveats.
3. **[docs/AGENTS-FAQ.md](docs/AGENTS-FAQ.md)** — running log of recurring refactor questions, in test-case shape. Skim before reinventing an answer; add an entry when you find a new one.

## Core contracts (don't redesign — extend)

These are the type-level contracts that library panels and other tooling depend on. Adding fields is fine; renaming or removing without a heads-up will break every library component.

- **[src/panel-manifest.ts](src/panel-manifest.ts)** — `PanelManifest<P>` is the integration contract every library panel satisfies. Agents installing a panel from `~/Projects/exoskeleton-component-library/` read a manifest and perform the App.tsx / ColoredTab / App.css / default-layout / capabilities / Cargo / package.json edits implied by its fields. The library's top-level README documents the install protocol.

## Don't touch without asking

- **Dockview composition** in [src/App.tsx](src/App.tsx) — the side+main shape is intentional (commit 607a2e2).
- **Default webview URL** `https://dockview.dev` — generic onboarding default for fresh forks. Change in [src/persistence/default-layout.ts](src/persistence/default-layout.ts) if needed; not load-bearing.
- **File names** Harold chose — never rename without asking (global rule).

## Not load-bearing — just current

These look like they might be sacred but aren't. Free to change with normal review:

- **Panel accent colors** (cyan/amber/mint). Harold asked for distinct colors so he could tell panels apart while thinking — pragmatic, not a design system. The earlier CLAUDE.md treated this as untouchable; that was over-canonization on my part (clarified 2026-05-10).

## Convention: end-of-session handoff

Before closing a session, append one dated entry to [docs/SESSIONS.md](docs/SESSIONS.md) using the format documented there. Then commit and push as `halapenyoharry`. This is the substrate that lets the next session start cold.
