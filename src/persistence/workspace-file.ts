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

  return ws as Workspace;
}
