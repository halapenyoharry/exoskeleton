import type { Workspace } from "./storage.ts";

export interface WorkspaceDocument {
  $schema?: string;
  type: "exoskeleton-workspace";
  version: 8;
  workspace: Workspace;
}

/**
 * Serializes a Workspace object into a formatted `.exo.json` document string.
 */
export function serializeWorkspaceDocument(workspace: Workspace): string {
  const doc: WorkspaceDocument = {
    type: "exoskeleton-workspace",
    version: 8,
    workspace,
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

  return stripLocalFilePaths(ws as Workspace);
}

/**
 * Strips `filePath` from every panel's params in an imported layout.
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
function stripLocalFilePaths(workspace: Workspace): Workspace {
  const panels = workspace.layout?.panels;
  if (!panels || typeof panels !== "object") return workspace;

  const sanitizedPanels: typeof panels = {};
  for (const [id, panel] of Object.entries(panels)) {
    if (panel && typeof panel === "object" && panel.params && "filePath" in panel.params) {
      const { filePath: _filePath, ...restParams } = panel.params;
      sanitizedPanels[id] = { ...panel, params: restParams };
    } else {
      sanitizedPanels[id] = panel;
    }
  }

  return { ...workspace, layout: { ...workspace.layout, panels: sanitizedPanels } };
}
