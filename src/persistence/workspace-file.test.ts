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
