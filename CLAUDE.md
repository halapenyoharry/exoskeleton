# Exoskeleton — project context for Claude

## What this is

A Tauri 2 desktop workspace — structure you operate inside while you work. One window, three docked panels: a Markdown editor, a real-shell terminal, and a webview pointed at LAN services (default: ComfyUI on lumen's RTX 3090). macOS Apple Silicon + Pop!_OS.

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

Three panels via Dockview, defined in [src/App.tsx](src/App.tsx):

- **editor** (cyan) — [src/panels/EditorPanel.tsx](src/panels/EditorPanel.tsx) — textarea + Tauri fs/dialog
- **terminal** (amber) — [src/panels/TerminalPanel.tsx](src/panels/TerminalPanel.tsx) — xterm wired to a real PTY
- **webview** (mint) — [src/panels/LanWebview.tsx](src/panels/LanWebview.tsx) — iframe with URL bar for LAN HTTP services, defaults to `http://lumen.local:8188`. Named `LanWebview` to label what it's for; the panel id `webview` (and the mint color identity) are kept because they describe the panel's *role*, not its implementation.

## Where to look first

Read these in order at the start of a session:

1. **[docs/SESSIONS.md](docs/SESSIONS.md)** — bottom entry. Current state, last move, next move. This is the live handoff.
2. **[README.md](README.md)** — human-facing intro and labeled caveats.
3. **`~/.claude/projects/-Users-harold-Projects-exoskeleton/memory/`** — how Harold works (e.g. ship-concrete-start feedback). Loaded automatically; skim if relevant.

## Don't touch without asking

- **Dockview composition** in [src/App.tsx](src/App.tsx) — the side+main shape is intentional (commit 607a2e2).
- **Panel color identity** (cyan/amber/mint) — the last commit (6de2850) made it unmissable on purpose. Don't soften.
- **Default webview URL** `http://lumen.local:8188` — this is ComfyUI on the RTX 3090; iframe-friendly because it's HTTP and on-LAN.
- **File names** Harold chose — never rename without asking (global rule).

## Convention: end-of-session handoff

Before closing a session, append one dated entry to [docs/SESSIONS.md](docs/SESSIONS.md) using the format documented there. Then commit and push as `halapenyoharry`. This is the substrate that lets the next session start cold.
