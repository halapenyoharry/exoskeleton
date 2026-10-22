import { test } from "node:test";
import assert from "node:assert";
import {
  serializeWorkspaceDocument,
  parseWorkspaceDocument,
} from "./workspace-file.ts";
import type { Workspace } from "./storage.ts";

const mockWorkspace: Workspace = {
  id: "ws-test-123",
  name: "Audio Visualizer Workspace",
  layout: { grid: { root: { type: "branch", data: [] }, height: 100, width: 100, orientation: "HORIZONTAL" }, panels: {} } as any,
  updatedAt: 1700000000000,
};

test("serializeWorkspaceDocument creates valid .exo.json string", () => {
  const jsonStr = serializeWorkspaceDocument(mockWorkspace);
  const parsed = JSON.parse(jsonStr);
  assert.strictEqual(parsed.type, "exoskeleton-workspace");
  assert.strictEqual(parsed.version, 8);
  assert.deepStrictEqual(parsed.workspace, mockWorkspace);
});

test("parseWorkspaceDocument parses valid workspace document", () => {
  const jsonStr = serializeWorkspaceDocument(mockWorkspace);
  const result = parseWorkspaceDocument(jsonStr);
  assert.deepStrictEqual(result, mockWorkspace);
});

test("parseWorkspaceDocument rejects non-object or invalid JSON", () => {
  assert.throws(() => parseWorkspaceDocument("invalid json"), /JSON/i);
  assert.throws(() => parseWorkspaceDocument("123"), /Invalid JSON document/i);
  assert.throws(() => parseWorkspaceDocument("null"), /Invalid JSON document/i);
});

test("parseWorkspaceDocument rejects wrong document type", () => {
  const invalidType = JSON.stringify({
    type: "some-other-app",
    version: 8,
    workspace: mockWorkspace,
  });
  assert.throws(() => parseWorkspaceDocument(invalidType), /Not an Exoskeleton workspace document/i);
});

test("parseWorkspaceDocument rejects missing or invalid workspace payload", () => {
  const missingWorkspace = JSON.stringify({
    type: "exoskeleton-workspace",
    version: 8,
  });
  assert.throws(() => parseWorkspaceDocument(missingWorkspace), /Missing workspace object/i);

  const invalidWsStructure = JSON.stringify({
    type: "exoskeleton-workspace",
    version: 8,
    workspace: { id: 123, name: null },
  });
  assert.throws(() => parseWorkspaceDocument(invalidWsStructure), /Invalid workspace structure/i);
});

test("parseWorkspaceDocument strips filePath from every panel's params", () => {
  const workspaceWithFilePaths: Workspace = {
    id: "ws-test-456",
    name: "Has local paths",
    layout: {
      grid: { root: { type: "branch", data: [] }, height: 100, width: 100, orientation: "HORIZONTAL" },
      panels: {
        "json-edit-1": {
          id: "json-edit-1",
          contentComponent: "json-edit",
          params: { filePath: "/Users/victim/.ssh/id_rsa", theme: "midnight-alaska" },
        },
        "editor-1": {
          id: "editor-1",
          contentComponent: "editor",
          params: { filePath: "/Users/victim/.aws/credentials" },
        },
        "terminal-1": {
          id: "terminal-1",
          contentComponent: "terminal",
          params: {},
        },
      },
    } as any,
    updatedAt: 1700000000000,
  };

  const jsonStr = serializeWorkspaceDocument(workspaceWithFilePaths);
  const result = parseWorkspaceDocument(jsonStr);

  const panels = (result.layout as any).panels;
  assert.strictEqual("filePath" in panels["json-edit-1"].params, false);
  assert.strictEqual(panels["json-edit-1"].params.theme, "midnight-alaska");
  assert.strictEqual("filePath" in panels["editor-1"].params, false);
  assert.deepStrictEqual(panels["terminal-1"].params, {});
});

test("serializeWorkspaceDocument strips apiKey from panel params without mutating input", () => {
  const ws: Workspace = {
    ...mockWorkspace,
    layout: {
      ...(mockWorkspace.layout as any),
      panels: {
        "topology-1": {
          id: "topology-1",
          contentComponent: "topology-extract",
          params: { documentId: "default", provider: "openrouter", apiKey: "sk-or-secret" },
        },
      },
    } as any,
  };

  const jsonStr = serializeWorkspaceDocument(ws);
  assert.strictEqual(jsonStr.includes("sk-or-secret"), false);

  const exported = JSON.parse(jsonStr).workspace.layout.panels["topology-1"].params;
  assert.strictEqual("apiKey" in exported, false);
  assert.strictEqual(exported.provider, "openrouter");

  // Live state keeps the key — only the exported document loses it.
  assert.strictEqual((ws.layout as any).panels["topology-1"].params.apiKey, "sk-or-secret");
});

