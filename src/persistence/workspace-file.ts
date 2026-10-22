import type { Workspace } from "./storage.ts";

export interface WorkspaceDocument {
  $schema?: string;
  type: "exoskeleton-workspace";
  version: 8;
  workspace: Workspace;
}

/**
 * Panel param keys that hold credentials. Never written into a workspace
 * document and never accepted from one.
 *
 * `apiKey` — TopologyExtractPanel keeps the OpenRouter key in its params so
 * it survives restarts. That's fine in local app state (exoskeleton.json),
 * but an exported .exo.json is made to be shared, so the key must not ride
 * along. Add any future credential-bearing param here.
 */
const SECRET_PARAM_KEYS = ["apiKey"] as const;

/**
 * Serializes a Workspace object into a formatted `.exo.json` document string.
 * Secret panel params (see SECRET_PARAM_KEYS) are stripped first.
 */
export function serializeWorkspaceDocument(workspace: Workspace): string {
  const doc: WorkspaceDocument = {
    type: "exoskeleton-workspace",
    version: 8,
    workspace: stripPanelParams(workspace, SECRET_PARAM_KEYS),
  };
  return JSON.stringify(doc, null, 2);
}

/**
 * Parses and validates an `.exo.json` document string, returning the inner Workspace object.
 * Throws an Error if the string is invalid JSON or fails document structure checks.
 */
export function parseWorkspaceDocument(raw: string): Workspace {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON document: ${(e as Error).message}`);
  }

  if (!obj || typeof obj !== "object") {
    throw new Error("Invalid JSON document: Expected an object");
  }

  const doc = obj as Partial<WorkspaceDocument>;
  if (doc.type !== "exoskeleton-workspace") {
    throw new Error("Not an Exoskeleton workspace document");
  }

  if (!doc.workspace || typeof doc.workspace !== "object") {
    throw new Error("Missing workspace object in document");
  }

  const ws = doc.workspace;
  if (typeof ws.id !== "string" || typeof ws.name !== "string") {
    throw new Error("Invalid workspace structure: missing string id or name");
  }

  if (ws.mobileLayout !== undefined) {
    const ml = ws.mobileLayout as { grid?: unknown; panels?: unknown } | null;
    if (!ml || typeof ml !== "object" || typeof ml.panels !== "object" || !ml.grid) {
      throw new Error("Invalid workspace structure: mobileLayout is malformed");
    }
  }

  // Edge groups (the document on the left, settings on the right, the status
  // bar below) ride inside each layout: open/collapsed state and size are part
  // of the workspace, so a malformed entry would silently lose them.
  checkEdgeGroups(ws.layout, "layout");
  if (ws.mobileLayout !== undefined) checkEdgeGroups(ws.mobileLayout, "mobileLayout");

  // Secrets are dropped on import too: a document carrying someone else's
  // key would otherwise silently route this user's text through their
  // account (where the key owner can read request logs).
  return stripPanelParams(ws as Workspace, ["filePath", ...SECRET_PARAM_KEYS]);
}

/**
 * Validates `layout.edgeGroups` when present: each position holds a finite
 * `size`, a boolean `visible`, an optional boolean `collapsed`, and (when it
 * carries panels) a `group` with a string id and string views.
 */
function checkEdgeGroups(layout: unknown, label: string): void {
  const eg = (layout as { edgeGroups?: unknown } | null | undefined)?.edgeGroups;
  if (eg === undefined) return;
  const bad = (why: string) => new Error(`Invalid workspace structure: ${label}.edgeGroups ${why}`);
  if (!eg || typeof eg !== "object" || Array.isArray(eg)) throw bad("is malformed");
  for (const [pos, entry] of Object.entries(eg as Record<string, unknown>)) {
    if (!["top", "bottom", "left", "right"].includes(pos)) throw bad(`has unknown position "${pos}"`);
    const e = entry as {
      size?: unknown;
      visible?: unknown;
      collapsed?: unknown;
      group?: { id?: unknown; views?: unknown } | null;
    } | null;
    if (
      !e ||
      typeof e !== "object" ||
      typeof e.size !== "number" ||
      !Number.isFinite(e.size) ||
      typeof e.visible !== "boolean" ||
      (e.collapsed !== undefined && typeof e.collapsed !== "boolean")
    ) {
      throw bad(`"${pos}" is malformed`);
    }
    if (e.group !== undefined) {
      const g = e.group;
      if (
        !g ||
        typeof g !== "object" ||
        typeof g.id !== "string" ||
        !Array.isArray(g.views) ||
        g.views.some((v) => typeof v !== "string")
      ) {
        throw bad(`"${pos}".group is malformed`);
      }
    }
  }
}

/**
 * Returns a copy of the workspace with the given keys removed from every
 * panel's params. The input is not mutated (export serializes live state).
 *
 * On import this strips `filePath`:
 *
 * A workspace document is untrusted input — it's explicitly designed to be
 * shared between machines (export/import, starter workspaces for forks).
 * `EditorPanel` and `JsonEditPanel` both read `params.filePath` from disk
 * unconditionally on mount, with no confirmation. Without this, a crafted
 * .exo.json could point a panel at any file the app has fs access to (the
 * whole home directory) and have it silently read and displayed the moment
 * the workspace activates. Dropping the path is enough: the panel falls back
 * to its normal empty-buffer state, same as a file that's been deleted, and
 * the user re-opens the file themselves if they want it.
 */
function stripPanelParams(workspace: Workspace, keys: readonly string[]): Workspace {
  const out = { ...workspace, layout: stripLayoutParams(workspace.layout, keys) };
  if (workspace.mobileLayout) {
    out.mobileLayout = stripLayoutParams(workspace.mobileLayout, keys);
  }
  return out;
}

function stripLayoutParams(layout: Workspace["layout"], keys: readonly string[]): Workspace["layout"] {
  const panels = layout?.panels;
  if (!panels || typeof panels !== "object") return layout;

  const sanitizedPanels: typeof panels = {};
  for (const [id, panel] of Object.entries(panels)) {
    if (
      panel &&
      typeof panel === "object" &&
      panel.params &&
      keys.some((k) => k in panel.params!)
    ) {
      const restParams: Record<string, unknown> = { ...panel.params };
      for (const k of keys) delete restParams[k];
      sanitizedPanels[id] = { ...panel, params: restParams };
    } else {
      sanitizedPanels[id] = panel;
    }
  }

  return { ...layout, panels: sanitizedPanels };
}
