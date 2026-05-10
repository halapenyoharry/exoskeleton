# SESSIONS

Append-only handoff log. Newest entry at the bottom. Read the bottom entry first.

## Format

```
## YYYY-MM-DD

State: <what's true on disk right now, 1 line>
Last: <what we just did, 1 line>
Next: <the next concrete move, 1 line>
Open: <unresolved question or assumption — optional>
```

If an entry runs longer than 6 lines, the work-in-progress should probably be a commit instead. Keep it tight — this is a handoff, not a journal.

---

## 2026-05-09

State: clean tree at 6de2850. Tauri 2 + React + Dockview scaffold with three panels (editor textarea, xterm+pty terminal, iframe webview), color-coded cyan/amber/mint.
Last: added CLAUDE.md + this SESSIONS.md to externalize project state — fix for context-decay across sessions.
Next: Harold's call. Likely candidate per README caveat is the muya editor swap (textarea → real Markdown surface).
Open: muya 0.2.5 is flagged not-for-prod — pin a fork, run from master, or switch to Milkdown / Lexical / CodeMirror+remark? Decide before swapping.

## 2026-05-09 (later)

State: project renamed `hud` → `exoskeleton`. New paths: repo dir `~/Projects/exoskeleton/`, GitHub `halapenyoharry/exoskeleton`, auto-memory `~/.claude/projects/-Users-harold-Projects-exoskeleton/`. Webview panel renamed `WebviewPanel` → `LanWebview` to label its purpose (LAN HTTP services); panel id `webview` and the mint color identity kept.
Last: full rename pass — package.json, Cargo.toml, tauri.conf.json, capabilities, main.rs, README, CLAUDE.md, dir, GitHub repo, git remote. Cargo will rebuild target/ from scratch on next `npm run tauri dev` (5–15 min) because the crate name changed.
Next: still Harold's call. Muya editor swap is the open caveat. Or push on the next module.
Open: should `target/` get a `cargo clean` to drop stale `hud`-named artifacts, or just let cargo handle it?

## 2026-05-10

State: clean tree at d242634 + this entry. Workspace file consolidated to `exoskeleton.code-workspace` (tracked). Old hud-era auto-memory archived at `~/.claude/projects/-Users-harold-Projects-hud.archived/`. Empty `~/Projects/hud/` shell trashed. Build verified: `npm run tauri dev` brings up the **Exoskeleton** window.
Last: rename hygiene. The earlier open question — "should `target/` get a `cargo clean`?" — answered yes: the first post-rename build failed because cargo's incremental state had `/Users/harold/Projects/hud/...` absolute paths baked into tauri plugin permissions output. `cargo clean` fixed it.
Next: Harold's call. Top of the queue per the muya caveat in README. Or pick a different module to push on.
Open: VS Code keeps offering to recreate `xos.code-workspace` if its workspace identity is reset. Watch for it; trash if it reappears.
