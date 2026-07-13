# Panel Capability Map

What each of the 16 exoskeleton panels needs from its host — and therefore where it can run. A unit runs in any host that provides the capabilities it declares. Most declare nothing.

## How to read it

Three tiers, by how much a unit depends on the host:

- **Universal** — needs nothing. Runs unchanged in any host (Tauri, a plain web build, a VSCode webview). Fork-proof.
- **Degrades gracefully** — runs everywhere, but loses one feature when the host isn't Tauri. The dependency is *optional* (dotted arrow).
- **Host-bound** — has a hard requirement (solid `needs` arrow).

Capability color tells you where that power exists: **green** = every host has it; **amber** = available via a small per-host adapter; **red** = Tauri only. So the only true weld is a red unit pointing at a red capability.

```mermaid
flowchart LR
  subgraph PORTABLE["Universal — needs nothing — runs in EVERY host"]
    U["8 units: the 7 JSON viewers<br/>(tree, mass, circles, graph, graph3d,<br/>cytoscape, dyadic) + status-bar"]
    Speak["speak (planned)"]
  end

  subgraph DEGRADE["Degrades gracefully — runs everywhere, loses ONE feature off-Tauri"]
    Piano["piano"]
    Clock["tempo-clock"]
    Scope["scope"]
    JsonEdit["json-edit"]
    Webview["webview"]
  end

  subgraph HOSTBOUND["Host-bound — needs a host superpower"]
    Terminal["terminal"]
    Editor["editor"]
    Settings["settings"]
  end

  PTY{{"pty (spawn a shell) — Tauri only"}}
  OSCUDP{{"osc.udp (network OSC) — Tauri only"}}
  IFRAME{{"permissive iframe — Tauri only"}}
  FS{{"fs read/write + dialog — native on Tauri, adapter on web/vscode"}}
  PERSIST{{"persistence — every host has one"}}
  TTS{{"tts engine — request/response: local command or web API"}}

  Terminal -->|needs| PTY
  Editor -->|needs| FS
  Settings -->|needs| PERSIST
  JsonEdit -.optional.-> FS
  Piano -.optional.-> OSCUDP
  Clock -.optional.-> OSCUDP
  Scope -.optional.-> OSCUDP
  Webview -.optional.-> IFRAME
  Speak -.swappable.-> TTS

  classDef portable fill:#10271b,stroke:#39cf7a,color:#d6fae5;
  classDef degrade fill:#2a2410,stroke:#d8b34a,color:#f5ecca;
  classDef bound fill:#2a1010,stroke:#e06a6a,color:#fadada;
  classDef capTauri fill:#2a1010,stroke:#e06a6a,color:#fadada;
  classDef capAny fill:#10271b,stroke:#39cf7a,color:#d6fae5;
  classDef capAdapt fill:#2a2410,stroke:#d8b34a,color:#f5ecca;
  class U,Speak portable;
  class Piano,Clock,Scope,JsonEdit,Webview degrade;
  class Terminal,Editor,Settings bound;
  class PTY,OSCUDP,IFRAME capTauri;
  class PERSIST capAny;
  class FS,TTS capAdapt;
```

## The takeaway

One hard weld (`terminal` → `pty`), two glue-points (`editor` and `json-edit` need a filesystem adapter; `settings` needs persistence, which every host already has), and everything else free. All seven JSON viewers — including the new `json-dyadic` — plus the status bar are universal today. `speak` lands in the universal tier with its TTS engine behind a swappable request/response seam.

## The declarable capability vocabulary

The right-hand column is the whole list a unit might declare in its manifest:

| Capability | Where it exists | Used by |
|---|---|---|
| `pty` | Tauri only | terminal (required) |
| `osc.udp` | Tauri only | piano, tempo-clock, scope (optional) |
| `iframe.permissive` | Tauri only | webview (optional) |
| `fs` (read/write/dialog) | native on Tauri, adapter on web/vscode | editor (required), json-edit (optional) |
| `persistence` | every host | settings (required) |
| `tts.engine` | swappable (local command or web API) | speak (planned) |
| *(none)* | every host | the 7 viewers + status-bar |

Concrete next step: add a `capabilities: string[]` field to `panel-manifest.ts` and fill it for all 16 — `[]` for the universal tier, `["pty"]` for terminal, and so on — so a host can refuse, at install time, anything it can't run.