test("parseWorkspaceDocument drops apiKey from a hand-crafted document", () => {
  const raw = JSON.stringify({
    type: "exoskeleton-workspace",
    version: 8,
    workspace: {
      ...mockWorkspace,
      layout: {
        ...(mockWorkspace.layout as any),
        panels: {
          "topology-1": { id: "topology-1", params: { apiKey: "sk-or-foreign", model: "x" } },
        },
      },
    },
  });
  const params = (parseWorkspaceDocument(raw).layout as any).panels["topology-1"].params;
  assert.strictEqual("apiKey" in params, false);
  assert.strictEqual(params.model, "x");
});

test("workspace documents round-trip an optional mobileLayout and strip secrets inside it", () => {
  const withDeck = {
    ...mockWorkspace,
    mobileLayout: {
      grid: { root: { type: "branch", data: [] }, height: 1, width: 1, orientation: "HORIZONTAL" },
      panels: { t: { id: "t", contentComponent: "topology-extract", params: { apiKey: "sk-secret", keep: 1 } } },
    },
  } as any as Workspace;
  const parsed = parseWorkspaceDocument(serializeWorkspaceDocument(withDeck));
  assert.deepStrictEqual((parsed.mobileLayout as any).panels.t.params, { keep: 1 });
  assert.throws(
    () => parseWorkspaceDocument(JSON.stringify({ type: "exoskeleton-workspace", version: 8, workspace: { ...mockWorkspace, mobileLayout: 5 } })),
    /mobileLayout/,
  );
  // absent stays absent
  assert.ok(!("mobileLayout" in parseWorkspaceDocument(serializeWorkspaceDocument(mockWorkspace))));
});

// ---- edge groups: the document edge's state is part of the workspace -------

const docEdgeWorkspace = (): Workspace => ({
  id: "ws-doc-edge",
  name: "With a document edge",
  layout: {
    grid: { root: { type: "branch", data: [] }, height: 100, width: 100, orientation: "HORIZONTAL" },
    panels: {
      "json-edit": { id: "json-edit", contentComponent: "json-edit", params: { documentId: "doc-7", theme: "midnight-alaska" } },
      settings: { id: "settings", contentComponent: "settings" },
    },
    edgeGroups: {
      left: { size: 410, visible: true, collapsed: true, group: { id: "document-edge", views: ["json-edit"], activeView: "json-edit" } },
      right: { size: 320, visible: true, group: { id: "side-grid", views: ["settings"], activeView: "settings" } },
    },
  } as any,
  mobileLayout: {
    grid: { root: { type: "branch", data: [] }, height: 100, width: 100, orientation: "HORIZONTAL" },
    panels: { "json-edit": { id: "json-edit", contentComponent: "json-edit" } },
    edgeGroups: {
      left: { size: 275, visible: true, collapsed: true, group: { id: "document-edge", views: ["json-edit"], activeView: "json-edit" } },
    },
  } as any,
  updatedAt: 1700000000000,
});

test("export/import keeps the document edge's open/collapsed state and size (desktop grid and phone deck)", () => {
  const out = parseWorkspaceDocument(serializeWorkspaceDocument(docEdgeWorkspace()));
  assert.deepStrictEqual(out.layout.edgeGroups, docEdgeWorkspace().layout.edgeGroups);
  assert.deepStrictEqual(out.mobileLayout?.edgeGroups, docEdgeWorkspace().mobileLayout?.edgeGroups);
  assert.strictEqual(out.layout.panels["json-edit"].params?.documentId, "doc-7");
});

test("parseWorkspaceDocument rejects malformed edgeGroups in layout or mobileLayout", () => {
  const doc = (mutate: (ws: any) => void) => {
    const ws = docEdgeWorkspace();
    mutate(ws);
    return JSON.stringify({ type: "exoskeleton-workspace", version: 8, workspace: ws });
  };
  assert.throws(() => parseWorkspaceDocument(doc((ws) => (ws.layout.edgeGroups = "left"))), /layout\.edgeGroups is malformed/);
  assert.throws(() => parseWorkspaceDocument(doc((ws) => (ws.layout.edgeGroups.left.size = "wide"))), /"left" is malformed/);
  assert.throws(() => parseWorkspaceDocument(doc((ws) => delete ws.layout.edgeGroups.left.visible)), /"left" is malformed/);
  assert.throws(() => parseWorkspaceDocument(doc((ws) => (ws.layout.edgeGroups.left.collapsed = "yes"))), /"left" is malformed/);
  assert.throws(() => parseWorkspaceDocument(doc((ws) => (ws.layout.edgeGroups.left.group.views = [7]))), /group is malformed/);
  assert.throws(() => parseWorkspaceDocument(doc((ws) => (ws.layout.edgeGroups.middle = { size: 1, visible: true }))), /unknown position/);
  assert.throws(
    () => parseWorkspaceDocument(doc((ws) => (ws.mobileLayout.edgeGroups.left.group = null))),
    /mobileLayout\.edgeGroups "left"\.group is malformed/,
  );
});

test("a layout without edgeGroups is still valid (older exports)", () => {
  assert.doesNotThrow(() => parseWorkspaceDocument(serializeWorkspaceDocument(mockWorkspace)));
});
